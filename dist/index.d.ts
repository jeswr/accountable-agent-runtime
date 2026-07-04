/**
 * `@jeswr/accountable-agent-runtime` — the Accountable Web of Agents §4 scenario
 * made executable (Phase 0: deterministic, over test doubles, with REAL crypto).
 *
 * A principal delegates to an agent; the agent discovers a counterparty, negotiates
 * over a hash-pinned RDF/SHACL protocol, is verified by the composed FOUR-PHASE
 * chain verifier (this package's one new component, G7 — including the D9
 * identity-composition rule), receives scoped pod access, acts — and every action
 * leaves a standard, independently verifiable accountability trace an auditor walks
 * back to the delegating principal.
 *
 * Composition (all thin; the packages do the work): `@jeswr/solid-vc` (signed
 * AgentAuthorizationCredentials + Data Integrity), `@jeswr/solid-agent-card`
 * (discovery), `@jeswr/solid-a2a` (the NL→RDF upgrade handshake + SHACL protocol),
 * `@jeswr/solid-odrl`'s agent-delegation profile (`evaluateDelegated` /
 * `delegationProvenance`, via the G10 seam). The runtime adds only the four-phase
 * verifier, the trace writer/reader, and the scripted scenario.
 *
 * The GAP LIST (G1–G15, DESIGN §4) is honoured with LABELLED stubs, never hidden
 * ones. CLOSED in Phase 1: G1 (policy-content digest binding — `solid-vc`
 * `relatedResource` digests verified fail-closed via `presentedResources`; a
 * fully content-bound chain's permit is no longer `policyIntegrityProvisional`),
 * G8 (`actionProvenance` imported from `@jeswr/solid-odrl`), G10 (the delegation
 * profile is merged to `solid-odrl` main). Still open, labelled: G9 a provisional
 * decision-record shape, G11 the in-process carrier, G12 no stock purpose/period
 * shape, G14 the WAC↔agreement linkage recorded in the decision record only,
 * G15 countersigning (mirrored-credential pattern documented).
 *
 * @packageDocumentation
 */
export type { BoundAuthorization, PresentedChain, VerifierErrorCode, VerifierPhase, VerifyAuthorityOptions, VerifyAuthorityResult, } from "./chain-verifier/index.js";
export { PHASE_A_CODES, readBoundAuthorization, verifyAgentAuthority, } from "./chain-verifier/index.js";
export type { ActiveDuty, DelegatedEvaluationResult, OdrlConstraint, OdrlDuty, OdrlPolicy, OdrlRule, RequestContext, } from "./odrl.js";
export { delegationProvenance, evaluateDelegated } from "./odrl.js";
export type { ActorKey, RunScenarioOptions, ScenarioResult, WacGrant } from "./scenario/index.js";
export { buildAgreement, buildInstituteInternal, buildMandate, buildReadRequest, buildRuntimeProtocolDocument, CAST, generateActorKey, InMemoryPod, KeyRing, RUNTIME_PROTOCOL_ID, runScenario, ScenarioRefusal, sameOriginController, VALID_FROM, VALID_UNTIL, } from "./scenario/index.js";
export type { ActionProvenanceInput, AuditOptions, AuditReport, AuthorityLink, DecisionRecordInput, EngagementTrace, LoadedTrace, LoadTraceOptions, NamedCredential, ParsedDecisionRecord, RecordedDecision, ResourceSink, ResourceSource, StoredResource, WrittenArtifact, } from "./trace/index.js";
export { actionProvenance, auditArtifact, decisionRecordQuads, loadTrace, writeActivity, writeDecision, writeEngagement, } from "./trace/index.js";
//# sourceMappingURL=index.d.ts.map