// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The composed four-phase chain verifier (G7) — public surface.

export type { VerifierErrorCode, VerifierPhase } from "./errors.js";
export { PHASE_A_CODES } from "./errors.js";
export type {
  BoundAuthorization,
  PresentedChain,
  VerifyAuthorityOptions,
  VerifyAuthorityResult,
} from "./verifier.js";
export { readBoundAuthorization, verifyAgentAuthority } from "./verifier.js";
