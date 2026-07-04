// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The scripted §4 cast (SCENARIO) — the IRIs, and pure builders for the ODRL
// policies + the request. Deterministic data only; no crypto/I/O here (the run
// wires keys + the pod). Kept separate so the decision-matrix tests can build
// VARIANTS (a forged hop, an out-of-scope request, an over-depth chain) off the
// same base.

import type { OdrlPolicy, RequestContext } from "../odrl.js";
import { ODRLD_PROFILE_IRI } from "../odrl.js";

/** The fixed evaluation windows used throughout (a one-year grant). */
export const VALID_FROM = "2026-07-03T00:00:00Z" as const;
export const VALID_UNTIL = "2027-07-03T00:00:00Z" as const;

/** The mandate credential's bit position in Alice's revocation status list (G2). */
export const MANDATE_STATUS_INDEX = 42;

/** The cast IRIs (SCENARIO). */
export const CAST = {
  alice: "https://alice.solid.example/profile/card#me",
  aliceKeyVm: "https://alice.solid.example/keys#k1",
  aliceProfileDoc: "https://alice.solid.example/profile/card",

  agentA: "https://agent-a.example/id#it",
  agentAKeyVm: "https://agent-a.example/keys#k1",

  inst: "https://institute.example/org#id",
  instKeyVm: "https://institute.example/keys#k1",
  instProfileDoc: "https://institute.example/org",

  agentR: "https://institute.example/agents/research#it",
  agentRDoc: "https://institute.example/agents/research",

  records: "https://alice.solid.example/data/records.ttl",
  purpose: "https://w3id.org/dpv#ResearchAndDevelopment",
  misusePurpose: "https://w3id.org/dpv#DirectMarketing",

  engagementBase: "https://alice.solid.example/agents/engagements/e1/",
  aliceInbox: "https://alice.solid.example/inbox/",

  mandateId: "https://alice.solid.example/agents/engagements/e1/mandate.ttl#policy",
  agreementId: "https://alice.solid.example/agents/engagements/e1/agreement.ttl#policy",
  instituteInternalId: "https://institute.example/policies/internal-e1.ttl#policy",

  // The W3C Bitstring Status List credential Alice hosts (G2): the mandate
  // credential's `credentialStatus` entry points here, at MANDATE_STATUS_INDEX.
  statusListUrl: "https://alice.solid.example/status/e1-revocation.json",

  derivedArtifact: "https://institute.example/derived/summary-2027.ttl",
} as const;

/** The root mandate P (Alice → agent A: read + a depth-1 grantUse, distribute prohibited). */
export function buildMandate(): OdrlPolicy {
  return {
    id: CAST.mandateId,
    type: "Agreement",
    profile: ODRLD_PROFILE_IRI,
    assigner: CAST.alice,
    permissions: [
      {
        type: "permission",
        action: "read",
        target: CAST.records,
        assignee: CAST.agentA,
        constraints: [{ leftOperand: "dateTime", operator: "lteq", rightOperand: VALID_UNTIL }],
      },
      {
        type: "permission",
        action: "grantUse",
        target: CAST.records,
        assignee: CAST.agentA,
        constraints: [
          { leftOperand: "delegationDepth", operator: "lteq", rightOperand: 1 },
          { leftOperand: "dateTime", operator: "lteq", rightOperand: VALID_UNTIL },
        ],
        duties: [
          { action: "nextPolicy", target: CAST.agreementId },
          { action: "inform", target: CAST.alice },
        ],
      },
    ],
    prohibitions: [{ type: "prohibition", action: "distribute", target: CAST.records }],
  };
}

/** The leaf Agreement (Alice-via-A → the institute: read for a stated purpose). */
export function buildAgreement(): OdrlPolicy {
  return {
    id: CAST.agreementId,
    type: "Agreement",
    profile: ODRLD_PROFILE_IRI,
    delegatedUnder: CAST.mandateId,
    assigner: CAST.agentA,
    assignee: CAST.inst,
    permissions: [
      {
        type: "permission",
        action: "read",
        target: CAST.records,
        assignee: CAST.inst,
        constraints: [
          { leftOperand: "purpose", operator: "eq", rightOperand: CAST.purpose },
          { leftOperand: "dateTime", operator: "lteq", rightOperand: VALID_UNTIL },
        ],
        duties: [{ action: "delete" }],
      },
    ],
  };
}

/**
 * The institute's INTERNAL authorization (inst → agentR: "our research agent may
 * exercise this for us"). A single-policy chain rooted at the LEAF ASSIGNEE — the
 * D9 identity-composition second chain. `assigner` = inst so the chain's trusted
 * root is the institute (chain₂.root ≡ chain₁.leaf assignee).
 */
export function buildInstituteInternal(): OdrlPolicy {
  return {
    id: CAST.instituteInternalId,
    type: "Agreement",
    profile: ODRLD_PROFILE_IRI,
    assigner: CAST.inst,
    permissions: [
      {
        type: "permission",
        action: "read",
        target: CAST.records,
        assignee: CAST.agentR,
        constraints: [{ leftOperand: "dateTime", operator: "lteq", rightOperand: VALID_UNTIL }],
      },
    ],
  };
}

/** The read request R performs (SCENARIO step 4/7), with a stated purpose + instant. */
export function buildReadRequest(purpose: string, now: Date): RequestContext {
  return {
    action: "read",
    target: CAST.records,
    attributes: { purpose, dateTime: now.toISOString() },
  };
}
