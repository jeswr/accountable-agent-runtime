// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The happy-path §4 scenario replay + the auditor's walk + trace byte-stability.

import { describe, expect, it } from "vitest";
import { runScenario, sameOriginController } from "../src/scenario/index.js";
import { auditArtifact, loadTrace } from "../src/trace/index.js";

describe("the §4 scenario, end to end", () => {
  it("discovers, upgrades, verifies (four phases + identity composition), and authorizes", async () => {
    const r = await runScenario();

    expect(r.discovery.verification?.valid).toBe(true);
    expect(r.discovery.descriptor?.owner).toBe(r.cast.inst);
    expect(r.protocolPinned).toBe(true);
    expect(r.handshakeAccepted).toBe(true);
    expect(r.intentConforms).toBe(true);

    expect(r.verification.authorized).toBe(true);
    expect(r.verification.phase).toBe("complete");
    expect(r.verification.chainPolicyIds).toEqual([r.cast.mandateId, r.cast.agreementId]);
    // the D9 second chain (rooted at the leaf assignee) authorized the acting agent
    expect(r.verification.actorResult?.authorized).toBe(true);
    expect(r.verification.actorResult?.chainPolicyIds).toEqual([r.cast.instituteInternalId]);
    // G1 CLOSED (Phase 1): every hop (primary + identity-composition chain) was
    // content-digest-verified against its credential's signed relatedResource —
    // the permit no longer rests on trusted-by-location policy binding.
    expect(r.verification.policyIntegrityProvisional).toBe(false);
    expect(r.verification.actorResult?.policyIntegrityProvisional).toBe(false);
  });

  it("lays down the full trace container (DESIGN §3.1)", async () => {
    const r = await runScenario();
    const urls = r.pod.keys();
    const base = r.cast.engagementBase;
    expect(urls).toContain(`${base}mandate.ttl`);
    expect(urls).toContain(`${base}agreement.ttl`);
    expect(urls).toContain(`${base}chain.prov.ttl`);
    // the institute-internal policy is hosted at its IRI's document URL (its pod)
    expect(urls).toContain("https://institute.example/policies/internal-e1.ttl");
    expect(urls).toContain(`${base}credentials/mandate.vc.jsonld`);
    expect(urls).toContain(`${base}credentials/agreement.vc.jsonld`);
    expect(urls).toContain(`${base}credentials/institute-agent.vc.jsonld`);
    expect(urls).toContain(`${base}activities/act-1.ttl`);
    expect(urls).toContain(`${base}decisions/req-1.ttl`);
    // the owner's LDN copy of the activity bundle (D3)
    expect(urls).toContain(`${r.cast.aliceInbox}act-1.ttl`);
  });

  it("the auditor walks the trace back to Alice — mechanically, from standard vocab", async () => {
    const r = await runScenario();
    const trace = await loadTrace(r.pod, r.cast.engagementBase);
    const audit = await auditArtifact(trace, r.cast.derivedArtifact, {
      resolveKey: r.keyRing.resolveKey,
      isControlledBy: sameOriginController,
    });

    expect(audit.provGap).toBe(false);
    // Q1 — which action produced it + who
    expect(audit.actingAgent).toBe(r.cast.agentR);
    expect(audit.onBehalfOf).toBe(r.cast.inst);
    expect(audit.used).toEqual([r.cast.records]);
    // Q2 — under what policy: leaf → mandate, each attributed to its issuer
    expect(audit.leafPolicy).toBe(r.cast.agreementId);
    expect(audit.authorityChain).toEqual([
      { policy: r.cast.mandateId, attributedTo: r.cast.alice },
      { policy: r.cast.agreementId, attributedTo: r.cast.agentA },
    ]);
    // Q3 — was it authorized, re-run at the action instant: yes, no divergence
    expect(audit.reRun?.authorized).toBe(true);
    expect(audit.divergence).toBe(false);
  });

  it("the dispute: re-running Phase D with the ACTUAL (out-of-scope) use denies — a breach", async () => {
    const r = await runScenario();
    const trace = await loadTrace(r.pod, r.cast.engagementBase);
    const audit = await auditArtifact(trace, r.cast.derivedArtifact, {
      resolveKey: r.keyRing.resolveKey,
      isControlledBy: sameOriginController,
      actualUsePurpose: r.cast.misusePurpose,
    });
    expect(audit.dispute?.breach).toBe(true);
    expect(audit.dispute?.authorized).toBe(false);
    // and the "authorized then" re-run still permitted (the read WAS in scope at the time)
    expect(audit.reRun?.authorized).toBe(true);
  });

  it("a PROV-omitting actor leaves a detectable gap (the mirrored-trace divergence)", async () => {
    const r = await runScenario();
    const trace = await loadTrace(r.pod, r.cast.engagementBase);
    // An artifact with no activity claiming to have generated it.
    const audit = await auditArtifact(trace, "https://institute.example/derived/ghost.ttl", {
      resolveKey: r.keyRing.resolveKey,
      isControlledBy: sameOriginController,
    });
    expect(audit.provGap).toBe(true);
    expect(audit.activity).toBeUndefined();
  });

  it("the trace serialises BYTE-STABLE across runs (canonical ordering)", async () => {
    const a = await runScenario();
    const b = await runScenario();
    const byPath = (arts: typeof a.writtenArtifacts) =>
      Object.fromEntries(arts.map((x) => [x.path, x.canonical]));
    expect(byPath(a.writtenArtifacts)).toEqual(byPath(b.writtenArtifacts));
  });

  it("golden: the chain provenance overlay (date-free, fully deterministic)", async () => {
    const r = await runScenario();
    const overlay = r.writtenArtifacts.find((a) => a.path === "chain.prov.ttl");
    expect(overlay?.canonical).toMatchSnapshot();
  });
});
