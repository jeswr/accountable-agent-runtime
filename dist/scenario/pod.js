// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The in-memory POD DOUBLE (BUILD-PLAN Phase 0): a `Map<url, {body, contentType}>`
// behind an injectable `fetch`. It is the ONLY thing doubled — the crypto is real
// (D7). It serves as:
//   - a {@link ResourceSink} (the trace writer's `put`);
//   - a {@link ResourceSource} (the auditor reader's `get`/`list`);
//   - a `fetch`-shaped seam for discovery / protocol-document retrieval (the SSRF
//     boundary in production — Phase 2 injects `@jeswr/guarded-fetch`).
//
// NO NETWORK: a `fetch` to a URL not in the map resolves to a 404, never a real
// request. Determinism is total.
/** An in-memory pod over a URL→resource map. Sink + Source + a `fetch` double. */
export class InMemoryPod {
    store = new Map();
    /** Store (or overwrite) a resource. */
    put(url, body, contentType) {
        this.store.set(url, { body, contentType });
    }
    /** Read a resource, or `undefined`. */
    get(url) {
        return this.store.get(url);
    }
    /** True when a resource exists. */
    has(url) {
        return this.store.has(url);
    }
    /** Every stored URL beginning with `prefix` (a container listing). */
    list(prefix) {
        return [...this.store.keys()].filter((url) => url.startsWith(prefix));
    }
    /** Every stored URL (for diagnostics / golden snapshots). */
    keys() {
        return [...this.store.keys()].sort();
    }
    /**
     * A `fetch`-shaped function backed by the map — the discovery / PD-retrieval
     * seam. Only GET is modelled; an unknown URL is a 404 (never a real request, so
     * there is no SSRF surface in Phase 0). Returns a standard `Response` so
     * `@jeswr/fetch-rdf`/`solid-agent-card` consume it unchanged.
     */
    fetch = ((input) => {
        const raw = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
        // A real HTTP client never sends the fragment — strip it before lookup so a
        // WebID like `…/org#id` resolves to its document `…/org`.
        let url = raw;
        try {
            const u = new URL(raw);
            u.hash = "";
            url = u.toString();
        }
        catch {
            // non-absolute URL — leave as-is (will 404 if absent).
        }
        const resource = this.store.get(url);
        if (resource === undefined) {
            return Promise.resolve(new Response(`Not found: ${url}`, { status: 404, statusText: "Not Found" }));
        }
        return Promise.resolve(new Response(resource.body, {
            status: 200,
            headers: { "content-type": resource.contentType },
        }));
    });
}
//# sourceMappingURL=pod.js.map