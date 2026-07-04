// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The scripted §4 scenario — public surface.

export {
  buildAgreement,
  buildInstituteInternal,
  buildMandate,
  buildReadRequest,
  CAST,
  VALID_FROM,
  VALID_UNTIL,
} from "./cast.js";
export type { ActorKey } from "./keys.js";
export { generateActorKey, podKeyResolver, publishActorKey } from "./keys.js";
export { InMemoryPod } from "./pod.js";
export { buildRuntimeProtocolDocument, RUNTIME_PROTOCOL_ID } from "./protocol.js";
export type { RunScenarioOptions, ScenarioResult, WacGrant } from "./run.js";
export { runScenario, ScenarioRefusal } from "./run.js";
