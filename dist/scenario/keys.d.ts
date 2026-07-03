import { type KeyPair } from "@jeswr/solid-vc";
/** A generated actor key + the resolver entry it contributes. */
export interface ActorKey {
    readonly keyPair: KeyPair;
    readonly verificationMethod: string;
}
/** A key ring: verificationMethod IRI → public `CryptoKey`, backing `resolveKey`. */
export declare class KeyRing {
    private readonly keys;
    /** Register a key pair's public key under its verification method. */
    register(keyPair: KeyPair): void;
    /** The `resolveKey` function the verifier consumes (G5 seam). */
    resolveKey: (verificationMethod: string) => CryptoKey | undefined;
}
/** Generate an Ed25519 key pair for the given verification-method IRI. */
export declare function generateActorKey(verificationMethod: string): Promise<KeyPair>;
/**
 * The document-resolved issuer↔key controller check (G4 stub): accept a
 * verification method for an issuer when they share an ORIGIN. Phase 1 replaces
 * this with a controller-document `assertionMethod` fetch (SSRF-guarded). Same
 * origin is a conservative Phase-0 stand-in — every actor hosts its key beside its
 * WebID, never cross-origin.
 */
export declare function sameOriginController(verificationMethod: string, issuer: string): boolean;
//# sourceMappingURL=keys.d.ts.map