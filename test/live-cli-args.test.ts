// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T6 unit suite — the CLI's pure arg parsing + per-command flag validation (roborev Low:
// unknown flags rejected, value-flags require a value; no silent no-ops).

import { describe, expect, it } from "vitest";
import { AUDIT_FLAGS, DEMO_FLAGS, parseArgs, validateFlags } from "../src/live/cli-args.js";

describe("parseArgs", () => {
  it("splits positionals from --flag value and bare --flag", () => {
    const { positionals, flags } = parseArgs(["a.ttl", "--base", "http://x", "--json"]);
    expect(positionals).toEqual(["a.ttl"]);
    expect(flags.get("base")).toBe("http://x");
    expect(flags.get("json")).toBe(true);
  });

  it("a value-flag immediately followed by another flag is a bare toggle", () => {
    const { flags } = parseArgs(["--base", "--json", "out"]);
    expect(flags.get("base")).toBe(true);
    expect(flags.get("json")).toBe("out");
  });
});

describe("validateFlags — audit", () => {
  it("accepts the documented flags", () => {
    const { flags } = parseArgs([
      "a.ttl",
      "--engagement",
      "http://x/e/",
      "--purpose",
      "p",
      "--json",
    ]);
    expect(validateFlags("audit", flags, AUDIT_FLAGS)).toBeUndefined();
  });

  it("REJECTS an unknown flag", () => {
    const { flags } = parseArgs(["a.ttl", "--bogus", "x"]);
    expect(validateFlags("audit", flags, AUDIT_FLAGS)).toBe("audit: unknown flag --bogus");
  });

  it("REJECTS a value-flag with no value (silent no-op guard)", () => {
    const { flags } = parseArgs(["a.ttl", "--base"]);
    expect(validateFlags("audit", flags, AUDIT_FLAGS)).toBe("audit: flag --base requires a value");
  });
});

describe("validateFlags — demo", () => {
  it("accepts --keep + --base + --json <file>", () => {
    const { flags } = parseArgs(["--keep", "--base", "http://x", "--json", "out.json"]);
    expect(validateFlags("demo", flags, DEMO_FLAGS)).toBeUndefined();
  });

  it("REJECTS a bare --json (requires a file path for demo)", () => {
    const { flags } = parseArgs(["--json"]);
    expect(validateFlags("demo", flags, DEMO_FLAGS)).toBe("demo: flag --json requires a value");
  });

  it("REJECTS an unknown flag", () => {
    const { flags } = parseArgs(["--purpose", "p"]);
    expect(validateFlags("demo", flags, DEMO_FLAGS)).toBe("demo: unknown flag --purpose");
  });
});
