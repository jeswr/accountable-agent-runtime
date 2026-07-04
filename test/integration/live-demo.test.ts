// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// AAR_IT-gated integration suite (design §4.3): boots an in-memory CSS, seeds the substrate,
// and drives the WHOLE Wave-2 live demo — the §4 happy path (discover → LDN upgrade →
// four-phase verify → WAC 403→200 → act → announce), the four negative acts (N1 forged hop /
// N2 out-of-scope / N3 revoked subtree / N4 PROV-omit), and the zero-credential auditor —
// asserting the STRUCTURAL verdicts (decisions + error codes + the flip + breach + provGap).
//
// Opt-in: `AAR_IT=1 npm test`. The default `npm test` stays hermetic (the golden masters + the
// pure-logic unit suites, which cover the LDN receiver rules / policies / audit rendering
// WITHOUT a server). This file self-skips when AAR_IT is unset.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditLive } from "../../src/live/audit.js";
import { type NegativeActsResult, runNegativeActs } from "../../src/live/negative.js";
import { type LiveRunResult, runLiveScenario } from "../../src/live/run.js";
import { type LiveSubstrate, seedDemo } from "../../src/live/seed.js";

const RUN = process.env.AAR_IT ? describe : describe.skip;

RUN("live demo (AAR_IT)", () => {
  let s: LiveSubstrate;
  let run: LiveRunResult;
  let negatives: NegativeActsResult;

  beforeAll(async () => {
    s = await seedDemo({ bootOptions: { readyTimeoutMs: 120_000 } });
    run = await runLiveScenario(s);
    negatives = await runNegativeActs(s, run);
  }, 300_000);

  afterAll(async () => {
    await s?.stop();
  });

  it("the WAC boundary flips 403 → 200 (the server's own enforcement)", () => {
    expect(run.wacFlip).toBe("403->200");
  });

  it("the four-phase verifier PERMITS over live documents (D9 identity composition)", () => {
    expect(run.verification.authorized).toBe(true);
  });

  it("the A2A upgrade handshake completed over LDN inboxes", () => {
    expect(run.handshakeAccepted).toBe(true);
    expect(run.protocolPinned).toBe(true);
    expect(run.ldn.offer.startsWith(s.cast.agentR.inbox)).toBe(true);
    expect(run.ldn.accept.startsWith(s.cast.agentA.inbox)).toBe(true);
    expect(run.ldn.announce.startsWith(s.cast.alice.inbox)).toBe(true);
  });

  it("N1 forged hop: a fresh-key agreement credential is refused at Phase A", () => {
    expect(negatives.forgedHop.authorized).toBe(false);
    expect(negatives.forgedHop.phase).toBe("A");
  });

  it("N2 out-of-scope: the misuse-purpose dispute is a breach", () => {
    expect(negatives.outOfScope.breach).toBe(true);
  });

  it("N3 revoked subtree: a flipped Bitstring bit denies at Phase C, then reverts", () => {
    expect(negatives.revokedSubtree.reRunAuthorized).toBe(false);
    expect(negatives.revokedSubtree.phase).toBe("C");
    expect(negatives.revokedSubtree.reverted).toBe(true);
  });

  it("N4 PROV-omitting actor: an ungenerated artifact is a provGap", () => {
    expect(negatives.provOmit.provGap).toBe(true);
  });

  it("the auditor, with ZERO credentials, answers the three questions + finds the breach", async () => {
    const audit = await auditLive({
      base: s.base,
      artifact: run.derivedArtifact,
      engagement: run.auditTraceBase,
      actualUsePurpose: s.cast.misusePurpose,
    });
    expect(audit.report.provGap).toBe(false);
    expect(audit.report.actingAgent).toBe(s.cast.agentR.webId);
    expect(audit.report.onBehalfOf).toBe(s.cast.institute.webId);
    expect(audit.report.authorityChain.length).toBeGreaterThanOrEqual(2);
    expect(audit.report.reRun?.authorized).toBe(true);
    expect(audit.report.dispute?.breach).toBe(true);
    expect(audit.exitCode).toBe(3); // breach
    expect(audit.envelope.auditor.credentialsPresented).toBe(false);
  });

  it("the auditor discovers the engagement from the artifact alone (no --engagement)", async () => {
    const audit = await auditLive({ base: s.base, artifact: run.derivedArtifact });
    expect(audit.engagement).toBe(run.auditTraceBase);
    expect(audit.report.provGap).toBe(false);
  });
});
