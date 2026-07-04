// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T1 — the LOOPBACK-GATED discovery/audit fetch (design §2.3).
//
// The live demo's *unauthenticated* reads — agent cards, protocol documents, WebID
// documents, status lists, and the auditor's zero-credential trace read — go through
// `@jeswr/guarded-fetch`'s SSRF policy fetch. Those reads dereference IRIs found in
// (untrusted) credentials and container listings, so they are an SSRF surface and MUST
// stay guarded even against a hostile trace.
//
// ┌──────────────────────────────────────────────────────────────────────────────────┐
// │  THE ONE DEV HATCH — `allowLoopback: true` — AND WHY IT IS FAIL-CLOSED ELSEWHERE.  │
// │                                                                                    │
// │  The demo boots an in-memory Community Solid Server on `http://127.0.0.1:<port>`.  │
// │  The production SSRF guard REFUSES loopback + plaintext `http:` by design (they    │
// │  are the classic SSRF targets). `@jeswr/guarded-fetch`'s `allowLoopback` flag is   │
// │  the sanctioned, narrow dev hatch: it re-permits `http:` AND loopback addresses    │
// │  ONLY — a NON-loopback private address (10.x / 169.254.169.254 / fc00::/7 / …) is  │
// │  STILL refused, and an `http:` host must resolve loopback-only. So the demo         │
// │  exercises the exact production code path modulo this one flag.                    │
// │                                                                                    │
// │  This module sets `allowLoopback` **only when the pod base is itself loopback**    │
// │  ({@link isLoopbackBase}). Any non-loopback base gets the UNMODIFIED production      │
// │  guard (`allowLoopback: false` → https-only, no private/loopback/metadata). A       │
// │  non-loopback `http:` base is refused up front by {@link assertBaseTransport} so    │
// │  the hatch can never silently widen a real deployment.                             │
// └──────────────────────────────────────────────────────────────────────────────────┘
import { isLoopbackAddress, normalizeHostForClassification, SsrfError } from "@jeswr/guarded-fetch";
import { createNodeGuardedFetch } from "@jeswr/guarded-fetch/node";
/**
 * Is `host` (a URL hostname, not an authority) a loopback name/literal? `localhost`
 * and any `*.localhost` name are loopback by the WHATWG/RFC 6761 rule; an IP literal is
 * classified by `@jeswr/guarded-fetch`'s vetted `isLoopbackAddress` (127/8, ::1, and the
 * IPv4-mapped forms), after canonicalising alternate IPv4 encodings.
 */
export function isLoopbackHost(host) {
    const h = host.toLowerCase();
    if (h === "localhost" || h.endsWith(".localhost")) {
        return true;
    }
    return isLoopbackAddress(normalizeHostForClassification(h));
}
/** True iff `base` is a syntactically valid absolute URL whose host is loopback. */
export function isLoopbackBase(base) {
    let url;
    try {
        url = new URL(base);
    }
    catch {
        return false;
    }
    return isLoopbackHost(url.hostname);
}
/**
 * Fail-closed transport gate for a pod base: an `http:` base is permitted ONLY when its
 * host is loopback (the dev hatch); a NON-loopback `http:` base is a plaintext request to
 * a public host and is refused. `https:` bases are always permitted. Throws {@link
 * SsrfError} on a violation; returns the loopback verdict so the caller can pick the guard
 * posture. Non-http(s) schemes are refused.
 *
 * @throws SsrfError when the base is malformed, a non-http(s) scheme, or plaintext-to-public.
 */
export function assertBaseTransport(base) {
    let url;
    try {
        url = new URL(base);
    }
    catch {
        throw new SsrfError(`invalid pod base URL: ${JSON.stringify(base)}`);
    }
    if (url.protocol !== "http:" && url.protocol !== "https:") {
        throw new SsrfError(`pod base must be http(s), got ${url.protocol} in ${base}`);
    }
    const loopback = isLoopbackHost(url.hostname);
    if (url.protocol === "http:" && !loopback) {
        throw new SsrfError(`refusing plaintext http: to a non-loopback host (${url.hostname}); ` +
            "the allowLoopback dev hatch is loopback-only");
    }
    return { loopback };
}
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
export function createDiscoveryFetch(base, options = {}) {
    const { loopback } = assertBaseTransport(base);
    return createNodeGuardedFetch({ ...options, allowLoopback: loopback });
}
//# sourceMappingURL=fetch.js.map