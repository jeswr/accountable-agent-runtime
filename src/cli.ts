#!/usr/bin/env node
// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T6/T7 — the package `bin`: two subcommands over the live layer.
//
//   accountable-agent-runtime demo  [--keep] [--base <url>] [--json <file>]
//   accountable-agent-runtime audit <artifact-iri>
//       [--engagement <container-iri>] [--purpose <iri>] [--at <instant>]
//       [--base <url>] [--json]
//
// `audit` is the §5 zero-credential auditor: it reads a live pod's PUBLIC trace and prints
// the human transcript (or `--json` envelope) answering "who authorized this action, under
// what policy, in what scope?", with the verdict exit codes (0 clean / 3 breach /
// 4 divergence / 5 provGap / 2 unwalkable). `demo` is the §4 one-command harness.
//
// NO credentials are ever read from argv (the auditor authenticates nothing; the demo mints
// its own ephemeral in-process credentials). Unknown flags fail fast with usage.

import process from "node:process";
import {
  type AuditLiveResult,
  AuditUnwalkable,
  auditLive,
  renderTranscript,
} from "./live/audit.js";
import { runDemo } from "./live/demo.js";

/** Parse `--flag value` / `--flag` (boolean) options + positional args from argv. */
function parseArgs(argv: readonly string[]): {
  positionals: string[];
  flags: Map<string, string | true>;
} {
  const positionals: string[] = [];
  const flags = new Map<string, string | true>();
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i] as string;
    if (arg.startsWith("--")) {
      const name = arg.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) {
        flags.set(name, next);
        i += 1;
      } else {
        flags.set(name, true);
      }
    } else {
      positionals.push(arg);
    }
  }
  return { positionals, flags };
}

const USAGE = `accountable-agent-runtime — the Accountable Web of Agents §4 demo + auditor

Usage:
  accountable-agent-runtime demo  [--keep] [--base <url>] [--json <file>]
  accountable-agent-runtime audit <artifact-iri> [--engagement <container-iri>]
      [--purpose <iri>] [--at <instant>] [--base <url>] [--json]

audit exit codes: 0 clean · 3 breach · 4 divergence · 5 provGap · 2 unwalkable`;

/** Print + flush a line to stdout. */
function out(line: string): void {
  process.stdout.write(`${line}\n`);
}

async function runAudit(
  positionals: readonly string[],
  flags: Map<string, string | true>,
): Promise<number> {
  const artifact = positionals[0];
  if (artifact === undefined) {
    process.stderr.write(`audit: missing <artifact-iri>\n\n${USAGE}\n`);
    return 2;
  }
  const stringFlag = (name: string): string | undefined => {
    const v = flags.get(name);
    return typeof v === "string" ? v : undefined;
  };
  let base: string;
  const baseFlag = stringFlag("base");
  if (baseFlag !== undefined) {
    base = baseFlag;
  } else {
    try {
      base = new URL(artifact).origin;
    } catch {
      process.stderr.write(`audit: <artifact-iri> is not an absolute URL: ${artifact}\n`);
      return 2;
    }
  }
  const at = stringFlag("at");
  let result: AuditLiveResult;
  try {
    result = await auditLive({
      base,
      artifact,
      ...(stringFlag("engagement") !== undefined && { engagement: stringFlag("engagement") }),
      ...(stringFlag("purpose") !== undefined && { actualUsePurpose: stringFlag("purpose") }),
      ...(at !== undefined && { at: new Date(at) }),
    });
  } catch (error) {
    if (error instanceof AuditUnwalkable) {
      process.stderr.write(`audit: ${error.message}\n`);
      return 2;
    }
    throw error;
  }
  if (flags.get("json") !== undefined) {
    out(JSON.stringify(result.envelope, null, 2));
  } else {
    out(renderTranscript(result));
  }
  return result.exitCode;
}

async function runDemoCommand(flags: Map<string, string | true>): Promise<number> {
  const stringFlag = (name: string): string | undefined => {
    const v = flags.get(name);
    return typeof v === "string" ? v : undefined;
  };
  const result = await runDemo({
    keep: flags.get("keep") === true,
    ...(stringFlag("base") !== undefined && { base: stringFlag("base") }),
    ...(stringFlag("json") !== undefined && { json: stringFlag("json") }),
    log: out,
  });
  return result.ok ? 0 : 1;
}

async function main(): Promise<number> {
  const [command, ...rest] = process.argv.slice(2);
  const { positionals, flags } = parseArgs(rest);
  switch (command) {
    case "audit":
      return runAudit(positionals, flags);
    case "demo":
      return runDemoCommand(flags);
    case undefined:
    case "--help":
    case "-h":
    case "help":
      out(USAGE);
      return command === undefined ? 2 : 0;
    default:
      process.stderr.write(`unknown command ${JSON.stringify(command)}\n\n${USAGE}\n`);
      return 2;
  }
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    process.stderr.write(`fatal: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
