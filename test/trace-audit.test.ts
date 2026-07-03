// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// Regressions for the roborev round-2 findings on the audit reader: the re-run must
// honour the RECORDED action (not assume read), and must consult the trace's OWN
// published revocations without the caller supplying them.

import { describe, expect, it } from "vitest";
import { ODRLD_REVOCATION_CLASS, ODRLD_REVOKED_POLICY } from "../src/odrl.js";
import { GraphBuilder, serializeTurtle } from "../src/rdf.js";
import { runScenario, sameOriginController } from "../src/scenario/index.js";
import { auditArtifact, loadTrace, writeDecision } from "../src/trace/index.js";

describe("audit re-run fidelity", () => {
  it("carries the recorded request action/purpose (does not assume read)", async () => {
    const r = await runScenario();
    const trace = await loadTrace(r.pod, r.cast.engagementBase);
    const rec = trace.recordedDecisions.find((d) => d.requestTarget === r.cast.records);
    expect(rec?.requestAction).toBe("read");
    expect(rec?.requestPurpose).toBe(r.cast.purpose);
  });

  it("HIGH regression: a recorded NON-read action is re-run as that action → denied (not falsely authorized)", async () => {
    const r = await runScenario();
    // Overwrite the decision record so it recorded a `delete` (which the agreement
    // does NOT permit — it grants only read). A hardcoded-read re-run would wrongly
    // authorize; the fix re-runs the recorded action and denies.
    await writeDecision(r.pod, r.cast.engagementBase, "req-1", {
      id: `${r.cast.engagementBase}decisions/req-1.ttl#record`,
      request: {
        action: "delete",
        target: r.cast.records,
        attributes: { purpose: r.cast.purpose, dateTime: r.now.toISOString() },
      },
      evaluatedAt: r.now,
      rootPrincipal: r.cast.alice,
      actor: r.cast.agentR,
      leafAssignee: r.cast.inst,
      revokedConsulted: [],
      result: r.verification,
    });
    const trace = await loadTrace(r.pod, r.cast.engagementBase);
    const audit = await auditArtifact(trace, r.cast.derivedArtifact, {
      resolveKey: r.keyRing.resolveKey,
      isControlledBy: sameOriginController,
    });
    expect(audit.reRun?.authorized).toBe(false);
    expect(audit.reRun?.code).toBe("POLICY_DENIED");
    // and the recorded decision (permit) now DIVERGES from the re-run (deny) — a finding
    expect(audit.divergence).toBe(true);
  });

  it("MEDIUM regression: the trace's own published revocation is consulted without the caller supplying it", async () => {
    const r = await runScenario();
    // Publish revocations.ttl revoking the agreement (as the owner would).
    const b = new GraphBuilder();
    const rev = `${r.cast.engagementBase}revocations.ttl#r1`;
    b.addType(rev, ODRLD_REVOCATION_CLASS);
    b.addIri(rev, ODRLD_REVOKED_POLICY, r.cast.agreementId);
    r.pod.put(
      `${r.cast.engagementBase}revocations.ttl`,
      await serializeTurtle(b.quads()),
      "text/turtle",
    );

    const trace = await loadTrace(r.pod, r.cast.engagementBase);
    expect(trace.revokedPolicies).toContain(r.cast.agreementId);
    // No options.revoked supplied — the trace-published revocation must still deny.
    const audit = await auditArtifact(trace, r.cast.derivedArtifact, {
      resolveKey: r.keyRing.resolveKey,
      isControlledBy: sameOriginController,
    });
    expect(audit.reRun?.authorized).toBe(false);
    expect(audit.reRun?.code).toBe("REVOKED");
  });
});
