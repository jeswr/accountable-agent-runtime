// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T5 — the G11 LDN CARRIER (design §3). The inter-agent message path is now REAL: the A2A
// upgrade handshake (Offer/Accept/Reject) and the accountability announcements (Announce)
// travel as AS2 JSON-LD envelopes POSTed to a receiver's discovered `ldp:inbox`; the
// receiver POLLS its inbox (it owns it), decodes, and — the security core — TRUSTS THE
// ENVELOPE FOR NOTHING.
//
// SECURITY POSTURE (fail-closed, exhaustively unit-tested with fake fetches):
//
//   • SENDER — posts with its OWN DPoP-authed fetch (an append-only grant on the receiver's
//     inbox, §3.2). The inbox is DISCOVERED from the receiver's WebID document
//     (`ldp:inbox`) and MUST lie within the receiver's WebID origin ({@link discoverInbox});
//     the POST refuses redirects (a 3xx on a credentialed POST is always refused); the
//     201 `Location` (the minted notification IRI) is scope-checked to sit within the inbox.
//
//   • RECEIVER — reads its inbox with its own authed fetch (owner read), then for each
//     notification applies the §3.3 rules, ALL fail-closed:
//       – the body must be JSON with the AS2 `@context` and a KNOWN `type` (Offer / Accept /
//         Reject / Announce); a malformed body / unknown context / unknown type is SKIPPED
//         (dropped, never fatal — untrusted-input discipline);
//       – `actor` is ADVISORY only (authority comes from the four-phase-verified chain in the
//         payload, never from an inbox POST) — carried through, trusted for nothing;
//       – a DEREFERENCEABLE `object` IRI (an announced activity bundle) is ORIGIN-BOUND: it
//         must fall within one of the counterparty's already-verified origins, else the
//         notification is dropped — a notification can never steer the receiver to a third
//         origin (SSRF discipline). Dereferencing it goes through the receiver's own GUARDED
//         fetch ({@link dereferenceAnnouncedObject}), never a raw fetch.
//
// The handshake codec payload rides as the `object` VERBATIM (no re-encode); the receiver
// decodes it with `@jeswr/solid-a2a`'s own validating codec. This module adds NO vocabulary
// (plain LDN + AS2) and stays runtime-local (BUILD-PLAN Phase 2.2) — a `@jeswr/solid-agent`
// carrier is extracted only once a second consumer exists.
//
// All RDF reading (inbox listing, WebID `ldp:inbox` discovery) goes through
// `@jeswr/fetch-rdf` (`parseTurtle`) + `@solid/object`'s `ContainerDataset` / an n3 query —
// never a bespoke parse; nothing here hand-builds a triple.

import { podScopedUrl } from "@jeswr/guarded-fetch";
import type { Quad } from "@rdfjs/types";
import { ContainerDataset } from "@solid/object";
import { DataFactory, Store } from "n3";
import { parseTurtle } from "../rdf.js";

const { namedNode } = DataFactory;

/** The AS2 JSON-LD context IRI — the LDN default media-type's context. */
export const AS2_CONTEXT = "https://www.w3.org/ns/activitystreams";
/** `ldp:inbox` — the receiver's WebID document points at its inbox with this. */
const LDP_INBOX = "http://www.w3.org/ns/ldp#inbox";
/** The AS2 activity types the carrier recognises; any other `type` is dropped fail-closed. */
export const KNOWN_LDN_TYPES = ["Offer", "Accept", "Reject", "Announce"] as const;
/** One of the recognised AS2 activity types. */
export type LdnType = (typeof KNOWN_LDN_TYPES)[number];
const KNOWN_TYPE_SET = new Set<string>(KNOWN_LDN_TYPES);

/** Raised on an LDN carrier failure (bad inbox, refused redirect, out-of-scope location). */
export class LdnError extends Error {
  constructor(message: string, options: { cause?: unknown } = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "LdnError";
  }
}

/** The inputs to build an AS2 envelope. `object` rides VERBATIM (a codec payload or `{id,…}`). */
export interface EnvelopeInput {
  readonly type: LdnType;
  /** The sending agent's WebID — ADVISORY on receipt (authority is the verified chain). */
  readonly actor: string;
  /** The engagement container IRI — the correlation "thread" (§3.3). */
  readonly target: string;
  /** The payload: a handshake codec object VERBATIM, or an announce `{ id, type }`. */
  readonly object: Record<string, unknown> | string;
  /** The notification IRI this responds to (handshake threading). */
  readonly inReplyTo?: string;
  /** The publication instant (defaults to now, ISO). */
  readonly published?: string;
}

/** An AS2 JSON-LD envelope, ready to POST as `application/ld+json`. */
export interface Envelope {
  readonly "@context": string;
  readonly type: LdnType;
  readonly actor: string;
  readonly target: string;
  readonly object: Record<string, unknown> | string;
  readonly inReplyTo?: string;
  readonly published: string;
}

/** Build an AS2 envelope (one shape for both the handshake and the announce, §3.3). */
export function buildEnvelope(input: EnvelopeInput): Envelope {
  return {
    "@context": AS2_CONTEXT,
    type: input.type,
    actor: input.actor,
    target: input.target,
    object: input.object,
    ...(input.inReplyTo !== undefined && { inReplyTo: input.inReplyTo }),
    published: input.published ?? new Date().toISOString(),
  };
}

/** True iff the (parsed JSON) `@context` includes the AS2 context IRI. */
function hasAs2Context(context: unknown): boolean {
  if (context === AS2_CONTEXT) {
    return true;
  }
  if (Array.isArray(context)) {
    return context.some((c) => c === AS2_CONTEXT);
  }
  if (context !== null && typeof context === "object") {
    // A context object with a `@vocab` / default-namespace pointing at AS2.
    return Object.values(context as Record<string, unknown>).some((v) => v === AS2_CONTEXT);
  }
  return false;
}

/**
 * A received notification, AFTER the fail-closed receiver rules. `object` is normalised to
 * either a dereferenceable, ALREADY-ORIGIN-CHECKED IRI reference, or an opaque payload.
 */
export interface ReceivedNotification {
  /** The notification IRI (a child of the receiver's inbox — within the receiver's pod). */
  readonly id: string;
  readonly type: LdnType;
  /** ADVISORY — the claimed sender; authority comes only from the verified payload. */
  readonly actor?: string;
  readonly target?: string;
  readonly inReplyTo?: string;
  readonly published?: string;
  /** A dereferenceable object IRI, present ONLY when origin-checked in-bounds (else dropped). */
  readonly objectIri?: string;
  /** The verbatim codec payload (the handshake case), for the caller's own decoder. */
  readonly payload?: Record<string, unknown>;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : undefined;
}

/** Refuse a redirect / opaque response on a credentialed request (fail-closed). */
function assertNoRedirect(response: Response, what: string): void {
  if (
    response.type === "opaqueredirect" ||
    (response.status >= 300 && response.status < 400) ||
    response.status === 0
  ) {
    throw new LdnError(`refused a redirect on ${what} (status ${response.status})`);
  }
}

/**
 * Discover a receiver's LDN inbox from its WebID document: fetch the WebID document with the
 * given (guarded) fetch, read the `<webid> ldp:inbox <inbox>` triple, and FAIL CLOSED unless
 * the inbox IRI lies within the WebID's own origin (a WebID document cannot point its inbox
 * at a third origin — that would be an open redirect for every sender).
 *
 * @throws LdnError when the document is unreadable, carries no in-origin `ldp:inbox`, or the
 *   inbox is out of the WebID's origin.
 */
export async function discoverInbox(
  fetch: typeof globalThis.fetch,
  webId: string,
): Promise<string> {
  const docUrl = ((): string => {
    const u = new URL(webId);
    u.hash = "";
    return u.toString();
  })();
  const response = await fetch(docUrl, {
    method: "GET",
    headers: { accept: "text/turtle, application/ld+json;q=0.9" },
    redirect: "manual",
  });
  assertNoRedirect(response, `WebID fetch ${docUrl}`);
  if (!response.ok) {
    throw new LdnError(`WebID document ${docUrl} → ${response.status}`);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "text/turtle";
  const body = await response.text();
  const dataset = await parseTurtle(body, contentType, docUrl);
  const store = new Store();
  store.addQuads([...dataset] as Quad[]);
  const inbox = store.getQuads(namedNode(webId), namedNode(LDP_INBOX), null, null)[0]?.object.value;
  if (inbox === undefined) {
    throw new LdnError(`WebID ${webId} declares no ldp:inbox`);
  }
  const webIdOrigin = new URL(webId).origin;
  let inboxUrl: URL;
  try {
    inboxUrl = new URL(inbox);
  } catch {
    throw new LdnError(`WebID ${webId} declares a malformed ldp:inbox ${JSON.stringify(inbox)}`);
  }
  if (inboxUrl.origin !== webIdOrigin) {
    throw new LdnError(
      `refusing an out-of-origin ldp:inbox ${inbox} for WebID ${webId} (origin ${webIdOrigin})`,
    );
  }
  return inboxUrl.toString();
}

/** Options for {@link postNotification}. */
export interface PostNotificationOptions {
  /** The sender's DPoP-authed fetch (append grant on the receiver's inbox). */
  readonly fetch: typeof globalThis.fetch;
  /** The receiver's discovered inbox container (from {@link discoverInbox}). */
  readonly inbox: string;
  /** The envelope to POST. */
  readonly envelope: Envelope;
}

/**
 * POST an envelope to a receiver's inbox as `application/ld+json` (an LDP POST that mints a
 * child resource). Refuses redirects; requires a 201/2xx; returns the minted notification IRI
 * (the `Location`), scope-checked to sit within the inbox container.
 *
 * @throws LdnError on a non-2xx, a refused redirect, or a `Location` outside the inbox.
 */
export async function postNotification(options: PostNotificationOptions): Promise<string> {
  const { fetch, inbox, envelope } = options;
  const response = await fetch(inbox, {
    method: "POST",
    headers: { "content-type": "application/ld+json" },
    body: JSON.stringify(envelope),
    redirect: "manual",
  });
  assertNoRedirect(response, `POST ${inbox}`);
  if (!response.ok) {
    throw new LdnError(`POST notification to ${inbox} → ${response.status}`);
  }
  const location = response.headers.get("location");
  if (location === null || location.length === 0) {
    throw new LdnError(`POST to ${inbox} returned no Location`);
  }
  const resolved = new URL(location, inbox).toString();
  // The minted notification MUST be within the inbox container (never elsewhere).
  const inScope = podScopedUrl(inbox, resolved, { allowRoot: false });
  if (inScope === undefined) {
    throw new LdnError(`POST to ${inbox} minted an out-of-inbox Location ${resolved}`);
  }
  return inScope;
}

/** Options for {@link readInbox}. */
export interface ReadInboxOptions {
  /** The receiver's authed fetch (owner read of its own inbox). */
  readonly fetch: typeof globalThis.fetch;
  /** The receiver's inbox container. */
  readonly inbox: string;
  /**
   * The counterparty origins a dereferenceable `object` IRI may fall within (§3.3). An
   * announced object outside every allowed origin is DROPPED (its notification returns with
   * no `objectIri`). Origins are compared as WHATWG URL origins (scheme+host+port).
   */
  readonly allowedObjectOrigins: readonly string[];
}

/** GET a resource with the receiver's authed fetch; refuse redirects; text or undefined on 404. */
async function getText(
  fetch: typeof globalThis.fetch,
  url: string,
): Promise<{ body: string; contentType: string } | undefined> {
  const response = await fetch(url, {
    method: "GET",
    headers: { accept: "application/ld+json, text/turtle;q=0.9, */*;q=0.1" },
    redirect: "manual",
  });
  assertNoRedirect(response, `GET ${url}`);
  if (response.status === 404) {
    return undefined;
  }
  if (!response.ok) {
    throw new LdnError(`GET ${url} → ${response.status}`);
  }
  const contentType = response.headers.get("content-type")?.split(";")[0]?.trim() || "";
  return { body: await response.text(), contentType };
}

/**
 * Parse + fail-closed-filter ONE notification body. Returns the {@link ReceivedNotification}
 * or `undefined` when any rule rejects it (bad JSON / context / type, or an out-of-origin
 * object IRI). Exposed for exhaustive unit testing of the receiver rules.
 */
export function parseNotification(
  id: string,
  body: string,
  allowedObjectOrigins: readonly string[],
): ReceivedNotification | undefined {
  let parsed: unknown;
  try {
    parsed = JSON.parse(body);
  } catch {
    return undefined; // malformed → skip (never fatal)
  }
  const record = asRecord(parsed);
  if (record === undefined) {
    return undefined;
  }
  if (!hasAs2Context(record["@context"])) {
    return undefined; // wrong / missing @context → skip
  }
  const type = record.type;
  if (typeof type !== "string" || !KNOWN_TYPE_SET.has(type)) {
    return undefined; // unknown type → skip
  }
  const actor = typeof record.actor === "string" ? record.actor : undefined;
  const target = typeof record.target === "string" ? record.target : undefined;
  const inReplyTo = typeof record.inReplyTo === "string" ? record.inReplyTo : undefined;
  const published = typeof record.published === "string" ? record.published : undefined;

  // Normalise `object`: a string IRI, an `{ id, … }` reference, or an opaque codec payload.
  let objectIri: string | undefined;
  let payload: Record<string, unknown> | undefined;
  const object = record.object;
  if (typeof object === "string") {
    objectIri = object;
  } else {
    const objRecord = asRecord(object);
    if (objRecord !== undefined) {
      const objId = objRecord.id;
      if (typeof objId === "string") {
        objectIri = objId;
      } else {
        payload = objRecord; // a handshake codec payload (no dereferenceable id)
      }
    }
  }

  // ORIGIN-BIND a dereferenceable object IRI — an out-of-origin IRI drops the WHOLE
  // notification (fail-closed: a notification steering the receiver elsewhere is hostile,
  // not merely a bad field).
  if (objectIri !== undefined) {
    let objectOrigin: string;
    try {
      objectOrigin = new URL(objectIri).origin;
    } catch {
      return undefined; // malformed object IRI → skip
    }
    if (!allowedObjectOrigins.includes(objectOrigin)) {
      return undefined;
    }
  }

  return {
    id,
    type: type as LdnType,
    ...(actor !== undefined && { actor }),
    ...(target !== undefined && { target }),
    ...(inReplyTo !== undefined && { inReplyTo }),
    ...(published !== undefined && { published }),
    ...(objectIri !== undefined && { objectIri }),
    ...(payload !== undefined && { payload }),
  };
}

/**
 * Poll a receiver's inbox: list its children (`ContainerDataset`, never a bespoke parse),
 * GET each, and return the notifications that PASS the §3.3 fail-closed rules — the rest are
 * silently dropped. Ordered by `published` (fallback: notification IRI) so a fold is
 * order-stable.
 */
export async function readInbox(options: ReadInboxOptions): Promise<ReceivedNotification[]> {
  const { fetch, inbox, allowedObjectOrigins } = options;
  const listing = await getText(fetch, inbox);
  if (listing === undefined) {
    return [];
  }
  const dataset = await parseTurtle(listing.body, listing.contentType || "text/turtle", inbox);
  const container = new ContainerDataset(dataset, DataFactory);
  const childIris: string[] = [];
  for (const child of container.container?.contains ?? []) {
    // Fail-closed: only children strictly within the inbox container are read.
    const inScope = podScopedUrl(inbox, child.value, { allowRoot: false });
    if (inScope !== undefined) {
      childIris.push(inScope);
    }
  }
  const received: ReceivedNotification[] = [];
  for (const iri of childIris) {
    const doc = await getText(fetch, iri);
    if (doc === undefined) {
      continue;
    }
    const notification = parseNotification(iri, doc.body, allowedObjectOrigins);
    if (notification !== undefined) {
      received.push(notification);
    }
  }
  received.sort((a, b) => {
    const ap = a.published ?? "";
    const bp = b.published ?? "";
    return ap === bp ? a.id.localeCompare(b.id) : ap.localeCompare(bp);
  });
  return received;
}

/**
 * Safely dereference an announced object IRI through the receiver's GUARDED fetch, ONLY when
 * it lies within an allowed counterparty origin (a redundant re-check of the {@link
 * readInbox} filter — dereferencing is a fresh SSRF surface, so it is guarded independently).
 * Returns the body + content type, or `undefined` on 404 / an out-of-origin IRI.
 *
 * @throws LdnError on a non-2xx / a refused redirect.
 */
export async function dereferenceAnnouncedObject(
  guardedFetch: typeof globalThis.fetch,
  objectIri: string,
  allowedObjectOrigins: readonly string[],
): Promise<{ body: string; contentType: string } | undefined> {
  let origin: string;
  try {
    origin = new URL(objectIri).origin;
  } catch {
    return undefined;
  }
  if (!allowedObjectOrigins.includes(origin)) {
    return undefined; // fail-closed: never dereference an out-of-origin object
  }
  return getText(guardedFetch, objectIri);
}
