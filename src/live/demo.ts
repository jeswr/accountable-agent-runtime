// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T7 — the ONE-COMMAND harness (design §4). `demo:live` (npm script / the `demo` bin
// subcommand): boot CSS on a free port → seed the full substrate → run the live §4 scenario
// → run the four negative acts → run the AUDITOR (zero credentials) → print the human
// transcript answering "who authorized this action, under what policy, in what scope?" +
// optional JSON → tear the server down. Every step is scripted; only [1] needs a server and
// the harness itself provides it (with `--base` even that is external).
//
// Failure discipline (§4.2): any failed assertion tears down (unless `--keep`), prints the
// failing step, and the caller exits non-zero. The CSS child is orphan-proofed by
// {@link bootCss}. Live-run assertions are STRUCTURAL (decisions + error codes + the 403→200
// flip + provGap + breach), never golden — real timestamps/ports/UUIDs are non-reproducible.

import { writeFile } from "node:fs/promises";
import { type AuditLiveResult, auditLive, renderTranscript } from "./audit.js";
import type { BootCssOptions } from "./css.js";
import { type NegativeActsResult, runNegativeActs } from "./negative.js";
import { type LiveRunResult, runLiveScenario } from "./run.js";
import { type LiveSubstrate, seedDemo } from "./seed.js";

/** Options for {@link runDemo}. */
export interface RunDemoOptions {
  /** Target an already-running local server instead of booting CSS. */
  readonly base?: string;
  /** Leave a booted CSS up after the run (debugging). */
  readonly keep?: boolean;
  /** Additionally write the machine-readable audit envelope to this path. */
  readonly json?: string;
  /** Override the evaluation instant (default: within the grant window). */
  readonly now?: Date;
  /** CSS boot options (ignored when `base` is given). */
  readonly bootOptions?: BootCssOptions;
  /** Sink for the human transcript + progress lines (default `console.log`). */
  readonly log?: (line: string) => void;
}

/** The full result of a demo run (for the integration suite's structural assertions). */
export interface DemoResult {
  readonly base: string;
  readonly run: LiveRunResult;
  readonly negatives: NegativeActsResult;
  readonly audit: AuditLiveResult;
  /** True iff every §4.4 verdict held (the harness exit is 0 iff this is true). */
  readonly ok: boolean;
  /** The human-readable assertions summary (each `PASS`/`FAIL`). */
  readonly checks: readonly { readonly name: string; readonly pass: boolean }[];
}

/** One structural check. */
interface Check {
  readonly name: string;
  readonly pass: boolean;
}

/**
 * Run the whole demo against a freshly-booted (or `--base`-targeted) local Solid server.
 * Tears the server down on completion or failure (unless `keep`). Returns the structured
 * result; the caller decides the process exit code from {@link DemoResult.ok}.
 */
export async function runDemo(options: RunDemoOptions = {}): Promise<DemoResult> {
  const log = options.log ?? ((line: string): void => console.log(line));
  let substrate: LiveSubstrate | undefined;
  try {
    // [1]+[2] BOOT + SEED
    log("[1/6] booting CSS + seeding the substrate…");
    substrate = await seedDemo({
      ...(options.base !== undefined && { base: options.base }),
      ...(options.keep !== undefined && { keep: options.keep }),
      ...(options.bootOptions !== undefined && { bootOptions: options.bootOptions }),
    });
    log(`      server: ${substrate.base}`);

    // [3] SCENARIO
    log(
      "[2/6] running the live §4 scenario (discover → LDN upgrade → 4-phase verify → WAC → act)…",
    );
    const run = await runLiveScenario(
      substrate,
      options.now !== undefined ? { now: options.now } : {},
    );
    log(
      `      WAC flip: ${run.wacFlip}   verification: ${run.verification.authorized ? "PERMIT" : "DENY"}`,
    );
    log(`      LDN: offer=${run.ldn.offer} accept=${run.ldn.accept} announce=${run.ldn.announce}`);

    // [4] NEGATIVE ACTS
    log("[3/6] running the four negative acts (forged hop / out-of-scope / revoked / PROV-omit)…");
    const negatives = await runNegativeActs(substrate, run);

    // [5] AUDIT (zero credentials)
    log("[4/6] running the auditor with ZERO credentials…");
    const audit = await auditLive({
      base: substrate.base,
      artifact: run.derivedArtifact,
      engagement: run.auditTraceBase,
      actualUsePurpose: run.cast.misusePurpose,
    });

    // [6] PRINT
    log("[5/6] auditor transcript:");
    log("");
    log(renderTranscript(audit));
    log("");

    const checks: Check[] = [
      { name: "WAC 403→200 flip", pass: run.wacFlip === "403->200" },
      { name: "four-phase verify PERMIT", pass: run.verification.authorized === true },
      { name: "handshake accepted over LDN", pass: run.handshakeAccepted === true },
      { name: "protocol document pinned", pass: run.protocolPinned === true },
      {
        name: "N1 forged hop refused (Phase A)",
        pass: negatives.forgedHop.authorized === false && negatives.forgedHop.phase === "A",
      },
      { name: "N2 out-of-scope use is a breach", pass: negatives.outOfScope.breach === true },
      {
        name: "N3 revoked subtree denies (Phase C)",
        pass:
          negatives.revokedSubtree.reRunAuthorized === false &&
          negatives.revokedSubtree.phase === "C",
      },
      { name: "N3 status list reverted", pass: negatives.revokedSubtree.reverted === true },
      { name: "N4 PROV-omit gap detected", pass: negatives.provOmit.provGap === true },
      { name: "audit dispute breach", pass: audit.report.dispute?.breach === true },
    ];
    const ok = checks.every((c) => c.pass);

    log("[6/6] structural assertions:");
    for (const c of checks) {
      log(`      ${c.pass ? "PASS" : "FAIL"}  ${c.name}`);
    }
    log("");
    log(ok ? "DEMO OK — every assertion held." : "DEMO FAILED — see the FAIL lines above.");

    if (options.json !== undefined) {
      await writeFile(options.json, JSON.stringify(audit.envelope, null, 2), "utf8");
      log(`      wrote audit envelope → ${options.json}`);
    }

    return { base: substrate.base, run, negatives, audit, ok, checks };
  } finally {
    if (substrate !== undefined) {
      await substrate.stop();
    }
  }
}
