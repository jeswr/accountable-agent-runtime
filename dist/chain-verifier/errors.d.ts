/** Which phase of the four-phase verification a result was produced in. */
export type VerifierPhase = "assembly" | "A" | "B" | "C" | "D" | "composition" | "complete";
/**
 * The verifier's deny codes. Phase-A codes mirror `@jeswr/solid-vc`'s
 * `VerificationErrorCode`; the rest are the composed layer's own (the note's
 * `CHAIN_MALFORMED` / `BINDING_MISMATCH` / `STATUS_RETRIEVAL_ERROR` /
 * `POLICY_DENIED`, plus the identity-composition and provisional-policy-integrity
 * codes this runtime pins).
 */
export type VerifierErrorCode = "CHAIN_MALFORMED" | "MALFORMED" | "NO_PROOF" | "UNKNOWN_CRYPTOSUITE" | "INVALID_SIGNATURE" | "EXPIRED" | "NOT_YET_VALID" | "ISSUER_MISMATCH" | "PROOF_PURPOSE_MISMATCH" | "UNTRUSTED_ISSUER" | "BINDING_MISMATCH" | "POLICY_INTEGRITY" | "STATUS_RETRIEVAL_ERROR" | "REVOKED" | "POLICY_DENIED" | "IDENTITY_COMPOSITION_FAILED";
/** The Phase-A codes that `@jeswr/solid-vc`'s `verifyCredential` can return. */
export declare const PHASE_A_CODES: Set<VerifierErrorCode>;
//# sourceMappingURL=errors.d.ts.map