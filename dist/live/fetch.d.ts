import { type GuardOptions } from "@jeswr/guarded-fetch";
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
/** Extra knobs for {@link createDiscoveryFetch}, threaded onto the guard (never the hatch). */
export type DiscoveryFetchOptions = Omit<GuardOptions, "allowLoopback" | "fetch" | "pinningFetch">;
/**
 * Build the SSRF-guarded fetch for the demo's unauthenticated reads (discovery, protocol
 * documents, status lists, the auditor's trace read). The `allowLoopback` hatch is enabled
 * **iff `base` is a loopback base** ({@link assertBaseTransport}); otherwise the returned
 * fetch is the unmodified production guard. The result is a `typeof globalThis.fetch`, so it
 * threads straight into `@jeswr/solid-vc`'s `createWebIdKeyResolver` / the
 * `createBitstringStatusResolver` / a `@jeswr/fetch-rdf` parse — the exact production
 * resolvers, modulo the one documented flag.
 */
export declare function createDiscoveryFetch(base: string, options?: DiscoveryFetchOptions): typeof globalThis.fetch;
//# sourceMappingURL=fetch.d.ts.map