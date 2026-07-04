// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T2 (part) — the in-memory Community Solid Server child process (design §4.2 [1]).
// Boots `npx @solid/community-server@7` on a free loopback port with its default
// in-memory + account-API config (the exact invocation the `solid-test-infrastructure`
// skill's harness uses), polls until it answers, and hands back a `{ base, stop }` handle.
//
// ORPHAN-PROOFING (mandatory): the child is killed on this process's `exit` / `SIGINT` /
// `SIGTERM`, and {@link CssServer.stop} kills + awaits it. In-memory ⇒ teardown is just
// killing the child; every run starts from clean state.
//
// NO CREDENTIALS pass through this module — it only manages the server lifecycle.

import { type ChildProcess, spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:net";

/** A running CSS child + its base URL. */
export interface CssServer {
  /** The server root, e.g. `http://localhost:41234` (loopback — the `allowLoopback` path). */
  readonly base: string;
  /** The port it bound. */
  readonly port: number;
  /** Kill the child and await its exit. Idempotent. */
  stop(): Promise<void>;
}

/** Options for {@link bootCss}. */
export interface BootCssOptions {
  /** Bind this port instead of a free one (e.g. an external `--base` run wants a fixed port). */
  readonly port?: number;
  /** Readiness deadline in ms (cold `npx` can take 15–20 s). Default 60 000. */
  readonly readyTimeoutMs?: number;
  /** CSS log level (`-l`). Default `warn`. */
  readonly logLevel?: string;
  /** Inherit CSS stdio to this process (for `--keep` debugging). Default false (quiet). */
  readonly inheritStdio?: boolean;
}

/** Pick a free TCP port by binding `:0` and reading the assigned port. */
async function freePort(): Promise<number> {
  const server = createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  if (port === 0) {
    throw new Error("could not allocate a free port for CSS");
  }
  return port;
}

/**
 * Resolve once CSS is READY TO SEED, or reject at the deadline. Readiness is gated on the
 * OIDC discovery endpoint returning 200, NOT merely on the root answering: CSS's HTTP root
 * responds (even a 4xx) BEFORE its embedded OIDC provider has finished initialising, and
 * seeding's very first act is a client-credentials token exchange that dereferences that
 * provider — hitting it cold 500s (observed). Polling the discovery doc for a 200 closes that
 * cold-start race for all four parallel actor sessions.
 */
async function waitUntilReady(base: string, deadlineMs: number): Promise<void> {
  const discovery = `${base}/.well-known/openid-configuration`;
  const start = Date.now();
  while (Date.now() - start < deadlineMs) {
    try {
      const response = await fetch(discovery, { redirect: "manual" });
      if (response.status === 200) {
        return;
      }
    } catch {
      // not up yet — back off and retry.
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(
    `timed out waiting for CSS OIDC readiness at ${discovery} after ${deadlineMs} ms`,
  );
}

/**
 * Boot an in-memory CSS on a free (or given) loopback port and wait until it answers. The
 * returned handle's `stop()` tears it down; the child is also orphan-proofed against this
 * process exiting. `base` is `http://localhost:<port>` — a loopback base, so the discovery
 * fetch's `allowLoopback` hatch applies and no other network is touched.
 */
export async function bootCss(options: BootCssOptions = {}): Promise<CssServer> {
  const port = options.port ?? (await freePort());
  const base = `http://localhost:${port}`;
  const logLevel = options.logLevel ?? "warn";

  // Run CSS in a PRODUCTION Node environment. A test runner (vitest) sets `NODE_ENV=test` in
  // the process env; the spawned CSS grandchild inherits it, and under `NODE_ENV=test` CSS@7's
  // embedded `oidc-provider` loads a test/dev code path that references the `jest` global —
  // absent here — so its discovery endpoint throws (`ReferenceError: jest is not defined`) and
  // 500s FOREVER (root confirmed: forcing `NODE_ENV=production` restores a 200). A booted CSS
  // is a real server, so production mode is correct anyway. Also strip the injected
  // `NODE_OPTIONS` loader + the vitest marker so the child runs pristine.
  const childEnv: NodeJS.ProcessEnv = { ...process.env, NODE_ENV: "production" };
  childEnv.NODE_OPTIONS = "";
  delete childEnv.VITEST;
  delete childEnv.VITEST_WORKER_ID;

  const child: ChildProcess = spawn(
    "npx",
    ["-y", "@solid/community-server@7", "-p", String(port), "-l", logLevel],
    {
      stdio: options.inheritStdio
        ? ["ignore", "inherit", "inherit"]
        : ["ignore", "ignore", "ignore"],
      env: childEnv,
      // Own process group is not requested — we kill the child (and npx re-exec) directly.
    },
  );

  let stopped = false;
  const killChild = (): void => {
    if (!child.killed) {
      child.kill("SIGTERM");
    }
  };
  // Orphan-proofing: kill the child if THIS process goes away.
  const onExit = (): void => killChild();
  process.once("exit", onExit);
  process.once("SIGINT", onExit);
  process.once("SIGTERM", onExit);

  const childExit = once(child, "exit");
  // If the child dies before readiness, surface that instead of hanging to the deadline.
  const failFast = childExit.then(([code]) => {
    if (!stopped) {
      throw new Error(`CSS child exited early (code ${String(code)}) before becoming ready`);
    }
  });

  const stop = async (): Promise<void> => {
    stopped = true;
    process.removeListener("exit", onExit);
    process.removeListener("SIGINT", onExit);
    process.removeListener("SIGTERM", onExit);
    killChild();
    if (child.exitCode === null && child.signalCode === null) {
      await once(child, "exit").catch(() => undefined);
    }
  };

  try {
    await Promise.race([waitUntilReady(base, options.readyTimeoutMs ?? 60_000), failFast]);
  } catch (error) {
    await stop();
    throw error;
  }

  return { base, port, stop };
}
