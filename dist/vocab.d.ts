/** RDF / XSD / RDFS / DCTERMS / LDP — the standard vocabularies the trace uses. */
export declare const RDF: "http://www.w3.org/1999/02/22-rdf-syntax-ns#";
export declare const RDF_TYPE: "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
export declare const XSD: "http://www.w3.org/2001/XMLSchema#";
export declare const XSD_DATETIME: "http://www.w3.org/2001/XMLSchema#dateTime";
export declare const RDFS: "http://www.w3.org/2000/01/rdf-schema#";
export declare const RDFS_SEE_ALSO: "http://www.w3.org/2000/01/rdf-schema#seeAlso";
export declare const DCTERMS: "http://purl.org/dc/terms/";
export declare const LDP: "http://www.w3.org/ns/ldp#";
/** PROV-O — the standard provenance vocabulary the auditor's walk consumes. */
export declare const PROV: "http://www.w3.org/ns/prov#";
export declare const PROV_ACTIVITY: "http://www.w3.org/ns/prov#Activity";
export declare const PROV_ASSOCIATION: "http://www.w3.org/ns/prov#Association";
export declare const PROV_WAS_ASSOCIATED_WITH: "http://www.w3.org/ns/prov#wasAssociatedWith";
export declare const PROV_USED: "http://www.w3.org/ns/prov#used";
export declare const PROV_GENERATED: "http://www.w3.org/ns/prov#generated";
export declare const PROV_STARTED_AT_TIME: "http://www.w3.org/ns/prov#startedAtTime";
export declare const PROV_ENDED_AT_TIME: "http://www.w3.org/ns/prov#endedAtTime";
export declare const PROV_QUALIFIED_ASSOCIATION: "http://www.w3.org/ns/prov#qualifiedAssociation";
export declare const PROV_AGENT: "http://www.w3.org/ns/prov#agent";
export declare const PROV_HAD_PLAN: "http://www.w3.org/ns/prov#hadPlan";
export declare const PROV_WAS_DERIVED_FROM: "http://www.w3.org/ns/prov#wasDerivedFrom";
export declare const PROV_WAS_GENERATED_BY: "http://www.w3.org/ns/prov#wasGeneratedBy";
export declare const PROV_ACTED_ON_BEHALF_OF: "http://www.w3.org/ns/prov#actedOnBehalfOf";
export declare const PROV_WAS_ATTRIBUTED_TO: "http://www.w3.org/ns/prov#wasAttributedTo";
/**
 * `@jeswr/solid-vc` AgentAuthorizationCredential subject terms. Not exported from
 * the package's public surface (only `SVC` + `SVC_AGENT_AUTHORIZATION` are), so the
 * runtime's Phase-B cross-binding derives them from the `SVC` namespace — the exact
 * local names `buildAgentAuthorizationCredential` writes into `credentialSubject`.
 */
export declare const SVC: "https://w3id.org/jeswr/solid-vc#";
export declare const SVC_AUTHORIZES: "https://w3id.org/jeswr/solid-vc#authorizes";
export declare const SVC_ACTION: "https://w3id.org/jeswr/solid-vc#action";
export declare const SVC_TARGET: "https://w3id.org/jeswr/solid-vc#target";
export declare const SVC_POLICY: "https://w3id.org/jeswr/solid-vc#policy";
/**
 * The PROVISIONAL decision-record vocabulary (G9, decision D4). The ODRL CG Formal
 * Semantics report model (`PolicyReport`/`RuleReport`/…) is the eventual home, but
 * its namespace is literally "to be defined" (verified 2026-07-03), so binding
 * fail-closed tooling to it is premature. These minimal terms reify exactly the
 * fields of `DelegatedEvaluationResult` under `w3id.org/jeswr/accountable-agent#`,
 * with a documented re-basing plan when the CG namespace lands. DO NOT treat these
 * as stable — they are Phase-0/1 interim only.
 */
export declare const AAR: "https://w3id.org/jeswr/accountable-agent#";
export declare const AAR_DECISION_RECORD: "https://w3id.org/jeswr/accountable-agent#DecisionRecord";
export declare const AAR_ACTIVITY_RECORD: "https://w3id.org/jeswr/accountable-agent#ActivityRecord";
export declare const AAR_REQUEST_AGENT: "https://w3id.org/jeswr/accountable-agent#requestAgent";
export declare const AAR_REQUEST_ACTION: "https://w3id.org/jeswr/accountable-agent#requestAction";
export declare const AAR_REQUEST_TARGET: "https://w3id.org/jeswr/accountable-agent#requestTarget";
export declare const AAR_REQUEST_PURPOSE: "https://w3id.org/jeswr/accountable-agent#requestPurpose";
export declare const AAR_EVALUATED_AT: "https://w3id.org/jeswr/accountable-agent#evaluatedAt";
export declare const AAR_CHAIN_POLICY: "https://w3id.org/jeswr/accountable-agent#chainPolicy";
export declare const AAR_ACTOR_CHAIN_POLICY: "https://w3id.org/jeswr/accountable-agent#actorChainPolicy";
export declare const AAR_ROOT_PRINCIPAL: "https://w3id.org/jeswr/accountable-agent#rootPrincipal";
export declare const AAR_ACTOR: "https://w3id.org/jeswr/accountable-agent#actor";
export declare const AAR_LEAF_ASSIGNEE: "https://w3id.org/jeswr/accountable-agent#leafAssignee";
export declare const AAR_REVOKED_POLICY_CONSULTED: "https://w3id.org/jeswr/accountable-agent#revokedPolicyConsulted";
export declare const AAR_DECISION: "https://w3id.org/jeswr/accountable-agent#decision";
export declare const AAR_PHASE: "https://w3id.org/jeswr/accountable-agent#phase";
export declare const AAR_ERROR_CODE: "https://w3id.org/jeswr/accountable-agent#errorCode";
export declare const AAR_REASON: "https://w3id.org/jeswr/accountable-agent#reason";
export declare const AAR_OUTSTANDING_DUTY: "https://w3id.org/jeswr/accountable-agent#outstandingDuty";
export declare const AAR_WAC_MUTATION: "https://w3id.org/jeswr/accountable-agent#wacMutation";
export declare const AAR_JUSTIFIES: "https://w3id.org/jeswr/accountable-agent#justifies";
//# sourceMappingURL=vocab.d.ts.map