// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// Adversarial regression tests for the DELEGATION-TRUST identity anchor (the HIGH
// found on the extracted sibling `@jeswr/agent-authz-verifier`, fixed there @
// 0dfd28e and back-ported here): the delegating principal / assigner used for
// chain-of-authority MUST be the PROOF-VERIFIED `vc.issuer`, never the
// self-asserted `credentialSubject.id`. `verifyCredential` proves the signature
// against `issuer` + key control but does NOT constrain the subject id, so an
// attacker who controls their OWN valid issuer key could otherwise sign a
// credential naming a trusted party in `subject.id` and have the chain accept it
// as that party's grant — a full chain-of-trust bypass.
//
// The forged credentials here are GENUINELY signed by the attacker's own
// (pod-published, key-controlled) issuer, so they sail through Phase A — they are
// rejected specifically for the subject↔issuer disagreement, fail-closed, in
// Phase B (AFTER Phase A, so a bad-proof credential still reports its Phase-A
// code — see the ORDERING case at the bottom). The subject↔issuer anchor also runs
// BEFORE the G1 digest gate and the G2 status gate (both split out of Phase A), so a
// spoofed-subject credential that ALSO fails the digest/status gate still reports
// the precise SUBJECT_ISSUER_MISMATCH — see the PRECEDENCE case.
//
// TWO-PASS ORDERING (the terminal fix for a roborev Medium diagnostic
// phase-ordering finding — NOT a security bypass, since every invalid chain was
// already rejected either way): the verifier runs Phase A for EVERY hop first
// (Pass 1), and only once every hop has passed does it run the per-hop
// subject-issuer/digest/status gates (Pass 2) — so a LATER hop's bad proof is
// never masked by an EARLIER hop's Phase-B/C finding. See the CROSS-HOP case.

import {
  type PresentedChain,
  readBoundAuthorization,
  verifyAgentAuthority,
} from "@jeswr/agent-authz-verifier";
import { buildAgentAuthorizationCredential, issue, type KeyPair } from "@jeswr/solid-vc";
import { beforeAll, describe, expect, it } from "vitest";
import {
  generateActorKey,
  podKeyResolver,
  podStatusResolver,
  publishActorKey,
  runScenario,
  type ScenarioResult,
  VALID_FROM,
  VALID_UNTIL,
} from "../src/scenario/index.js";
import { SVC_AUTHORIZES } from "../src/vocab.js";

const ATTACKER = "https://attacker.example/id#it";
const ATTACKER_KEY_VM = "https://attacker.example/keys#k1";

let base: ScenarioResult;
let attackerSigningKey: KeyPair;

beforeAll(async () => {
  base = await runScenario();
  // The attacker owns a REAL, pod-published, self-controlled issuer key — so their
  // signatures verify and pass the issuer↔key-control gate (G4/G5). The only thing
  // wrong is the subject id they claim.
  attackerSigningKey = await generateActorKey(ATTACKER_KEY_VM);
  await publishActorKey(base.pod, ATTACKER, attackerSigningKey);
});

/** Sign a credential built for `principal` but re-attributed to the attacker issuer. */
async function forgeWithAttackerIssuer(input: {
  principal: string;
  agent: string;
  action: string | readonly string[];
  policy: string;
}) {
  const unsigned = buildAgentAuthorizationCredential({
    principal: input.principal, // → sets subject.id to the SPOOFED (trusted) party
    agent: input.agent,
    action: input.action,
    target: base.cast.records,
    policy: input.policy,
    validFrom: VALID_FROM,
    validUntil: VALID_UNTIL,
  });
  // Re-attribute issuance to the attacker and sign with the attacker's key. The
  // subject id stays the spoofed party; issuer is now the attacker. A genuine,
  // fully-verifiable credential whose subject.id lies about who granted it.
  return issue({ credential: { ...unsigned, issuer: ATTACKER }, key: attackerSigningKey });
}

/** Flip one character of a signed credential's proof value (an invalid signature). */
function tamperProof<T extends { proof: unknown }>(vc: T): T {
  const copy = structuredClone(vc) as T & {
    proof: { proofValue: string } | { proofValue: string }[];
  };
  const proof = Array.isArray(copy.proof) ? copy.proof[0] : copy.proof;
  if (proof !== undefined) {
    const v = proof.proofValue;
    proof.proofValue = v.slice(0, -1) + (v.endsWith("z") ? "A" : "z");
  }
  return copy;
}

/** Verify `chain` against the scenario's trusted root with fresh pod resolvers. */
function verifyChain(chain: PresentedChain) {
  const keyResolver = podKeyResolver(base.pod);
  return verifyAgentAuthority(chain, {
    request: {
      action: "read",
      target: base.cast.records,
      attributes: { purpose: base.cast.purpose, dateTime: base.now.toISOString() },
    },
    rootPrincipal: base.cast.alice,
    now: base.now,
    resolveKey: keyResolver.resolveKey,
    isControlledBy: keyResolver.isControlledBy,
    resolveStatus: podStatusResolver(base.pod, { now: base.now }),
    actor: base.cast.inst, // actor IS the leaf assignee — no second chain needed
  });
}

describe("delegation-trust — the principal is the proof-verified issuer, not subject.id", () => {
  it("SUBJECT-SPOOFED ROOT: attacker-issued credential whose subject.id claims the trusted root → REJECTED (never accepted as the root's grant)", async () => {
    // issuer = attacker (valid signature, key-controlled), subject.id = Alice (the
    // resource owner / trusted root), authorizes = agentA (so the rest of the chain
    // would otherwise line up). The pre-fix reader trusted subject.id and accepted
    // this as Alice's mandate — the impersonation.
    const forgedRoot = await forgeWithAttackerIssuer({
      principal: base.cast.alice,
      agent: base.cast.agentA,
      action: ["read", "grantUse"],
      policy: base.cast.mandateId,
    });
    const r = await verifyChain({
      credentials: [forgedRoot, base.credentials.agreement],
      policies: [base.mandate, base.agreement],
    });
    expect(r.authorized).toBe(false);
    expect(r.phase).toBe("B");
    expect(r.code).toBe("SUBJECT_ISSUER_MISMATCH");
  });

  it("PRECEDENCE: a spoofed-subject credential that ALSO fails the digest gate reports SUBJECT_ISSUER_MISMATCH, not POLICY_INTEGRITY", async () => {
    // `verifyCredential` bundles proof + the G1 digest gate + the G2 status gate, so
    // the verifier splits the digest/status gates OUT of Phase A and runs them AFTER
    // the subject↔issuer anchor. The forged root is attacker-issued (valid proof)
    // with subject.id = Alice AND is presented with raw policy content it carries NO
    // signed `relatedResource` digest for — so the digest gate WOULD deny
    // POLICY_INTEGRITY if it ran first (as the bundled call did). The subject check
    // must win: a spoofed-subject impersonation is reported precisely, never masked
    // by a downstream digest/status code.
    const forgedRoot = await forgeWithAttackerIssuer({
      principal: base.cast.alice,
      agent: base.cast.agentA,
      action: ["read", "grantUse"],
      policy: base.cast.mandateId,
    });
    const r = await verifyChain({
      credentials: [forgedRoot, base.credentials.agreement],
      policies: [base.mandate, base.agreement],
      policyContents: {
        [base.cast.mandateId]: { content: base.policyDocuments.mandate },
        [base.cast.agreementId]: { content: base.policyDocuments.agreement },
      },
    });
    expect(r.authorized).toBe(false);
    expect(r.phase).toBe("B");
    expect(r.code).toBe("SUBJECT_ISSUER_MISMATCH");
  });

  it("SUBJECT-SPOOFED CHILD: attacker-issued hop whose subject.id claims the parent-authorized delegatee → REJECTED", async () => {
    // The mandate authorizes agentA as the delegatee. The attacker issues the
    // agreement hop with subject.id = agentA (spoofing the authorized delegatee)
    // but issuer = attacker. Pre-fix, principal = subject.id = agentA lined the hop
    // up under the mandate; now the subject↔issuer check rejects it.
    const forgedChild = await forgeWithAttackerIssuer({
      principal: base.cast.agentA,
      agent: base.cast.inst,
      action: "read",
      policy: base.cast.agreementId,
    });
    const r = await verifyChain({
      credentials: [base.credentials.mandate, forgedChild],
      policies: [base.mandate, base.agreement],
    });
    expect(r.authorized).toBe(false);
    expect(r.phase).toBe("B");
    expect(r.code).toBe("SUBJECT_ISSUER_MISMATCH");
  });

  it("CHILD ISSUER ≠ PARENT-AUTHORIZED DELEGATEE: a self-consistent hop NOT issued by the authorized delegatee → REJECTED (BINDING_MISMATCH)", async () => {
    // A well-formed (subject.id == issuer == attacker) agreement hop — but the
    // mandate authorized agentA, not the attacker, as the delegatee. The
    // issuer-anchored linkage catches it: principal (= issuer = attacker) ≠ the
    // hop's assigner (agentA, from the policy) and ≠ the parent's authorized
    // delegate. Proves the delegation edge is bound to the proof-verified issuer.
    const selfConsistentRogue = await issue({
      credential: buildAgentAuthorizationCredential({
        principal: ATTACKER, // issuer == subject.id == attacker (self-consistent)
        agent: base.cast.inst,
        action: "read",
        target: base.cast.records,
        policy: base.cast.agreementId,
        validFrom: VALID_FROM,
        validUntil: VALID_UNTIL,
      }),
      key: attackerSigningKey,
    });
    const r = await verifyChain({
      credentials: [base.credentials.mandate, selfConsistentRogue],
      policies: [base.mandate, base.agreement],
    });
    expect(r.authorized).toBe(false);
    expect(r.phase).toBe("B");
    expect(r.code).toBe("BINDING_MISMATCH");
  });

  it("LEGITIMATE SELF-ISSUED still passes: subject.id == issuer for every hop → authorized", async () => {
    const r = await verifyChain({
      credentials: [base.credentials.mandate, base.credentials.agreement],
      policies: [base.mandate, base.agreement],
      policyContents: {
        [base.cast.mandateId]: { content: base.policyDocuments.mandate },
        [base.cast.agreementId]: { content: base.policyDocuments.agreement },
      },
    });
    expect(r.authorized).toBe(true);
    expect(r.phase).toBe("complete");
  });

  it("readBoundAuthorization anchors principal to the proof-verified issuer, NOT a spoofed subject.id", () => {
    // Directly at the reader: even a (here unsigned) credential whose subject.id
    // names the trusted root reports the ISSUER as principal — the trust decision
    // never reads the spoofable subject id.
    const auth = readBoundAuthorization({
      issuer: ATTACKER,
      type: ["AgentAuthorizationCredential"],
      credentialSubject: { id: base.cast.alice, [SVC_AUTHORIZES]: base.cast.agentA },
      proof: {
        type: "DataIntegrityProof",
        cryptosuite: "eddsa-rdfc-2022",
        proofPurpose: "assertionMethod",
        proofValue: "z1",
        verificationMethod: ATTACKER_KEY_VM,
      },
    });
    expect(auth?.principal).toBe(ATTACKER);
    expect(auth?.principal).not.toBe(base.cast.alice);
  });

  it("CROSS-HOP TWO-PASS ORDERING: root hop spoofed subject + child hop bad proof → reports the CHILD's Phase-A code, not the root's SUBJECT_ISSUER_MISMATCH", async () => {
    // The root (mandate) hop has a VALID proof (attacker's own key) but a SPOOFED
    // subject.id (Alice) — on its own this reports SUBJECT_ISSUER_MISMATCH (see
    // SUBJECT-SPOOFED ROOT above). The CHILD (agreement) hop is otherwise
    // legitimate but has a TAMPERED proof (an invalid signature). The two-pass
    // fix must run Phase A for EVERY hop (Pass 1) before ANY hop's Phase-B/C
    // gates (Pass 2) run, so the child's Phase-A failure (INVALID_SIGNATURE) is
    // reported instead of the root's Phase-B finding.
    const forgedRootSpoofed = await forgeWithAttackerIssuer({
      principal: base.cast.alice,
      agent: base.cast.agentA,
      action: ["read", "grantUse"],
      policy: base.cast.mandateId,
    });
    const tamperedChild = tamperProof(base.credentials.agreement);
    const r = await verifyChain({
      credentials: [forgedRootSpoofed, tamperedChild],
      policies: [base.mandate, base.agreement],
    });
    expect(r.authorized).toBe(false);
    expect(r.phase).toBe("A");
    expect(r.code).toBe("INVALID_SIGNATURE");
  });

  it("ORDERING: a BAD-PROOF credential with a spoofed subject reports the Phase-A code, not SUBJECT_ISSUER_MISMATCH", async () => {
    // The subject↔issuer check runs in Phase B, AFTER Phase A — so a credential
    // whose proof does not even verify is denied for the proof, and the Phase-B
    // subject code never masks a Phase-A failure (the sibling package's ordering
    // finding, avoided here by construction).
    const forgedRoot = await forgeWithAttackerIssuer({
      principal: base.cast.alice,
      agent: base.cast.agentA,
      action: ["read", "grantUse"],
      policy: base.cast.mandateId,
    });
    const proof = Array.isArray(forgedRoot.proof) ? forgedRoot.proof[0] : forgedRoot.proof;
    if (proof === undefined) {
      throw new Error("forged credential unexpectedly has no proof");
    }
    const v = proof.proofValue as string;
    const badProof = {
      ...forgedRoot,
      proof: { ...proof, proofValue: v.slice(0, -1) + (v.endsWith("z") ? "A" : "z") },
    };
    const r = await verifyChain({
      credentials: [badProof, base.credentials.agreement],
      policies: [base.mandate, base.agreement],
    });
    expect(r.authorized).toBe(false);
    expect(r.phase).toBe("A");
    expect(r.code).toBe("INVALID_SIGNATURE");
  });
});
