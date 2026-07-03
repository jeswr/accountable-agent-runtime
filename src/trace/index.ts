// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The accountability trace: writer (activity bundle [G8], chain overlay, decision
// record [G9]) + reader (the auditor's mechanical walk).

export type { ActionProvenanceInput } from "./activity.js";
export { actionProvenance } from "./activity.js";
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
