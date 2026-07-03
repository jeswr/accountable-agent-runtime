// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The IRI namespaces + terms the runtime AUTHORS locally (the accountability
// trace: PROV-O activity bundles [G8], the provisional decision-record shape [G9],
// and the solid-vc AgentAuthorizationCredential subject terms it reads in Phase B).
// The ODRL / delegation-profile / PROV terms owned by `@jeswr/solid-odrl` are
// re-exported through the G10 seam (`./odrl.js`), never re-minted here.
/** RDF / XSD / RDFS / DCTERMS / LDP — the standard vocabularies the trace uses. */
export const RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export const RDF_TYPE = `${RDF}type`;
export const XSD = "http://www.w3.org/2001/XMLSchema#";
export const XSD_DATETIME = `${XSD}dateTime`;
export const RDFS = "http://www.w3.org/2000/01/rdf-schema#";
export const RDFS_SEE_ALSO = `${RDFS}seeAlso`;
export const DCTERMS = "http://purl.org/dc/terms/";
export const LDP = "http://www.w3.org/ns/ldp#";
/** PROV-O — the standard provenance vocabulary the auditor's walk consumes. */
export const PROV = "http://www.w3.org/ns/prov#";
export const PROV_ACTIVITY = `${PROV}Activity`;
export const PROV_ASSOCIATION = `${PROV}Association`;
export const PROV_WAS_ASSOCIATED_WITH = `${PROV}wasAssociatedWith`;
export const PROV_USED = `${PROV}used`;
export const PROV_GENERATED = `${PROV}generated`;
export const PROV_STARTED_AT_TIME = `${PROV}startedAtTime`;
export const PROV_ENDED_AT_TIME = `${PROV}endedAtTime`;
export const PROV_QUALIFIED_ASSOCIATION = `${PROV}qualifiedAssociation`;
export const PROV_AGENT = `${PROV}agent`;
export const PROV_HAD_PLAN = `${PROV}hadPlan`;
export const PROV_WAS_DERIVED_FROM = `${PROV}wasDerivedFrom`;
export const PROV_WAS_GENERATED_BY = `${PROV}wasGeneratedBy`;
export const PROV_ACTED_ON_BEHALF_OF = `${PROV}actedOnBehalfOf`;
export const PROV_WAS_ATTRIBUTED_TO = `${PROV}wasAttributedTo`;
/**
 * `@jeswr/solid-vc` AgentAuthorizationCredential subject terms. Not exported from
 * the package's public surface (only `SVC` + `SVC_AGENT_AUTHORIZATION` are), so the
 * runtime's Phase-B cross-binding derives them from the `SVC` namespace — the exact
 * local names `buildAgentAuthorizationCredential` writes into `credentialSubject`.
 */
export const SVC = "https://w3id.org/jeswr/solid-vc#";
export const SVC_AUTHORIZES = `${SVC}authorizes`;
export const SVC_ACTION = `${SVC}action`;
export const SVC_TARGET = `${SVC}target`;
export const SVC_POLICY = `${SVC}policy`;
/**
 * The PROVISIONAL decision-record vocabulary (G9, decision D4). The ODRL CG Formal
 * Semantics report model (`PolicyReport`/`RuleReport`/…) is the eventual home, but
 * its namespace is literally "to be defined" (verified 2026-07-03), so binding
 * fail-closed tooling to it is premature. These minimal terms reify exactly the
 * fields of `DelegatedEvaluationResult` under `w3id.org/jeswr/accountable-agent#`,
 * with a documented re-basing plan when the CG namespace lands. DO NOT treat these
 * as stable — they are Phase-0/1 interim only.
 */
export const AAR = "https://w3id.org/jeswr/accountable-agent#";
export const AAR_DECISION_RECORD = `${AAR}DecisionRecord`;
export const AAR_ACTIVITY_RECORD = `${AAR}ActivityRecord`;
export const AAR_REQUEST_AGENT = `${AAR}requestAgent`;
export const AAR_REQUEST_ACTION = `${AAR}requestAction`;
export const AAR_REQUEST_TARGET = `${AAR}requestTarget`;
export const AAR_REQUEST_PURPOSE = `${AAR}requestPurpose`;
export const AAR_EVALUATED_AT = `${AAR}evaluatedAt`;
export const AAR_CHAIN_POLICY = `${AAR}chainPolicy`;
export const AAR_ACTOR_CHAIN_POLICY = `${AAR}actorChainPolicy`;
export const AAR_ROOT_PRINCIPAL = `${AAR}rootPrincipal`;
export const AAR_ACTOR = `${AAR}actor`;
export const AAR_LEAF_ASSIGNEE = `${AAR}leafAssignee`;
export const AAR_REVOKED_POLICY_CONSULTED = `${AAR}revokedPolicyConsulted`;
export const AAR_DECISION = `${AAR}decision`;
export const AAR_PHASE = `${AAR}phase`;
export const AAR_ERROR_CODE = `${AAR}errorCode`;
export const AAR_REASON = `${AAR}reason`;
export const AAR_OUTSTANDING_DUTY = `${AAR}outstandingDuty`;
export const AAR_WAC_MUTATION = `${AAR}wacMutation`;
export const AAR_JUSTIFIES = `${AAR}justifies`;
//# sourceMappingURL=vocab.js.map