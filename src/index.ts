// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
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
 * ones. CLOSED in Phase 1 — the four-phase verifier is now STUB-FREE: G1
 * (policy-content digest binding — `solid-vc` `relatedResource` digests verified
 * fail-closed via `presentedResources`; a fully content-bound chain's permit is
 * no longer `policyIntegrityProvisional`), G2 (the W3C Bitstring Status List
 * gate — Phase C resolves each hop credential's status through solid-vc's
 * `resolveStatus` seam, fail-closed, incl. the resolver-missing case), G4/G5
 * (keys publish into and document-resolve from WebID documents via
 * `publishVerificationMethod` / `createWebIdKeyResolver`; the KeyRing and
 * same-origin-controller stubs are deleted), G8 (`actionProvenance` imported
 * from `@jeswr/solid-odrl`), G10 (the delegation profile is merged to
 * `solid-odrl` main). Still open, labelled: G9 a provisional decision-record
 * VOCABULARY (the shape is real; the terms await the ODRL CG report namespace),
 * G11 the in-process carrier (Phase 2), G12 no stock purpose/period shape,
 * G14 the WAC↔agreement linkage recorded in the decision record only,
 * G15 countersigning (mirrored-credential pattern documented; Phase 2).
 *
 * @packageDocumentation
 */

// The composed four-phase chain verifier (G7) — now consumed from the published
// standalone package rather than vendored in-tree.
export type {
  BoundAuthorization,
  PresentedChain,
  VerifierErrorCode,
  VerifierPhase,
  VerifyAuthorityOptions,
  VerifyAuthorityResult,
} from "@jeswr/agent-authz-verifier";
export {
  PHASE_A_CODES,
  readBoundAuthorization,
  verifyAgentAuthority,
} from "@jeswr/agent-authz-verifier";
// The ODRL delegation-profile surface (the G10 seam) + the runtime's RDF helpers,
// re-exported so consumers of the runtime need not import the seam directly.
export type {
  ActiveDuty,
  DelegatedEvaluationResult,
  OdrlConstraint,
  OdrlDuty,
  OdrlPolicy,
  OdrlRule,
  RequestContext,
} from "./odrl.js";
export { delegationProvenance, evaluateDelegated } from "./odrl.js";

// The scripted §4 scenario over the in-memory pod double.
export type { ActorKey, RunScenarioOptions, ScenarioResult, WacGrant } from "./scenario/index.js";
export {
  buildAgreement,
  buildInstituteInternal,
  buildMandate,
  buildReadRequest,
  buildRuntimeProtocolDocument,
  CAST,
  generateActorKey,
  InMemoryPod,
  MANDATE_STATUS_INDEX,
  podKeyResolver,
  podStatusResolver,
  publishActorKey,
  RUNTIME_PROTOCOL_ID,
  runScenario,
  ScenarioRefusal,
  VALID_FROM,
  VALID_UNTIL,
} from "./scenario/index.js";
// The accountability trace: writer (the solid-odrl activity bundle [G8 closed],
// chain overlay, G9 decision record) + reader (the auditor's mechanical walk).
export type {
  ActionProvenanceInput,
  AuditOptions,
  AuditReport,
  AuthorityLink,
  DecisionRecordInput,
  EngagementTrace,
  LoadedTrace,
  LoadTraceOptions,
  NamedCredential,
  ParsedDecisionRecord,
  RecordedDecision,
  ResourceSink,
  ResourceSource,
  StoredResource,
  WrittenArtifact,
} from "./trace/index.js";
export {
  actionProvenance,
  auditArtifact,
  decisionRecordQuads,
  loadTrace,
  writeActivity,
  writeDecision,
  writeEngagement,
} from "./trace/index.js";
