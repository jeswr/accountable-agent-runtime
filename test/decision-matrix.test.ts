// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The GOLDEN-MASTER DECISION MATRIX (BUILD-PLAN Phase 0 step 3; decision D8): the
// happy path AND the negative acts as first-class content. Each case pins the exact
// verdict — phase + error code — so a regression that silently weakens the verifier
// (a fail-open) is caught. Crypto is REAL (a forged signature actually fails to
// verify); only the pod/clock are doubled.

import { issueAgentAuthorization, type VerifiableCredential } from "@jeswr/solid-vc";
import { beforeAll, describe, expect, it } from "vitest";
import {
  type PresentedChain,
  type VerifyAuthorityResult,
  verifyAgentAuthority,
} from "../src/chain-verifier/index.js";
import type { OdrlPolicy, RequestContext } from "../src/odrl.js";
import {
  generateActorKey,
  runScenario,
  type ScenarioResult,
  sameOriginController,
  VALID_FROM,
  VALID_UNTIL,
} from "../src/scenario/index.js";

/** Deep-clone a credential and flip one character of its proof value (a forged hop). */
function forge(vc: VerifiableCredential): VerifiableCredential {
  const copy = structuredClone(vc) as VerifiableCredential & {
    proof: { proofValue: string } | { proofValue: string }[];
  };
  const proof = Array.isArray(copy.proof) ? copy.proof[0] : copy.proof;
  if (proof !== undefined) {
    const v = proof.proofValue;
    // flip the last character to a different base58btc symbol
    proof.proofValue = v.slice(0, -1) + (v.endsWith("z") ? "A" : "z");
  }
  return copy as VerifiableCredential;
}

let base: ScenarioResult;

/** A verify call over the base primary chain with per-case overrides. */
async function verify(overrides: {
  primary?: PresentedChain;
  request?: RequestContext;
  rootPrincipal?: string;
  now?: Date;
  revoked?: readonly string[];
  statusUnreachable?: boolean;
  actor?: string | undefined;
  actorChain?: PresentedChain | undefined;
  maxChainLength?: number;
}): Promise<VerifyAuthorityResult> {
  // The default chains present the RAW issuance policy bytes (G1 enforced path).
  const primary: PresentedChain = overrides.primary ?? {
    credentials: [base.credentials.mandate, base.credentials.agreement],
    policies: [base.mandate, base.agreement],
    policyContents: {
      [base.cast.mandateId]: { content: base.policyDocuments.mandate },
      [base.cast.agreementId]: { content: base.policyDocuments.agreement },
    },
  };
  const actorChain: PresentedChain =
    overrides.actorChain ??
    ({
      credentials: [base.credentials.instituteAgent],
      policies: [base.instituteInternal],
      policyContents: {
        [base.cast.instituteInternalId]: { content: base.policyDocuments.instituteInternal },
      },
    } as PresentedChain);
  return verifyAgentAuthority(primary, {
    request:
      overrides.request ??
      ({
        action: "read",
        target: base.cast.records,
        attributes: {
          purpose: base.cast.purpose,
          dateTime: (overrides.now ?? base.now).toISOString(),
        },
      } as RequestContext),
    rootPrincipal: overrides.rootPrincipal ?? base.cast.alice,
    now: overrides.now ?? base.now,
    resolveKey: base.keyRing.resolveKey,
    isControlledBy: sameOriginController,
    revoked: overrides.revoked ?? [],
    ...(overrides.statusUnreachable !== undefined && {
      statusUnreachable: overrides.statusUnreachable,
    }),
    ...(overrides.maxChainLength !== undefined && { maxChainLength: overrides.maxChainLength }),
    actor: "actor" in overrides ? overrides.actor : base.cast.agentR,
    ...(overrides.actorChain !== undefined
      ? { actorChain: overrides.actorChain }
      : "actorChain" in overrides
        ? {}
        : { actorChain }),
  });
}

beforeAll(async () => {
  base = await runScenario();
});

describe("the four-phase chain verifier — golden-master decision matrix", () => {
  it("HAPPY: the valid chain permits", async () => {
    const r = await verify({});
    expect({ authorized: r.authorized, phase: r.phase, code: r.code }).toEqual({
      authorized: true,
      phase: "complete",
      code: undefined,
    });
  });

  it("HAPPY: actor IS the leaf assignee — no second chain needed", async () => {
    const r = await verify({ actor: base?.cast.inst, actorChain: undefined });
    expect(r.authorized).toBe(true);
  });

  it("FORGED HOP: a tampered signature → Phase A INVALID_SIGNATURE (real crypto)", async () => {
    const r = await verify({
      primary: {
        credentials: [base.credentials.mandate, forge(base.credentials.agreement)],
        policies: [base.mandate, base.agreement],
      },
    });
    expect(r.phase).toBe("A");
    expect(r.code).toBe("INVALID_SIGNATURE");
    expect(r.authorized).toBe(false);
  });

  it("EXPIRED: now after the credential validUntil → Phase A EXPIRED", async () => {
    const r = await verify({ now: new Date("2027-08-01T00:00:00Z") });
    expect(r.phase).toBe("A");
    expect(r.code).toBe("EXPIRED");
  });

  it("NOT YET VALID: now before validFrom → Phase A NOT_YET_VALID", async () => {
    const r = await verify({ now: new Date("2026-01-01T00:00:00Z") });
    expect(r.phase).toBe("A");
    expect(r.code).toBe("NOT_YET_VALID");
  });

  it("CHAIN MALFORMED: a broken delegatedUnder edge → assembly CHAIN_MALFORMED", async () => {
    const brokenAgreement: OdrlPolicy = { ...base.agreement, delegatedUnder: "urn:not:present" };
    const r = await verify({
      primary: {
        credentials: [base.credentials.mandate, base.credentials.agreement],
        policies: [base.mandate, brokenAgreement],
      },
    });
    expect(r.phase).toBe("assembly");
    expect(r.code).toBe("CHAIN_MALFORMED");
  });

  it("BINDING MISMATCH: root credential issuer ≠ trusted root principal → Phase B", async () => {
    const r = await verify({ rootPrincipal: "https://attacker.example/profile#me" });
    expect(r.phase).toBe("B");
    expect(r.code).toBe("BINDING_MISMATCH");
  });

  it("POLICY SUBSTITUTED (G1, enforced): presented policy content ≠ the signed digest → Phase B POLICY_INTEGRITY", async () => {
    // The credentials are genuine, but the agreement hop is PRESENTED with a
    // different policy document (here: the mandate's bytes) — the substitution the
    // bare-IRI binding could not catch. The signed relatedResource digest no longer
    // matches → deny, fail-closed.
    const r = await verify({
      primary: {
        credentials: [base.credentials.mandate, base.credentials.agreement],
        policies: [base.mandate, base.agreement],
        policyContents: {
          [base.cast.mandateId]: { content: base.policyDocuments.mandate },
          [base.cast.agreementId]: { content: base.policyDocuments.mandate }, // substituted
        },
      },
    });
    expect(r.authorized).toBe(false);
    expect(r.phase).toBe("B");
    expect(r.code).toBe("POLICY_INTEGRITY");
  });

  it("POLICY UNBOUND (G1, enforced): content presented but the credential carries NO digest → Phase B POLICY_INTEGRITY", async () => {
    // A bare-IRI credential (no policyContent at issuance) presented WITH content:
    // solid-vc fails closed with RELATED_RESOURCE_MISSING — there is no signed
    // digest to check the presented document against.
    const k2 = await generateActorKey("https://agent-a.example/keys#k2");
    base.keyRing.register(k2);
    const unboundAgreementVc = await issueAgentAuthorization(
      {
        principal: base.cast.agentA,
        agent: base.cast.inst,
        action: "read",
        target: base.cast.records,
        policy: base.cast.agreementId,
        validFrom: VALID_FROM,
        validUntil: VALID_UNTIL,
      },
      k2,
    );
    const r = await verify({
      primary: {
        credentials: [base.credentials.mandate, unboundAgreementVc],
        policies: [base.mandate, base.agreement],
        policyContents: {
          [base.cast.mandateId]: { content: base.policyDocuments.mandate },
          [base.cast.agreementId]: { content: base.policyDocuments.agreement },
        },
      },
    });
    expect(r.authorized).toBe(false);
    expect(r.phase).toBe("B");
    expect(r.code).toBe("POLICY_INTEGRITY");
  });

  it("CONTENT NOT PRESENTED (G1): a chain without raw policy content still permits, but stays policyIntegrityProvisional", async () => {
    const r = await verify({
      primary: {
        credentials: [base.credentials.mandate, base.credentials.agreement],
        policies: [base.mandate, base.agreement],
      },
      actorChain: {
        credentials: [base.credentials.instituteAgent],
        policies: [base.instituteInternal],
      },
    });
    expect(r.authorized).toBe(true);
    expect(r.policyIntegrityProvisional).toBe(true);
  });

  it("HAPPY (G1 enforced): the fully content-bound chain's permit is NOT provisional", async () => {
    const r = await verify({});
    expect(r.authorized).toBe(true);
    expect(r.policyIntegrityProvisional).toBe(false);
    expect(r.actorResult?.policyIntegrityProvisional).toBe(false);
  });

  it("PROVISIONAL PROPAGATES: a content-bound primary chain with a location-trusted ACTOR chain stays provisional", async () => {
    const r = await verify({
      actorChain: {
        credentials: [base.credentials.instituteAgent],
        policies: [base.instituteInternal],
      },
    });
    expect(r.authorized).toBe(true);
    expect(r.policyIntegrityProvisional).toBe(true);
  });

  it("REVOKED: a revoked chain hop → Phase C REVOKED", async () => {
    const r = await verify({ revoked: [base.cast.agreementId] });
    expect(r.phase).toBe("C");
    expect(r.code).toBe("REVOKED");
  });

  it("STATUS UNREACHABLE: fail-closed → Phase C STATUS_RETRIEVAL_ERROR", async () => {
    const r = await verify({ statusUnreachable: true });
    expect(r.phase).toBe("C");
    expect(r.code).toBe("STATUS_RETRIEVAL_ERROR");
  });

  it("OUT OF SCOPE: the actual use falls outside the purpose → Phase D POLICY_DENIED", async () => {
    const r = await verify({
      request: {
        action: "read",
        target: base.cast.records,
        attributes: { purpose: base.cast.misusePurpose, dateTime: base.now.toISOString() },
      },
    });
    expect(r.phase).toBe("D");
    expect(r.code).toBe("POLICY_DENIED");
  });

  it("EXPIRED MIDDLE HOP: a hop whose dateTime window has passed → Phase D POLICY_DENIED", async () => {
    const pastAgreement: OdrlPolicy = {
      ...base.agreement,
      permissions: [
        {
          type: "permission",
          action: "read",
          target: base.cast.records,
          assignee: base.cast.inst,
          constraints: [
            { leftOperand: "purpose", operator: "eq", rightOperand: base.cast.purpose },
            { leftOperand: "dateTime", operator: "lteq", rightOperand: "2026-01-01T00:00:00Z" },
          ],
        },
      ],
    };
    const r = await verify({
      primary: {
        credentials: [base.credentials.mandate, base.credentials.agreement],
        policies: [base.mandate, pastAgreement],
      },
    });
    expect(r.phase).toBe("D");
    expect(r.code).toBe("POLICY_DENIED");
  });

  it("PROHIBITION LAUNDERING: an ancestor prohibition blocks a leaf-permitted action → Phase D", async () => {
    // The leaf now PERMITS distribute, but the mandate PROHIBITS it — the chain
    // must not launder the request around the upstream prohibition.
    const launderAgreement: OdrlPolicy = {
      ...base.agreement,
      permissions: [
        ...(base.agreement.permissions ?? []),
        {
          type: "permission",
          action: "distribute",
          target: base.cast.records,
          assignee: base.cast.inst,
        },
      ],
    };
    const r = await verify({
      primary: {
        credentials: [base.credentials.mandate, base.credentials.agreement],
        policies: [base.mandate, launderAgreement],
      },
      request: { action: "distribute", target: base.cast.records },
    });
    expect(r.phase).toBe("D");
    expect(r.code).toBe("POLICY_DENIED");
  });

  it("OVER LENGTH: chain longer than maxChainLength → Phase D POLICY_DENIED", async () => {
    const r = await verify({ maxChainLength: 1 });
    expect(r.phase).toBe("D");
    expect(r.code).toBe("POLICY_DENIED");
  });

  it("IDENTITY COMPOSITION (missing): actor ≠ leaf assignee, no second chain → denied", async () => {
    const r = await verify({ actor: base?.cast.agentR, actorChain: undefined });
    expect(r.phase).toBe("composition");
    expect(r.code).toBe("IDENTITY_COMPOSITION_FAILED");
  });

  it("IDENTITY COMPOSITION (wrong root): second chain not rooted at the leaf assignee → denied", async () => {
    // Present the Alice-rooted primary chain AS the actor chain — its trusted root
    // would be the leaf assignee (inst), but its root credential issuer is Alice.
    const r = await verify({
      actor: base.cast.agentR,
      actorChain: {
        credentials: [base.credentials.mandate, base.credentials.agreement],
        policies: [base.mandate, base.agreement],
      },
    });
    expect(r.phase).toBe("composition");
    expect(r.code).toBe("IDENTITY_COMPOSITION_FAILED");
  });

  it("IDENTITY COMPOSITION (actor ≠ chain₂ leaf): a correctly-rooted second chain that authorizes a DIFFERENT party is rejected for the actor", async () => {
    // Regression for the roborev round-1 HIGH: the institute chain (rooted at inst,
    // authorizing agentR) must NOT authorize some OTHER acting WebID just because it
    // is rooted correctly. Phase D pins the request to chain₂'s own leaf (agentR), so
    // the actor identity must be checked explicitly (requireLeafAssignee).
    const rogue = "https://institute.example/agents/rogue#it";
    const r = await verify({
      actor: rogue,
      actorChain: {
        credentials: [base.credentials.instituteAgent],
        policies: [base.instituteInternal],
      },
    });
    expect(r.authorized).toBe(false);
    expect(r.phase).toBe("composition");
    expect(r.code).toBe("IDENTITY_COMPOSITION_FAILED");
  });

  it("GOLDEN: the full decision matrix (verdict per case)", async () => {
    const rows: Array<[string, Promise<VerifyAuthorityResult>]> = [
      ["happy", verify({})],
      ["actor-is-leaf-assignee", verify({ actor: base.cast.inst, actorChain: undefined })],
      [
        "forged-hop",
        verify({
          primary: {
            credentials: [base.credentials.mandate, forge(base.credentials.agreement)],
            policies: [base.mandate, base.agreement],
          },
        }),
      ],
      ["expired", verify({ now: new Date("2027-08-01T00:00:00Z") })],
      ["not-yet-valid", verify({ now: new Date("2026-01-01T00:00:00Z") })],
      ["revoked", verify({ revoked: [base.cast.agreementId] })],
      ["status-unreachable", verify({ statusUnreachable: true })],
      ["binding-mismatch", verify({ rootPrincipal: "https://attacker.example/profile#me" })],
      [
        "out-of-scope",
        verify({
          request: {
            action: "read",
            target: base.cast.records,
            attributes: { purpose: base.cast.misusePurpose, dateTime: base.now.toISOString() },
          },
        }),
      ],
      ["over-length", verify({ maxChainLength: 1 })],
      ["identity-composition-missing", verify({ actor: base.cast.agentR, actorChain: undefined })],
      // G1 flipped provisional → ENFORCED (Phase 1): the matrix gains the two
      // content-binding verdicts and every row now pins `provisional` (the
      // policyIntegrityProvisional marker). Existing rows' authorized/phase/code
      // verdicts are UNCHANGED — the check is strictly additive.
      [
        "policy-substituted",
        verify({
          primary: {
            credentials: [base.credentials.mandate, base.credentials.agreement],
            policies: [base.mandate, base.agreement],
            policyContents: {
              [base.cast.mandateId]: { content: base.policyDocuments.mandate },
              [base.cast.agreementId]: { content: base.policyDocuments.mandate },
            },
          },
        }),
      ],
      [
        "content-not-presented",
        verify({
          primary: {
            credentials: [base.credentials.mandate, base.credentials.agreement],
            policies: [base.mandate, base.agreement],
          },
          actorChain: {
            credentials: [base.credentials.instituteAgent],
            policies: [base.instituteInternal],
          },
        }),
      ],
    ];
    const matrix: Record<
      string,
      { authorized: boolean; phase: string; code?: string; provisional: boolean }
    > = {};
    for (const [name, p] of rows) {
      const r = await p;
      matrix[name] = {
        authorized: r.authorized,
        phase: r.phase,
        ...(r.code !== undefined && { code: r.code }),
        provisional: r.policyIntegrityProvisional,
      };
    }
    expect(matrix).toMatchSnapshot();
  });
});
