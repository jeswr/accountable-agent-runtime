// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The accountability trace: writer (activity bundle [G8], chain overlay, decision
// record [G9]) + reader (the auditor's mechanical walk).

// G8 CLOSED (Phase 1): the per-action PROV bundle emitter now lives in
// `@jeswr/solid-odrl` (`actionProvenance`, beside `delegationProvenance`) —
// re-exported through the G10 seam; the runtime's local authoring is deleted.
export type { ActionProvenanceInput } from "../odrl.js";
export { actionProvenance } from "../odrl.js";
export type { DecisionRecordInput, ParsedDecisionRecord } from "./decision-record.js";
export { decisionRecordQuads } from "./decision-record.js";
export type {
  AuditOptions,
  AuditReport,
  AuthorityLink,
  LoadedTrace,
  LoadTraceOptions,
  RecordedDecision,
  ResourceSource,
  StoredResource,
} from "./reader.js";
export { auditArtifact, loadTrace } from "./reader.js";
export type {
  EngagementTrace,
  NamedCredential,
  ResourceSink,
  WrittenArtifact,
} from "./writer.js";
export { writeActivity, writeDecision, writeEngagement } from "./writer.js";
