// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T4 (part) — the CAST-PARAMETERISED ODRL policy builders (design §2, §4.2 [3]). These
// are the LIVE variants of `scenario/cast.ts`'s `buildMandate` / `buildAgreement` /
// `buildInstituteInternal`: identical policy STRUCTURE, but every IRI is taken from a live
// {@link LiveCast} rather than the fixed `alice.solid.example` example IRIs. The fixed-CAST
// originals in `scenario/cast.ts` are UNTOUCHED — the deterministic golden masters keep
// their byte-stable example IRIs; this module is purely additive.
//
// Pure data only (no crypto/I/O): the mandate/agreement/institute-internal shapes are the
// same three-hop delegation the §4 scenario proves — Alice → agent A (mandate, read +
// depth-1 grantUse, distribute prohibited); agent A → the institute (agreement, read for a
// stated purpose); institute → agent R (the D9 identity-composition second chain).

import type { OdrlPolicy } from "../odrl.js";
import { ODRLD_PROFILE_IRI } from "../odrl.js";
import { type LiveCast, VALID_UNTIL } from "./cast.js";

/** The root mandate P (Alice → agent A: read + a depth-1 grantUse, distribute prohibited). */
export function buildLiveMandate(cast: LiveCast): OdrlPolicy {
  return {
    id: cast.mandateId,
    type: "Agreement",
    profile: ODRLD_PROFILE_IRI,
    assigner: cast.alice.webId,
    permissions: [
      {
        type: "permission",
        action: "read",
        target: cast.alice.records,
        assignee: cast.agentA.webId,
        constraints: [{ leftOperand: "dateTime", operator: "lteq", rightOperand: VALID_UNTIL }],
      },
      {
        type: "permission",
        action: "grantUse",
        target: cast.alice.records,
        assignee: cast.agentA.webId,
        constraints: [
          { leftOperand: "delegationDepth", operator: "lteq", rightOperand: 1 },
          { leftOperand: "dateTime", operator: "lteq", rightOperand: VALID_UNTIL },
        ],
        duties: [
          { action: "nextPolicy", target: cast.agreementId },
          { action: "inform", target: cast.alice.webId },
        ],
      },
    ],
    prohibitions: [{ type: "prohibition", action: "distribute", target: cast.alice.records }],
  };
}

/** The leaf Agreement (Alice-via-A → the institute: read for a stated purpose). */
export function buildLiveAgreement(cast: LiveCast): OdrlPolicy {
  return {
    id: cast.agreementId,
    type: "Agreement",
    profile: ODRLD_PROFILE_IRI,
    delegatedUnder: cast.mandateId,
    assigner: cast.agentA.webId,
    assignee: cast.institute.webId,
    permissions: [
      {
        type: "permission",
        action: "read",
        target: cast.alice.records,
        assignee: cast.institute.webId,
        constraints: [
          { leftOperand: "purpose", operator: "eq", rightOperand: cast.purpose },
          { leftOperand: "dateTime", operator: "lteq", rightOperand: VALID_UNTIL },
        ],
        duties: [{ action: "delete" }],
      },
    ],
  };
}

/**
 * The institute's INTERNAL authorization (institute → agent R: "our research agent may
 * exercise this for us"). A single-policy chain rooted at the LEAF ASSIGNEE — the D9
 * identity-composition second chain. `assigner` = the institute so the chain's trusted root
 * is the institute (chain₂.root ≡ chain₁.leaf assignee).
 */
export function buildLiveInstituteInternal(cast: LiveCast): OdrlPolicy {
  return {
    id: cast.instituteInternalId,
    type: "Agreement",
    profile: ODRLD_PROFILE_IRI,
    assigner: cast.institute.webId,
    permissions: [
      {
        type: "permission",
        action: "read",
        target: cast.alice.records,
        assignee: cast.agentR.webId,
        constraints: [{ leftOperand: "dateTime", operator: "lteq", rightOperand: VALID_UNTIL }],
      },
    ],
  };
}
