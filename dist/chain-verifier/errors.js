// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The structured error taxonomy for the composed four-phase chain verifier (G7),
// per the Agent Authorization Credentials note's Verification section. Every deny
// carries exactly one code so the golden-master decision matrix pins the precise
// failure, and the recorded decision (trace `decisions/`, G9) is machine-comparable.
/** The Phase-A codes that `@jeswr/solid-vc`'s `verifyCredential` can return. */
export const PHASE_A_CODES = new Set([
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
//# sourceMappingURL=errors.js.map