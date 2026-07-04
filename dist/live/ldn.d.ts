/** The AS2 JSON-LD context IRI — the LDN default media-type's context. */
export declare const AS2_CONTEXT = "https://www.w3.org/ns/activitystreams";
/** The AS2 activity types the carrier recognises; any other `type` is dropped fail-closed. */
export declare const KNOWN_LDN_TYPES: readonly ["Offer", "Accept", "Reject", "Announce"];
/** One of the recognised AS2 activity types. */
export type LdnType = (typeof KNOWN_LDN_TYPES)[number];
/** Raised on an LDN carrier failure (bad inbox, refused redirect, out-of-scope location). */
export declare class LdnError extends Error {
    constructor(message: string, options?: {
        cause?: unknown;
    });
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
export declare function buildEnvelope(input: EnvelopeInput): Envelope;
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
/**
 * Discover a receiver's LDN inbox from its WebID document: fetch the WebID document with the
 * given (guarded) fetch, read the `<webid> ldp:inbox <inbox>` triple, and FAIL CLOSED unless
 * the inbox IRI lies within the WebID's own origin (a WebID document cannot point its inbox
 * at a third origin — that would be an open redirect for every sender).
 *
 * @throws LdnError when the document is unreadable, carries no in-origin `ldp:inbox`, or the
 *   inbox is out of the WebID's origin.
 */
export declare function discoverInbox(fetch: typeof globalThis.fetch, webId: string): Promise<string>;
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
export declare function postNotification(options: PostNotificationOptions): Promise<string>;
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
/**
 * Parse + fail-closed-filter ONE notification body. Returns the {@link ReceivedNotification}
 * or `undefined` when any rule rejects it (bad JSON / context / type, or an out-of-origin
 * object IRI). Exposed for exhaustive unit testing of the receiver rules.
 */
export declare function parseNotification(id: string, body: string, allowedObjectOrigins: readonly string[]): ReceivedNotification | undefined;
/**
 * Poll a receiver's inbox: list its children (`ContainerDataset`, never a bespoke parse),
 * GET each, and return the notifications that PASS the §3.3 fail-closed rules — the rest are
 * silently dropped. Ordered by `published` (fallback: notification IRI) so a fold is
 * order-stable.
 */
export declare function readInbox(options: ReadInboxOptions): Promise<ReceivedNotification[]>;
/**
 * Safely dereference an announced object IRI through the receiver's GUARDED fetch, ONLY when
 * it lies within an allowed counterparty origin (a redundant re-check of the {@link
 * readInbox} filter — dereferencing is a fresh SSRF surface, so it is guarded independently).
 * Returns the body + content type, or `undefined` on 404 / an out-of-origin IRI.
 *
 * @throws LdnError on a non-2xx / a refused redirect.
 */
export declare function dereferenceAnnouncedObject(guardedFetch: typeof globalThis.fetch, objectIri: string, allowedObjectOrigins: readonly string[]): Promise<{
    body: string;
    contentType: string;
} | undefined>;
//# sourceMappingURL=ldn.d.ts.map