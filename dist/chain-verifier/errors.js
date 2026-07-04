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
/**
 * The `@jeswr/solid-vc` codes of the G1 policy-content digest gate (raised by the
 * `presentedResources` option of `verifyCredential`). The composed verifier maps
 * either to a `POLICY_INTEGRITY` deny — the credential↔policy-content binding broke.
 */
export const RELATED_RESOURCE_CODES = new Set([
    "RELATED_RESOURCE_MISSING",
    "RELATED_RESOURCE_MISMATCH",
]);
/**
 * The `@jeswr/solid-vc` codes of the G2 Bitstring Status List gate (raised by the
 * `resolveStatus` option of `verifyCredential`). The composed verifier maps each to
 * its Phase-C deny: `STATUS_REVOKED` → `REVOKED`, `STATUS_SUSPENDED` → `SUSPENDED`,
 * `STATUS_UNREACHABLE` → `STATUS_RETRIEVAL_ERROR` (the note's "retrieval failure
 * must deny" fail-closed rule).
 */
export const STATUS_GATE_CODES = new Set([
    "STATUS_REVOKED",
    "STATUS_SUSPENDED",
    "STATUS_UNREACHABLE",
]);
//# sourceMappingURL=errors.js.map