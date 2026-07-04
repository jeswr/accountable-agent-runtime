// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T1 — the LivePod adapter (design §2.2): the Phase-2 replacement for `InMemoryPod`,
// implementing the SAME two seams the scenario/verifier/trace already consume —
// {@link ResourceSink} (`put`) and {@link ResourceSource} (`get`/`list`) — over an
// injected `fetch` (an actor's DPoP-authed fetch for writes, or the loopback guarded
// fetch for the auditor's zero-credential reads). NO scenario logic changes; only the
// I/O is now real HTTP against a live Solid server.
//
// SECURITY POSTURE (all fail-closed, exhaustively tested):
//
//   • SCOPE GUARD — every target URL is checked with `@jeswr/guarded-fetch`'s
//     `assertWithinPodScope(base, url)` BEFORE any byte moves. Writes use
//     `allowRoot:false` (documents are minted strictly UNDER the base; the pod/container
//     root itself is never a write target — it can't be clobbered), reads use
//     `allowRoot:true`. A hostile IRI parsed out of untrusted RDF can therefore never
//     steer a credentialed request out of the configured pod scope (same fail-closed
//     posture as `unstorage-solid` / `y-solid` / `rxdb-solid`). The CANONICAL resolved
//     URL the guard returns is the URL fetched, so `.`/`..`/`%2e%2e` traversal is
//     collapsed before the check and cannot smuggle the target out.
//
//   • REDIRECT REFUSAL — every request is issued `redirect:"manual"`; a 3xx / opaque
//     redirect on a CREDENTIALED request is REFUSED (never followed). A redirect on an
//     authenticated write/read is always a smell (an attacker `302` to another origin
//     to capture the DPoP-bound request), so it fails closed. (The auditor's guarded
//     fetch does its OWN in-policy redirect re-validation upstream; a manual-redirect
//     response only ever reaches here from the no-follow authed transport.)
//
//   • CONDITIONAL WRITES — the FIRST write of a resource sends `If-None-Match:*`
//     (create-only: a demo re-run collides LOUDLY, never silently clobbers); a write to a
//     resource whose ETag this adapter has already observed sends `If-Match:<etag>`
//     (lost-update guard — the read-merge-write ACL path in T4 relies on this).
//
//   • ACL DISCOVERY — {@link LivePod.aclFor} reads the `.acl` location from the response's
//     `Link rel="acl"` header (never assumes the `.acl` suffix), and scope-checks the
//     server-supplied (untrusted) link before returning it.
//
// All RDF parsing goes through `@jeswr/fetch-rdf` (`parseRdf` via `parseTurtle`) +
// `@solid/object`'s `ContainerDataset` — never a bespoke parse (the house rule).

import {
  assertWithinPodScope,
  normalizePodBase,
  podScopedUrl,
  SsrfError,
} from "@jeswr/guarded-fetch";
import { ContainerDataset } from "@solid/object";
import { DataFactory } from "n3";
import { parseTurtle } from "../rdf.js";
import type { ResourceSource, StoredResource } from "../trace/reader.js";
import type { ResourceSink } from "../trace/writer.js";

/** Raised on a non-redirect LivePod I/O failure (unexpected status, conflict, bad ACL link). */
export class LivePodError extends Error {
  /** The HTTP status that produced the failure, when there was a response. */
  readonly status?: number;
  constructor(message: string, options: { status?: number; cause?: unknown } = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "LivePodError";
    if (options.status !== undefined) {
      this.status = options.status;
    }
  }
}

/** The LDP BasicContainer type IRI (for the `Link rel="type"` on container creation). */
const LDP_BASIC_CONTAINER = "http://www.w3.org/ns/ldp#BasicContainer";

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

/** True iff the response is a (refused) redirect: a manual-mode opaque redirect or a 3xx. */
function isRedirect(response: Response): boolean {
  return (
    response.type === "opaqueredirect" ||
    (response.status >= 300 && response.status < 400) ||
    // undici filters a manual redirect to status 0 / type opaqueredirect; a status-0
    // non-redirect (network error) also fails closed here — a 0 is never a success.
    response.status === 0
  );
}

/**
 * A live-pod adapter over HTTP. One instance is bound to ONE fetch (credential) and ONE
 * scope (base); construct separate instances for separate actors/scopes rather than sharing
 * a super-fetch.
 */
export class LivePod implements ResourceSink, ResourceSource {
  private readonly fetchImpl: typeof globalThis.fetch;
  private readonly base: string;
  /** Observed ETags, keyed by canonical URL — drives If-Match vs If-None-Match. */
  private readonly etags = new Map<string, string>();
  /** Containers this adapter has already ensured exist (avoids re-checking each write). */
  private readonly ensured = new Set<string>();

  constructor(options: LivePodOptions) {
    // Throws PodScopeError on a malformed base — fail loudly at config time.
    this.base = normalizePodBase(options.base);
    this.fetchImpl = options.fetch;
  }

  /** The normalised scope this adapter is confined to. */
  get scope(): string {
    return this.base;
  }

  // --- ResourceSink -------------------------------------------------------

  /**
   * PUT a resource. Ensures ancestor containers exist first, then writes conditionally:
   * `If-None-Match:*` for a first write (create-only), `If-Match:<etag>` for a known
   * resource (lost-update guard). Refuses redirects; scope-guards the target with
   * `allowRoot:false`.
   */
  async put(url: string, body: string, contentType: string): Promise<void> {
    const target = assertWithinPodScope(this.base, url, { allowRoot: false });
    await this.ensureAncestors(target);
    const headers: Record<string, string> = { "content-type": contentType };
    const known = this.etags.get(target);
    if (known !== undefined) {
      headers["if-match"] = known;
    } else {
      headers["if-none-match"] = "*";
    }
    const response = await this.fetchImpl(target, {
      method: "PUT",
      headers,
      body,
      redirect: "manual",
    });
    this.assertNoRedirect(response, "PUT", target);
    if (response.status === 412) {
      throw new LivePodError(
        `conditional PUT failed (412) for ${target} — the resource already exists ` +
          "(create-only) or its ETag moved (lost update)",
        { status: 412 },
      );
    }
    if (!response.ok) {
      throw new LivePodError(`PUT ${target} → ${response.status}`, { status: response.status });
    }
    this.rememberEtag(target, response);
  }

  // --- ResourceSource -----------------------------------------------------

  /** GET a resource; `undefined` on 404. Refuses redirects; keeps the ETag (fetch-rdf discipline). */
  async get(url: string): Promise<StoredResource | undefined> {
    const target = assertWithinPodScope(this.base, url, { allowRoot: true });
    const response = await this.fetchImpl(target, {
      method: "GET",
      headers: { accept: "text/turtle, application/ld+json;q=0.9, */*;q=0.1" },
      redirect: "manual",
    });
    this.assertNoRedirect(response, "GET", target);
    if (response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw new LivePodError(`GET ${target} → ${response.status}`, { status: response.status });
    }
    this.rememberEtag(target, response);
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() || "text/turtle";
    const bodyText = await response.text();
    return { body: bodyText, contentType };
  }

  /**
   * List the immediate children of a container: GET it, parse `ldp:contains` via
   * `@jeswr/fetch-rdf` + `@solid/object`'s `ContainerDataset` (never a bespoke parse), and
   * return the in-scope child IRIs. A 404 (no such container) → `[]`.
   */
  async list(prefix: string): Promise<readonly string[]> {
    const container = assertWithinPodScope(this.base, prefix, { allowRoot: true });
    const response = await this.fetchImpl(container, {
      method: "GET",
      headers: { accept: "text/turtle" },
      redirect: "manual",
    });
    this.assertNoRedirect(response, "GET", container);
    if (response.status === 404) {
      return [];
    }
    if (!response.ok) {
      throw new LivePodError(`LIST ${container} → ${response.status}`, { status: response.status });
    }
    const contentType =
      response.headers.get("content-type")?.split(";")[0]?.trim() || "text/turtle";
    const bodyText = await response.text();
    const dataset = await parseTurtle(bodyText, contentType, container);
    const wrapped = new ContainerDataset(dataset, DataFactory);
    const children: string[] = [];
    for (const child of wrapped.container?.contains ?? []) {
      // Fail-closed: drop any child the (untrusted) listing points outside scope.
      const inScope = podScopedUrl(this.base, child.value, { allowRoot: true });
      if (inScope !== undefined) {
        children.push(inScope);
      }
    }
    return children;
  }

  // --- ACL discovery ------------------------------------------------------

  /**
   * Discover a resource's ACL document URL from its `Link rel="acl"` header (never assume
   * the `.acl` suffix). The server-supplied link is scope-checked before being returned, so
   * a hostile `Link` header cannot point the caller's subsequent authed write at another
   * origin.
   *
   * @throws LivePodError if the resource has no `acl` link, or the link is out of scope.
   */
  async aclFor(url: string): Promise<string> {
    const target = assertWithinPodScope(this.base, url, { allowRoot: true });
    const response = await this.fetchImpl(target, { method: "HEAD", redirect: "manual" });
    this.assertNoRedirect(response, "HEAD", target);
    if (!response.ok) {
      throw new LivePodError(`HEAD ${target} → ${response.status}`, { status: response.status });
    }
    const linkHeader = response.headers.get("link");
    const aclRef = linkHeader != null ? parseAclLink(linkHeader) : undefined;
    if (aclRef === undefined) {
      throw new LivePodError(`no 'acl' Link relation on ${target}`);
    }
    // Resolve a possibly-relative acl ref against the resource, then scope-check it.
    const resolved = new URL(aclRef, target).toString();
    const inScope = podScopedUrl(this.base, resolved, { allowRoot: true });
    if (inScope === undefined) {
      throw new LivePodError(`acl link ${resolved} for ${target} is out of pod scope`);
    }
    return inScope;
  }

  // --- Container creation -------------------------------------------------

  /**
   * Ensure a container exists (idempotent). Empty containers (an inbox, an activities
   * container before its first child) must be created explicitly — CSS auto-creates ancestor
   * containers on a nested-resource PUT, but an empty leaf container has no such trigger, and
   * PSS may not auto-create at all. A `GET` decides: present → done; 404 → create-only PUT
   * with the LDP container type. A concurrent-create 412/409 is tolerated (already exists).
   */
  async ensureContainer(url: string): Promise<void> {
    const target = assertWithinPodScope(this.base, url, { allowRoot: true });
    if (!target.endsWith("/")) {
      throw new LivePodError(
        `ensureContainer target must be a container URL (trailing /): ${target}`,
      );
    }
    if (this.ensured.has(target)) {
      return;
    }
    const head = await this.fetchImpl(target, { method: "GET", redirect: "manual" });
    this.assertNoRedirect(head, "GET", target);
    if (head.ok) {
      this.ensured.add(target);
      return;
    }
    if (head.status !== 404) {
      throw new LivePodError(`probe ${target} → ${head.status}`, { status: head.status });
    }
    const created = await this.fetchImpl(target, {
      method: "PUT",
      headers: {
        "content-type": "text/turtle",
        link: `<${LDP_BASIC_CONTAINER}>; rel="type"`,
        "if-none-match": "*",
      },
      redirect: "manual",
    });
    this.assertNoRedirect(created, "PUT", target);
    // 412/409: a concurrent create won the race — the container exists, which is the goal.
    if (!created.ok && created.status !== 412 && created.status !== 409) {
      throw new LivePodError(`create container ${target} → ${created.status}`, {
        status: created.status,
      });
    }
    this.ensured.add(target);
  }

  // --- internals ----------------------------------------------------------

  /** Create every ancestor container of `target` that lies strictly under the base. */
  private async ensureAncestors(target: string): Promise<void> {
    for (const container of ancestorContainers(this.base, target)) {
      await this.ensureContainer(container);
    }
  }

  private assertNoRedirect(response: Response, method: string, target: string): void {
    if (isRedirect(response)) {
      throw new SsrfError(
        `refused a redirect on a credentialed ${method} to ${target} ` +
          `(status ${response.status}, type ${response.type})`,
      );
    }
  }

  private rememberEtag(url: string, response: Response): void {
    const etag = response.headers.get("etag");
    if (etag != null && etag.length > 0) {
      this.etags.set(url, etag);
    }
  }
}

/**
 * The ancestor container URLs of `target` that lie strictly UNDER `base` (base excluded —
 * it is assumed to already exist, and writing it is out of scope), shallowest first. E.g.
 * base `…/alice/`, target `…/alice/a/b/x.ttl` → [`…/alice/a/`, `…/alice/a/b/`].
 */
export function ancestorContainers(base: string, target: string): string[] {
  const normalizedBase = base.endsWith("/") ? base : `${base}/`;
  if (!target.startsWith(normalizedBase)) {
    return [];
  }
  const rest = target.slice(normalizedBase.length);
  const segments = rest.split("/");
  // The last segment is the resource (or "" if target itself is a container); drop it.
  segments.pop();
  const containers: string[] = [];
  let acc = normalizedBase;
  for (const segment of segments) {
    if (segment.length === 0) {
      continue;
    }
    acc = `${acc}${segment}/`;
    containers.push(acc);
  }
  return containers;
}

/**
 * Extract the `acl` relation target from an HTTP `Link` header. Returns the raw (possibly
 * relative) reference from the FIRST `rel="acl"` entry, or `undefined`. Deliberately small
 * and strict: it splits comma-separated links, matches `<ref>; …; rel="acl"` (rel value
 * quoted or bare, order-independent), and returns the angle-bracketed ref.
 */
export function parseAclLink(linkHeader: string): string | undefined {
  // Split on commas that separate link-values. A `<...>` ref cannot contain a comma in the
  // pod paths we deal with, so a naive split is safe for the demo surface.
  for (const part of linkHeader.split(",")) {
    const refMatch = part.match(/<([^>]*)>/);
    const ref = refMatch?.[1];
    if (ref === undefined) {
      continue;
    }
    const relMatch = part.match(/rel\s*=\s*"?([^";]+)"?/i);
    const relValue = relMatch?.[1];
    if (relValue === undefined) {
      continue;
    }
    const rels = relValue.trim().toLowerCase().split(/\s+/);
    if (rels.includes("acl")) {
      return ref;
    }
  }
  return undefined;
}
