import { type KeyPair, type VerifyCredentialOptions, type WebIdKeyResolver } from "@jeswr/solid-vc";
import type { InMemoryPod } from "./pod.js";
/** A generated actor key + the resolver entry it contributes. */
export interface ActorKey {
    readonly keyPair: KeyPair;
    readonly verificationMethod: string;
}
/** Generate an Ed25519 key pair for the given verification-method IRI. */
export declare function generateActorKey(verificationMethod: string): Promise<KeyPair>;
/**
 * Publish an actor's verification method into the pod (G5, the write side):
 * the controller-side listing (`sec:verificationMethod` + `sec:assertionMethod`)
 * goes into the WebID's OWN document; the key material (`a sec:Multikey`,
 * `sec:controller`, `sec:publicKeyMultibase`) into the key id's OWN document —
 * exactly the two authoritative documents `resolveWebIdKey` reads, fail-closed.
 * Existing document content (e.g. an agent pointer on the org profile) is
 * preserved by a parse→union→re-serialise merge.
 */
export declare function publishActorKey(pod: InMemoryPod, controller: string, key: KeyPair): Promise<void>;
/**
 * The document-resolving `{ resolveKey, isControlledBy }` pair (G4/G5, the read
 * side) over the pod's fetch — solid-vc's `createWebIdKeyResolver`, fail-closed
 * and redirect-refusing. Create a FRESH instance after mutating key documents
 * (the resolver caches documents for its lifetime).
 */
export declare function podKeyResolver(pod: InMemoryPod): WebIdKeyResolver;
/**
 * The CREDENTIAL-STATUS resolver (G2, the read side) over the pod's fetch —
 * solid-vc's `createBitstringStatusResolver` wired to a fresh document-resolving
 * key pair (the hosted status list's OWN signature is verified through the same
 * WebID-document seams). Pass as `resolveStatus` to `verifyAgentAuthority` /
 * `verifyCredential`. `now` bounds the list credential's validity window (pass
 * the single evaluation instant). Build a FRESH one after mutating the hosted
 * list (the key resolver underneath caches documents).
 */
export declare function podStatusResolver(pod: InMemoryPod, options?: {
    readonly now?: Date;
}): NonNullable<VerifyCredentialOptions["resolveStatus"]>;
//# sourceMappingURL=keys.d.ts.map