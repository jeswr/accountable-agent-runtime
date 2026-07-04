import { type VerifyCredentialOptions, type WebIdKeyResolver } from "@jeswr/solid-vc";
/**
 * The document-resolving `{ resolveKey, isControlledBy }` pair (G4/G5) over the demo's
 * discovery fetch. Fail-closed and redirect-refusing (the solid-vc resolver rejects any
 * redirected/cross-URL response even through an injected fetch).
 */
export declare function liveKeyResolver(fetch: typeof globalThis.fetch): WebIdKeyResolver;
/**
 * The credential-status resolver (G2) over the demo's discovery fetch — the hosted Bitstring
 * Status List's OWN signature is verified through a fresh WebID-document key pair on the same
 * fetch. `now` bounds the list credential's validity window (pass the single evaluation
 * instant). Build a FRESH one after mutating the hosted list (the underlying key resolver
 * caches documents).
 */
export declare function liveStatusResolver(fetch: typeof globalThis.fetch, options?: {
    readonly now?: Date;
}): NonNullable<VerifyCredentialOptions["resolveStatus"]>;
//# sourceMappingURL=resolvers.d.ts.map