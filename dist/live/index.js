// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// Wave-1 live substrate (T1–T3): the real-HTTP adapters that let the UNCHANGED §4
// scenario / verifier / auditor run against a live Solid pod. Pure additive layer over
// `src/scenario` + `src/trace` (which keep consuming their injected seams).
export { seedAccount } from "./account.js";
export { buildAclDocument, ownerRule } from "./acl.js";
export { createActorSession, createActorSessions, createInteractiveActorSession, } from "./auth.js";
export { actorBasesFor, buildCast, MANDATE_STATUS_INDEX, MISUSE_PURPOSE, PURPOSE, VALID_FROM, VALID_UNTIL, } from "./cast.js";
export { bootCss } from "./css.js";
export { assertBaseTransport, createDiscoveryFetch, isLoopbackBase, isLoopbackHost, } from "./fetch.js";
export { ancestorContainers, LivePod, LivePodError, parseAclLink } from "./pod.js";
export { seedDemo } from "./seed.js";
//# sourceMappingURL=index.js.map