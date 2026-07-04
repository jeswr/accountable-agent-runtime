// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T4 (part) — the LIVE verification resolvers (design §2.3). These are the EXACT production
// resolvers `@jeswr/solid-vc` ships — `createWebIdKeyResolver` (G4/G5, WebID-document key
// resolution, fail-closed) and `createBitstringStatusResolver` (G2, the Phase-C revocation
// gate) — wired to the demo's loopback-gated SSRF-guarded discovery fetch
// ({@link createDiscoveryFetch}). Nothing pod-double-shaped remains in the verification path:
// keys resolve from the live WebID documents over HTTP, the status list is fetched + its own
// signature verified over the same fetch. The four-phase verifier runs UNMODIFIED against
// them — the demo's central claim (§2.3).
//
// Mirrors `scenario/keys.ts`'s `podKeyResolver`/`podStatusResolver`, but over the guarded
// network fetch rather than the in-memory pod double. A resolver caches documents for its
// lifetime, so callers that mutate a live key/status document (the N3 revocation negative)
// build a FRESH resolver to observe the change.
import { createBitstringStatusResolver, createWebIdKeyResolver, } from "@jeswr/solid-vc";
/**
 * The document-resolving `{ resolveKey, isControlledBy }` pair (G4/G5) over the demo's
 * discovery fetch. Fail-closed and redirect-refusing (the solid-vc resolver rejects any
 * redirected/cross-URL response even through an injected fetch).
 */
export function liveKeyResolver(fetch) {
    return createWebIdKeyResolver({ fetch });
}
/**
 * The credential-status resolver (G2) over the demo's discovery fetch — the hosted Bitstring
 * Status List's OWN signature is verified through a fresh WebID-document key pair on the same
 * fetch. `now` bounds the list credential's validity window (pass the single evaluation
 * instant). Build a FRESH one after mutating the hosted list (the underlying key resolver
 * caches documents).
 */
export function liveStatusResolver(fetch, options = {}) {
    const keyResolver = createWebIdKeyResolver({ fetch });
    return createBitstringStatusResolver({
        resolveKey: keyResolver.resolveKey,
        isControlledBy: keyResolver.isControlledBy,
        fetch,
        ...(options.now !== undefined && { now: options.now }),
    });
}
//# sourceMappingURL=resolvers.js.map