import type { ResourceSource, StoredResource } from "../trace/reader.js";
import type { ResourceSink } from "../trace/writer.js";
/** Raised on a non-redirect LivePod I/O failure (unexpected status, conflict, bad ACL link). */
export declare class LivePodError extends Error {
    /** The HTTP status that produced the failure, when there was a response. */
    readonly status?: number;
    constructor(message: string, options?: {
        status?: number;
        cause?: unknown;
    });
}
/** Options for {@link LivePod}. */
export interface LivePodOptions {
    /**
     * The actor's authed fetch (writes/reads AS that actor) or the loopback guarded fetch
     * (auditor reads). Threaded through unchanged; LivePod adds the scope + redirect + ETag
     * discipline on top.
     */
    readonly fetch: typeof globalThis.fetch;
    /**
     * The pod scope this adapter is confined to (a container URL — the actor's pod root, an
     * engagement container, or the server root for the multi-pod auditor read). Normalised at
     * construction; every request must resolve within it.
     */
    readonly base: string;
}
/**
 * A live-pod adapter over HTTP. One instance is bound to ONE fetch (credential) and ONE
 * scope (base); construct separate instances for separate actors/scopes rather than sharing
 * a super-fetch.
 */
export declare class LivePod implements ResourceSink, ResourceSource {
    private readonly fetchImpl;
    private readonly base;
    /** Observed ETags, keyed by canonical URL — drives If-Match vs If-None-Match. */
    private readonly etags;
    /** Containers this adapter has already ensured exist (avoids re-checking each write). */
    private readonly ensured;
    constructor(options: LivePodOptions);
    /** The normalised scope this adapter is confined to. */
    get scope(): string;
    /**
     * PUT a resource. Ensures ancestor containers exist first, then writes conditionally:
     * `If-None-Match:*` for a first write (create-only), `If-Match:<etag>` for a known
     * resource (lost-update guard). Refuses redirects; scope-guards the target with
     * `allowRoot:false`.
     */
    put(url: string, body: string, contentType: string): Promise<void>;
    /** GET a resource; `undefined` on 404. Refuses redirects; keeps the ETag (fetch-rdf discipline). */
    get(url: string): Promise<StoredResource | undefined>;
    /**
     * List the immediate children of a container: GET it, parse `ldp:contains` via
     * `@jeswr/fetch-rdf` + `@solid/object`'s `ContainerDataset` (never a bespoke parse), and
     * return the in-scope child IRIs. A 404 (no such container) → `[]`.
     */
    list(prefix: string): Promise<readonly string[]>;
    /**
     * Discover a resource's ACL document URL from its `Link rel="acl"` header (never assume
     * the `.acl` suffix). The server-supplied link is scope-checked before being returned, so
     * a hostile `Link` header cannot point the caller's subsequent authed write at another
     * origin.
     *
     * @throws LivePodError if the resource has no `acl` link, or the link is out of scope.
     */
    aclFor(url: string): Promise<string>;
    /**
     * Ensure a container exists (idempotent). Empty containers (an inbox, an activities
     * container before its first child) must be created explicitly — CSS auto-creates ancestor
     * containers on a nested-resource PUT, but an empty leaf container has no such trigger, and
     * PSS may not auto-create at all. A `GET` decides: present → done; 404 → create-only PUT
     * with the LDP container type. A concurrent-create 412/409 is tolerated (already exists).
     */
    ensureContainer(url: string): Promise<void>;
    /** Create every ancestor container of `target` that lies strictly under the base. */
    private ensureAncestors;
    private assertNoRedirect;
    private rememberEtag;
}
/**
 * The ancestor container URLs of `target` that lie strictly UNDER `base` (base excluded —
 * it is assumed to already exist, and writing it is out of scope), shallowest first. E.g.
 * base `…/alice/`, target `…/alice/a/b/x.ttl` → [`…/alice/a/`, `…/alice/a/b/`].
 */
export declare function ancestorContainers(base: string, target: string): string[];
/**
 * Extract the `acl` relation target from an HTTP `Link` header. Returns the raw (possibly
 * relative) reference from the FIRST `rel="acl"` entry, or `undefined`. Deliberately small
 * and strict: it splits comma-separated links, matches `<ref>; …; rel="acl"` (rel value
 * quoted or bare, order-independent), and returns the angle-bracketed ref.
 */
export declare function parseAclLink(linkHeader: string): string | undefined;
//# sourceMappingURL=pod.d.ts.map