// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// Key material for the scripted scenario — REAL `@jeswr/solid-vc` crypto (decision
// D7: Phase 0 doubles I/O + the clock, NEVER the signatures). Generated once per
// run; the public keys form the runtime's `resolveKey` seam (G5 stub — Phase 1 a
// document-resolving `resolveWebIdKey`).
import { generateKeyPairForSuite } from "@jeswr/solid-vc";
/** A key ring: verificationMethod IRI → public `CryptoKey`, backing `resolveKey`. */
export class KeyRing {
    keys = new Map();
    /** Register a key pair's public key under its verification method. */
    register(keyPair) {
        this.keys.set(keyPair.verificationMethod, keyPair.publicKey);
    }
    /** The `resolveKey` function the verifier consumes (G5 seam). */
    resolveKey = (verificationMethod) => {
        return this.keys.get(verificationMethod);
    };
}
/** Generate an Ed25519 key pair for the given verification-method IRI. */
export function generateActorKey(verificationMethod) {
    return generateKeyPairForSuite(verificationMethod, "Ed25519");
}
/**
 * The document-resolved issuer↔key controller check (G4 stub): accept a
 * verification method for an issuer when they share an ORIGIN. Phase 1 replaces
 * this with a controller-document `assertionMethod` fetch (SSRF-guarded). Same
 * origin is a conservative Phase-0 stand-in — every actor hosts its key beside its
 * WebID, never cross-origin.
 */
export function sameOriginController(verificationMethod, issuer) {
    try {
        return new URL(verificationMethod).origin === new URL(issuer).origin;
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=keys.js.map