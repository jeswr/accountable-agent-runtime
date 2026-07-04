import type { ResourceSource, StoredResource } from "../trace/reader.js";
import type { ResourceSink } from "../trace/writer.js";
/** An in-memory pod over a URL→resource map. Sink + Source + a `fetch` double. */
export declare class InMemoryPod implements ResourceSink, ResourceSource {
    private readonly store;
    /** Store (or overwrite) a resource. */
    put(url: string, body: string, contentType: string): void;
    /** Read a resource, or `undefined`. */
    get(url: string): StoredResource | undefined;
    /** True when a resource exists. */
    has(url: string): boolean;
    /** Remove a resource (subsequent fetches 404 — e.g. an unreachable status list). */
    delete(url: string): void;
    /** Every stored URL beginning with `prefix` (a container listing). */
    list(prefix: string): string[];
    /** Every stored URL (for diagnostics / golden snapshots). */
    keys(): string[];
    /**
     * A `fetch`-shaped function backed by the map — the discovery / PD-retrieval
     * seam. Only GET is modelled; an unknown URL is a 404 (never a real request, so
     * there is no SSRF surface in Phase 0). Returns a standard `Response` so
     * `@jeswr/fetch-rdf`/`solid-agent-card` consume it unchanged.
     */
    fetch: typeof globalThis.fetch;
}
//# sourceMappingURL=pod.d.ts.map