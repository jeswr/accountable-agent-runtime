// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T6 unit suite — the auditor's exit-code mapping + human transcript rendering over synthetic
// `AuditReport`s (no server). Pins the §5.2 layout + the §5.3 verdict exit codes
// (0 clean / 3 breach / 4 divergence / 5 provGap).

import { describe, expect, it } from "vitest";
import { exitCodeFor, renderTranscript } from "../src/live/audit.js";
import type { AuditReport } from "../src/trace/index.js";

const cleanReport: AuditReport = {
  artifact: "https://inst.example/derived/s.ttl",
  provGap: false,
  activity: "https://inst.example/e1/activities/act-1.ttl#act",
  actingAgent: "https://inst.example/agent-r#me",
  onBehalfOf: "https://inst.example/org#me",
  leafPolicy: "https://alice.example/e1/agreement.ttl#policy",
  authorityChain: [
    {
      policy: "https://alice.example/e1/mandate.ttl#policy",
      attributedTo: "https://alice.example/#me",
    },
    {
      policy: "https://alice.example/e1/agreement.ttl#policy",
      attributedTo: "https://inst.example/agent-a#me",
    },
  ],
  used: ["https://alice.example/data/records.ttl"],
  actionInstant: "2026-08-01T00:00:00Z",
  reRun: {
    authorized: true,
    phase: "D",
    reason: "permitted",
    chainPolicyIds: [],
    duties: [],
  } as unknown as AuditReport["reRun"],
  divergence: false,
};

describe("exitCodeFor", () => {
  it("clean → 0", () => {
    expect(exitCodeFor(cleanReport)).toBe(0);
  });
  it("breach → 3", () => {
    expect(
      exitCodeFor({
        ...cleanReport,
        dispute: { actualUsePurpose: "x", authorized: false, reason: "purpose", breach: true },
      }),
    ).toBe(3);
  });
  it("divergence → 4", () => {
    expect(exitCodeFor({ ...cleanReport, divergence: true })).toBe(4);
  });
  it("provGap → 5 (outranks breach/divergence)", () => {
    expect(
      exitCodeFor({
        ...cleanReport,
        provGap: true,
        divergence: true,
        dispute: { actualUsePurpose: "x", authorized: false, reason: "r", breach: true },
      }),
    ).toBe(5);
  });
});

describe("renderTranscript", () => {
  const wrap = (report: AuditReport) => ({
    report,
    engagement: "https://inst.example/e1/",
    envelope: {} as never,
    exitCode: exitCodeFor(report),
  });

  it("renders the three-question layout + verdict for a clean report", () => {
    const t = renderTranscript(wrap(cleanReport));
    expect(t).toContain("WHO AUTHORIZED THIS ACTION?");
    expect(t).toContain("UNDER WHAT POLICY?");
    expect(t).toContain("WAS IT IN SCOPE?");
    expect(t).toContain("identity composition"); // agentR ≠ institute
    expect(t).toContain("VERDICT  breach=false  divergence=false  provGap=false");
  });

  it("renders a breach verdict + the BREACH line", () => {
    const t = renderTranscript(
      wrap({
        ...cleanReport,
        dispute: {
          actualUsePurpose: "https://dpv/DirectMarketing",
          authorized: false,
          reason: "purpose violated",
          breach: true,
        },
      }),
    );
    expect(t).toContain("DISPUTE — actual use purpose https://dpv/DirectMarketing");
    expect(t).toContain("⇒ BREACH");
    expect(t).toContain("provGap=false");
    expect(t).toContain("breach=true");
  });

  it("short-circuits a provGap report to the gap finding", () => {
    const t = renderTranscript(
      wrap({ artifact: "https://x/a.ttl", provGap: true, authorityChain: [], used: [] }),
    );
    expect(t).toContain("provGap: NO activity");
    expect(t).toContain("provGap=true");
    expect(t).not.toContain("UNDER WHAT POLICY?");
  });
});
