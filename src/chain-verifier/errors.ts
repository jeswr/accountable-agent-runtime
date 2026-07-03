// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The structured error taxonomy for the composed four-phase chain verifier (G7),
// per the Agent Authorization Credentials note's Verification section. Every deny
// carries exactly one code so the golden-master decision matrix pins the precise
// failure, and the recorded decision (trace `decisions/`, G9) is machine-comparable.

/** Which phase of the four-phase verification a result was produced in. */
export type VerifierPhase =
  | "assembly" // extract policies + order the chain root-first (reject cycles/branches/gaps)
  | "A" // credential integrity + validity window (per-credential, one instant)
  | "B" // cross-binding (issuer ≡ subject ≡ assigner; authorizes ≡ next assigner; root ≡ trusted)
  | "C" // status ∪ revocation, fail-closed
  | "D" // the delegation-profile chain walk (evaluateDelegated)
  | "composition" // the D9 identity-composition rule (a second chain rooted at the leaf assignee)
  | "complete"; // authorized

/**
 * The verifier's deny codes. Phase-A codes mirror `@jeswr/solid-vc`'s
 * `VerificationErrorCode`; the rest are the composed layer's own (the note's
 * `CHAIN_MALFORMED` / `BINDING_MISMATCH` / `STATUS_RETRIEVAL_ERROR` /
 * `POLICY_DENIED`, plus the identity-composition and provisional-policy-integrity
 * codes this runtime pins).
 */
export type VerifierErrorCode =
  // assembly
  | "CHAIN_MALFORMED"
  // Phase A (from solid-vc verifyCredential)
  | "MALFORMED"
  | "NO_PROOF"
  | "UNKNOWN_CRYPTOSUITE"
  | "INVALID_SIGNATURE"
  | "EXPIRED"
  | "NOT_YET_VALID"
  | "ISSUER_MISMATCH"
  | "PROOF_PURPOSE_MISMATCH"
  | "UNTRUSTED_ISSUER"
  // Phase B
  | "BINDING_MISMATCH"
  // Phase B — provisional (G1: bare-IRI policy binding; the note rejects it, so a
  // permit carries this marker until solid-vc gains embedded/digest policy binding)
  | "POLICY_INTEGRITY"
  // Phase C
  | "STATUS_RETRIEVAL_ERROR"
  | "REVOKED"
  // Phase D
  | "POLICY_DENIED"
  // composition (D9)
  | "IDENTITY_COMPOSITION_FAILED";

/** The Phase-A codes that `@jeswr/solid-vc`'s `verifyCredential` can return. */
export const PHASE_A_CODES = new Set<VerifierErrorCode>([
  "MALFORMED",
  "NO_PROOF",
  "UNKNOWN_CRYPTOSUITE",
  "INVALID_SIGNATURE",
  "EXPIRED",
  "NOT_YET_VALID",
  "ISSUER_MISMATCH",
  "PROOF_PURPOSE_MISMATCH",
  "UNTRUSTED_ISSUER",
]);
