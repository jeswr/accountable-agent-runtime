// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
/**
 * check-dist-fresh — guard against the COMMITTED `dist/` drifting from `src/`.
 *
 * `dist/` is committed (not gitignored) so a consumer can
 * `npm install github:jeswr/accountable-agent-runtime#<sha>` under the suite's
 * `ignore-scripts=true` invariant and import the package with no build step. That
 * only stays correct while the committed artifact matches the source.
 *
 * Every runtime dependency here is either npm-published (`@jeswr/fetch-rdf`, `n3`,
 * `@rdfjs/wrapper`) or an off-npm `@jeswr` git package that ships its OWN committed
 * `dist/` (`solid-vc`, `solid-agent-card`, `solid-a2a`, `solid-odrl`). None needs a
 * build at consumer-install time, so a plain `tsc` emit is self-sufficient (no
 * bundling) — this script just rebuilds with `tsc` into a scratch dir and diffs the
 * emitted `.js` + `.d.ts` against the version of `dist/` at git HEAD.
 *
 * Comparing against git HEAD (not the working tree) makes the check independent of
 * whether `npm run build` ran first: it asks "does what's COMMITTED match a fresh
 * build of the COMMITTED src?", the property that actually keeps the artifact
 * correct. `*.map` sourcemaps are ignored (their bytes vary with the scratch
 * outDir path and are not load-bearing for a consumer).
 *
 * Exit 0 = in sync; exit 1 = drift (run `npm run build` and commit `dist/`).
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));

/** Recursively list emitted `.js`/`.d.ts` files under `dir` (skip `*.map`). */
function listArtifacts(dir) {
  const out = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else if (/\.(js|d\.ts)$/.test(entry.name) && !entry.name.endsWith(".map")) {
        out.push(p);
      }
    }
  };
  walk(dir);
  return out;
}

function toKey(base, abs) {
  return relative(base, abs).split(sep).join("/");
}

/** The `.js`/`.d.ts` artifacts committed under `dist/` at git HEAD, keyed relative to `dist/`. */
function committedDistKeysAtHead() {
  let out;
  try {
    out = execFileSync("git", ["ls-tree", "-r", "--name-only", "HEAD", "dist"], {
      cwd: root,
      encoding: "utf8",
    });
  } catch {
    return [];
  }
  return out
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .filter((p) => /\.(js|d\.ts)$/.test(p) && !p.endsWith(".map"))
    .map((p) => p.replace(/^dist\//, ""));
}

/** Read a committed `dist/<key>` blob from git HEAD, or `null` if absent. */
function readCommittedDist(key) {
  try {
    return execFileSync("git", ["show", `HEAD:dist/${key}`], { cwd: root, encoding: "utf8" });
  } catch {
    return null;
  }
}

let scratch;
try {
  scratch = mkdtempSync(join(tmpdir(), "aar-dist-"));
  const freshDist = join(scratch, "dist");
  execFileSync(
    "node",
    [
      join(root, "node_modules", "typescript", "bin", "tsc"),
      "-p",
      "tsconfig.build.json",
      "--outDir",
      freshDist,
    ],
    { cwd: root, stdio: ["ignore", "ignore", "inherit"] },
  );

  const freshFiles = new Map(listArtifacts(freshDist).map((p) => [toKey(freshDist, p), p]));
  const committedKeys = new Set(committedDistKeysAtHead());

  const drift = [];
  for (const [key, freshPath] of freshFiles) {
    const committed = readCommittedDist(key);
    if (committed === null) {
      drift.push(`missing in committed dist/: ${key}`);
      continue;
    }
    if (readFileSync(freshPath, "utf8") !== committed) {
      drift.push(`out of date: ${key}`);
    }
  }
  for (const key of committedKeys) {
    if (!freshFiles.has(key)) {
      drift.push(`stale (no longer emitted): dist/${key}`);
    }
  }

  if (drift.length > 0) {
    console.error("committed dist/ is out of sync with src/:");
    for (const d of drift) {
      console.error(`  - ${d}`);
    }
    console.error("\nRun `npm run build` and commit dist/.");
    process.exit(1);
  }
  console.log(`committed dist/ matches src/ (${freshFiles.size} artifacts).`);
} finally {
  if (scratch) {
    rmSync(scratch, { recursive: true, force: true });
  }
}
