// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The IRI namespaces + terms the runtime AUTHORS locally (the accountability
// trace: PROV-O activity bundles [G8], the provisional decision-record shape [G9],
// and the solid-vc AgentAuthorizationCredential subject terms it reads in Phase B).
// The ODRL / delegation-profile / PROV terms owned by `@jeswr/solid-odrl` are
// re-exported through the G10 seam (`./odrl.js`), never re-minted here.

/** RDF / XSD / RDFS / DCTERMS / LDP — the standard vocabularies the trace uses. */
export const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#" as const;
export const RDF_TYPE = `${RDF}type` as const;
export const XSD = "http://www.w3.org/2001/XMLSchema#" as const;
export const XSD_DATETIME = `${XSD}dateTime` as const;
export const RDFS = "http://www.w3.org/2000/01/rdf-schema#" as const;
export const RDFS_SEE_ALSO = `${RDFS}seeAlso` as const;
export const DCTERMS = "http://purl.org/dc/terms/" as const;
export const LDP = "http://www.w3.org/ns/ldp#" as const;

/** PROV-O — the standard provenance vocabulary the auditor's walk consumes. */
export const PROV = "http://www.w3.org/ns/prov#" as const;
export const PROV_ACTIVITY = `${PROV}Activity` as const;
export const PROV_ASSOCIATION = `${PROV}Association` as const;
export const PROV_WAS_ASSOCIATED_WITH = `${PROV}wasAssociatedWith` as const;
export const PROV_USED = `${PROV}used` as const;
export const PROV_GENERATED = `${PROV}generated` as const;
export const PROV_STARTED_AT_TIME = `${PROV}startedAtTime` as const;
export const PROV_ENDED_AT_TIME = `${PROV}endedAtTime` as const;
export const PROV_QUALIFIED_ASSOCIATION = `${PROV}qualifiedAssociation` as const;
export const PROV_AGENT = `${PROV}agent` as const;
export const PROV_HAD_PLAN = `${PROV}hadPlan` as const;
export const PROV_WAS_DERIVED_FROM = `${PROV}wasDerivedFrom` as const;
export const PROV_WAS_GENERATED_BY = `${PROV}wasGeneratedBy` as const;
export const PROV_ACTED_ON_BEHALF_OF = `${PROV}actedOnBehalfOf` as const;
export const PROV_WAS_ATTRIBUTED_TO = `${PROV}wasAttributedTo` as const;

/**
 * `@jeswr/solid-vc` AgentAuthorizationCredential subject terms. Not exported from
 * the package's public surface (only `SVC` + `SVC_AGENT_AUTHORIZATION` are), so the
 * runtime's Phase-B cross-binding derives them from the `SVC` namespace — the exact
 * local names `buildAgentAuthorizationCredential` writes into `credentialSubject`.
 */
export const SVC = "https://w3id.org/jeswr/solid-vc#" as const;
export const SVC_AUTHORIZES = `${SVC}authorizes` as const;
export const SVC_ACTION = `${SVC}action` as const;
export const SVC_TARGET = `${SVC}target` as const;
export const SVC_POLICY = `${SVC}policy` as const;

/**
 * The PROVISIONAL decision-record vocabulary (G9, decision D4). The ODRL CG Formal
 * Semantics report model (`PolicyReport`/`RuleReport`/…) is the eventual home, but
 * its namespace is literally "to be defined" (verified 2026-07-03), so binding
 * fail-closed tooling to it is premature. These minimal terms reify exactly the
 * fields of `DelegatedEvaluationResult` under `w3id.org/jeswr/accountable-agent#`,
 * with a documented re-basing plan when the CG namespace lands. DO NOT treat these
 * as stable — they are Phase-0/1 interim only.
 */
export const AAR = "https://w3id.org/jeswr/accountable-agent#" as const;
export const AAR_DECISION_RECORD = `${AAR}DecisionRecord` as const;
export const AAR_ACTIVITY_RECORD = `${AAR}ActivityRecord` as const;
export const AAR_REQUEST_AGENT = `${AAR}requestAgent` as const;
export const AAR_REQUEST_ACTION = `${AAR}requestAction` as const;
export const AAR_REQUEST_TARGET = `${AAR}requestTarget` as const;
export const AAR_REQUEST_PURPOSE = `${AAR}requestPurpose` as const;
export const AAR_EVALUATED_AT = `${AAR}evaluatedAt` as const;
export const AAR_CHAIN_POLICY = `${AAR}chainPolicy` as const;
export const AAR_ACTOR_CHAIN_POLICY = `${AAR}actorChainPolicy` as const;
export const AAR_ROOT_PRINCIPAL = `${AAR}rootPrincipal` as const;
export const AAR_ACTOR = `${AAR}actor` as const;
export const AAR_LEAF_ASSIGNEE = `${AAR}leafAssignee` as const;
export const AAR_REVOKED_POLICY_CONSULTED = `${AAR}revokedPolicyConsulted` as const;
export const AAR_DECISION = `${AAR}decision` as const;
export const AAR_PHASE = `${AAR}phase` as const;
export const AAR_ERROR_CODE = `${AAR}errorCode` as const;
export const AAR_REASON = `${AAR}reason` as const;
export const AAR_OUTSTANDING_DUTY = `${AAR}outstandingDuty` as const;
export const AAR_WAC_MUTATION = `${AAR}wacMutation` as const;
export const AAR_JUSTIFIES = `${AAR}justifies` as const;
