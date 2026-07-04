// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// Regressions for the roborev round-2 findings on the audit reader: the re-run must
// honour the RECORDED action (not assume read), and must consult the trace's OWN
// published revocations without the caller supplying them.

import { describe, expect, it } from "vitest";
import { ODRLD_REVOCATION_CLASS, ODRLD_REVOKED_POLICY } from "../src/odrl.js";
import { GraphBuilder, serializeTurtle } from "../src/rdf.js";
import { podKeyResolver, podStatusResolver, runScenario } from "../src/scenario/index.js";
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
      ...podKeyResolver(r.pod),
      resolveStatus: podStatusResolver(r.pod, { now: r.now }),
    });
    expect(audit.reRun?.authorized).toBe(false);
    expect(audit.reRun?.code).toBe("POLICY_DENIED");
    // and the recorded decision (permit) now DIVERGES from the re-run (deny) — a finding
    expect(audit.divergence).toBe(true);
  });

  it("SSRF guard: a policy IRI outside the allowlist (or non-http) is not dereferenced", async () => {
    const r = await runScenario();
    // Block the institute's host — its internal policy IRI must NOT be fetched.
    const trace = await loadTrace(r.pod, r.cast.engagementBase, {
      isPolicyUrlAllowed: (url) => !url.startsWith("https://institute.example/"),
    });
    expect(trace.policies.has(r.cast.instituteInternalId)).toBe(false);
    // the Alice-hosted mandate/agreement policies are still loaded
    expect(trace.policies.has(r.cast.mandateId)).toBe(true);
    expect(trace.policies.has(r.cast.agreementId)).toBe(true);
  });

  it("SSRF guard: a NON-HTTP svc:policy IRI is never dereferenced (no source.get for it)", async () => {
    const r = await runScenario();
    // Record every URL the source is asked for.
    const requested: string[] = [];
    const spy = {
      get: (url: string) => {
        requested.push(url);
        return r.pod.get(url);
      },
      list: (prefix: string) => r.pod.list(prefix),
    };
    // Inject a credential whose svc:policy is a file: IRI (an SSRF/local-file probe),
    // and stash a would-be policy at that URL so ONLY the guard prevents loading it.
    r.pod.put(
      `${r.cast.engagementBase}credentials/evil.vc.jsonld`,
      JSON.stringify({
        issuer: "https://attacker.example/#me",
        type: ["AgentAuthorizationCredential"],
        credentialSubject: {
          id: "https://attacker.example/#me",
          "https://w3id.org/jeswr/solid-vc#authorizes": "https://attacker.example/agent#it",
          "https://w3id.org/jeswr/solid-vc#action": "read",
          "https://w3id.org/jeswr/solid-vc#policy": "file:///etc/passwd#p",
        },
      }),
      "application/ld+json",
    );
    r.pod.put("file:///etc/passwd", "SECRET", "text/turtle");

    const trace = await loadTrace(spy, r.cast.engagementBase);
    expect(requested).not.toContain("file:///etc/passwd");
    expect(trace.policies.has("file:///etc/passwd#p")).toBe(false);
  });

  it("MEDIUM regression: a recorded decision with NO purpose re-runs with no purpose → denied by a purpose-constrained policy", async () => {
    const r = await runScenario();
    // Overwrite the decision record so the recorded request asserted NO purpose.
    await writeDecision(r.pod, r.cast.engagementBase, "req-1", {
      id: `${r.cast.engagementBase}decisions/req-1.ttl#record`,
      request: { action: "read", target: r.cast.records }, // no purpose
      evaluatedAt: r.now,
      rootPrincipal: r.cast.alice,
      actor: r.cast.agentR,
      leafAssignee: r.cast.inst,
      revokedConsulted: [],
      result: r.verification,
    });
    const trace = await loadTrace(r.pod, r.cast.engagementBase);
    expect(
      trace.recordedDecisions.find((d) => d.requestTarget === r.cast.records)?.requestPurpose,
    ).toBeUndefined();
    const audit = await auditArtifact(trace, r.cast.derivedArtifact, {
      ...podKeyResolver(r.pod),
      resolveStatus: podStatusResolver(r.pod, { now: r.now }),
    });
    // the agreement's read permission is purpose-constrained → no purpose denies
    expect(audit.reRun?.authorized).toBe(false);
    expect(audit.reRun?.code).toBe("POLICY_DENIED");
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
      ...podKeyResolver(r.pod),
      resolveStatus: podStatusResolver(r.pod, { now: r.now }),
    });
    expect(audit.reRun?.authorized).toBe(false);
    expect(audit.reRun?.code).toBe("REVOKED");
  });
});
