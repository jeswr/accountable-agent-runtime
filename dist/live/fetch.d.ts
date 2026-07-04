import { type NodePinningOptions } from "@jeswr/guarded-fetch/node";
/**
 * Is `host` (a URL hostname, not an authority) a loopback name/literal? `localhost`
 * and any `*.localhost` name are loopback by the WHATWG/RFC 6761 rule; an IP literal is
 * classified by `@jeswr/guarded-fetch`'s vetted `isLoopbackAddress` (127/8, ::1, and the
 * IPv4-mapped forms), after canonicalising alternate IPv4 encodings.
 */
export declare function isLoopbackHost(host: string): boolean;
/** True iff `base` is a syntactically valid absolute URL whose host is loopback. */
export declare function isLoopbackBase(base: string): boolean;
/**
 * Fail-closed transport gate for a pod base: an `http:` base is permitted ONLY when its
 * host is loopback (the dev hatch); a NON-loopback `http:` base is a plaintext request to
 * a public host and is refused. `https:` bases are always permitted. Throws {@link
 * SsrfError} on a violation; returns the loopback verdict so the caller can pick the guard
 * posture. Non-http(s) schemes are refused.
 *
 * @throws SsrfError when the base is malformed, a non-http(s) scheme, or plaintext-to-public.
 */
export declare function assertBaseTransport(base: string): {
    readonly loopback: boolean;
};
/**
 * Extra knobs for {@link createDiscoveryFetch}, threaded onto the node DNS-pinning guard
 * (never the `allowLoopback` hatch — that is derived from the base). Derived from the node
 * guard's own {@link NodePinningOptions} (which already omits `fetch`/`pinningFetch`/
 * `dnsLookup`), so a caller cannot pass an option the node guard silently ignores; the
 * DNS-resolution seam is `resolveAll` (used by tests to drive the rebinding case).
 */
export type DiscoveryFetchOptions = Omit<NodePinningOptions, "allowLoopback">;
/**
 * Build the SSRF-guarded fetch for the demo's unauthenticated reads (discovery, protocol
 * documents, status lists, the auditor's trace read). The `allowLoopback` hatch is enabled
 * **iff `base` is a loopback base** ({@link assertBaseTransport}); otherwise the returned
 * fetch is the unmodified production guard. The result is a `typeof globalThis.fetch`, so it
 * threads straight into `@jeswr/solid-vc`'s `createWebIdKeyResolver` / the
 * `createBitstringStatusResolver` / a `@jeswr/fetch-rdf` parse — the exact production
 * resolvers, modulo the one documented flag.
 *
 * DNS-PINNING (rebinding-closed). The harness is Node-only, so the guard is built with
 * `@jeswr/guarded-fetch/node`'s {@link createNodeGuardedFetch} — the FULL SSRF guard wired to
 * an undici DNS-pinning dispatcher (`requireDnsPinning`). This matters because these reads
 * dereference IRIs pulled from UNTRUSTED credentials/container listings: the plain
 * `createGuardedFetch` classifies the hostname's addresses but then lets `globalThis.fetch`
 * RE-RESOLVE at connect time, leaving a DNS-rebinding TOCTOU window (a hostname that classifies
 * public, then rebinds to `169.254.169.254`/an internal address on the socket connect). The
 * node guard's validating lookup is the sole resolver and returns only pre-validated addresses,
 * so a non-loopback base is genuinely the hardened production SSRF path — not merely
 * classified-then-fetched-by-hostname. (For a loopback demo base the window is moot, but pinning
 * is free and keeps the "production code path modulo one flag" claim honest.)
 */
export declare function createDiscoveryFetch(base: string, options?: DiscoveryFetchOptions): typeof globalThis.fetch;
//# sourceMappingURL=fetch.d.ts.map