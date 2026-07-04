// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// Wave-1 live substrate (T1–T3): the real-HTTP adapters that let the UNCHANGED §4
// scenario / verifier / auditor run against a live Solid pod. Pure additive layer over
// `src/scenario` + `src/trace` (which keep consuming their injected seams).

export type { SeededAccount } from "./account.js";
export { seedAccount } from "./account.js";
export type { AclModes, AclRule } from "./acl.js";
export { buildAclDocument, ownerRule } from "./acl.js";
export type { ActorCredentials, ActorSession } from "./auth.js";
export {
  createActorSession,
  createActorSessions,
  createInteractiveActorSession,
} from "./auth.js";
export type { ActorBases, LiveActor, LiveActorId, LiveCast } from "./cast.js";
export {
  actorBasesFor,
  buildCast,
  MANDATE_STATUS_INDEX,
  MISUSE_PURPOSE,
  PURPOSE,
  VALID_FROM,
  VALID_UNTIL,
} from "./cast.js";
export type { BootCssOptions, CssServer } from "./css.js";
export { bootCss } from "./css.js";
export type { DiscoveryFetchOptions } from "./fetch.js";
export {
  assertBaseTransport,
  createDiscoveryFetch,
  isLoopbackBase,
  isLoopbackHost,
} from "./fetch.js";
export type { LivePodOptions } from "./pod.js";
export {
  ancestorContainers,
  LivePod,
  LivePodError,
  parentContainer,
  parseAclLink,
} from "./pod.js";
export type { LiveSubstrate, SeedOptions } from "./seed.js";
export { seedDemo } from "./seed.js";
