// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// Wave-1 live substrate (T1–T3): the real-HTTP adapters that let the UNCHANGED §4
// scenario / verifier / auditor run against a live Solid pod. Pure additive layer over
// `src/scenario` + `src/trace` (which keep consuming their injected seams).
export { seedAccount } from "./account.js";
export { buildAclDocument, ownerRule } from "./acl.js";
export { AUDIT_REPORT_SCHEMA, AuditUnwalkable, auditLive, exitCodeFor, renderTranscript, } from "./audit.js";
export { createActorSession, createActorSessions, createInteractiveActorSession, } from "./auth.js";
export { actorBasesFor, buildCast, MANDATE_STATUS_INDEX, MISUSE_PURPOSE, PURPOSE, VALID_FROM, VALID_UNTIL, } from "./cast.js";
export { bootCss } from "./css.js";
export { runDemo } from "./demo.js";
export { assertBaseTransport, createDiscoveryFetch, isLoopbackBase, isLoopbackHost, } from "./fetch.js";
export { AS2_CONTEXT, buildEnvelope, dereferenceAnnouncedObject, discoverInbox, KNOWN_LDN_TYPES, LdnError, parseNotification, postNotification, readInbox, } from "./ldn.js";
export { runNegativeActs } from "./negative.js";
export { ancestorContainers, LivePod, LivePodError, parentContainer, parseAclLink, } from "./pod.js";
// Wave-2 (T4–T7): the live §4 demo — cast-parameterised policies, the LDN carrier, the live
// resolvers, the live scenario runner + negative acts, the zero-credential auditor, and the
// one-command harness.
export { buildLiveAgreement, buildLiveInstituteInternal, buildLiveMandate } from "./policies.js";
export { liveKeyResolver, liveStatusResolver } from "./resolvers.js";
export { LiveScenarioRefusal, runLiveScenario } from "./run.js";
export { seedDemo } from "./seed.js";
//# sourceMappingURL=index.js.map