// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T3 — per-actor headless auth (design §2.1). Each live actor (alice / agent-a /
// institute / agent-r) authenticates to the pod's IdP with the CSS `.account`
// **client-credentials** grant, exchanged for a **DPoP-bound** (RFC 9449) access token
// via `@jeswr/solid-dpop`. The credential is minted server-side against the actor's
// WebID, so the token's `webid` claim IS that actor's IRI — WAC/ACL on the pod sees the
// right principal, which is the whole point of one account per actor (§1.2).
//
// SECRET DISCIPLINE (restated as acceptance criteria; all are already the package
// defaults). The client-credentials `{id, secret}` live ONLY in this process's memory:
//   • never logged (this module has NO console/logging of any kind);
//   • never placed in a URL or query string (they ride the OAuth Basic header inside
//     `@jeswr/solid-dpop`);
//   • never persisted — `@jeswr/solid-dpop`'s on-disk `StoredSession` path is NOT used;
//     the demo is ephemeral (in-memory CSS forgets on teardown).
// One fresh DPoP keypair per actor per run; `authedFetch` mints a per-request proof with
// the `ath` binding and transparently re-mints an expired token via the held credentials.
//
// REDIRECT REFUSAL. The underlying transport is pinned to `redirect: "manual"`, so a 3xx
// on a credentialed request is surfaced (never auto-followed) — {@link LivePod} treats it
// as a refusal. A credentialed request must never chase a `Location` to another origin.
//
// The `@jeswr/solid-openid-client` interactive authorization-code / PKCE path is the
// documented seam for the later "maintainer's real WebID" variant (§7); it is a STUB
// here ({@link createInteractiveActorSession}) — reserved, not built.

import {
  authedFetch,
  type ClientCredentials,
  createSession,
  type FetchLike,
  type SolidSessionState,
} from "@jeswr/solid-dpop";
import { assertBaseTransport } from "./fetch.js";

/** A live actor's identity + the client-credentials that authenticate it. */
export interface ActorCredentials {
  /** The actor's WebID — the `webid` claim the minted DPoP token carries. */
  readonly webId: string;
  /** The CSS client-credentials `{issuer, id, secret}` for this actor's account. */
  readonly credentials: ClientCredentials;
}

/** A ready-to-use per-actor authenticated session. */
export interface ActorSession {
  /** The authenticated actor's WebID. */
  readonly webId: string;
  /**
   * A DPoP-attaching, redirect-refusing `fetch` bound to this actor. Hand it to exactly the
   * component acting AS this actor (never a shared super-fetch): the WAC grant uses Alice's,
   * the record read uses agent-r's. Threads straight into {@link LivePod}.
   */
  readonly fetch: typeof globalThis.fetch;
  /** The raw session state (token + keypair). Exposed for diagnostics/tests, not persistence. */
  readonly state: SolidSessionState;
}

/** The transport for the credentialed path: refuse redirects (never chase a `Location`). */
const noFollowFetch: FetchLike = (input, init) =>
  globalThis.fetch(input, {
    method: init?.method,
    headers: init?.headers,
    body: init?.body as BodyInit | undefined,
    redirect: "manual",
  });

/** Normalise a `RequestInfo | URL` to its string URL. */
function urlOf(input: RequestInfo | URL): string {
  if (typeof input === "string") {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

/** Normalise a `HeadersInit` to a plain lower-cased record (`@jeswr/solid-dpop`'s shape). */
function headerRecordOf(init?: HeadersInit): Record<string, string> {
  const out: Record<string, string> = {};
  if (init === undefined) {
    return out;
  }
  const headers = new Headers(init);
  headers.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/**
 * Build the actor's `typeof globalThis.fetch` over `@jeswr/solid-dpop`'s `authedFetch`:
 * attaches `Authorization: DPoP <token>` + a fresh per-request proof, handles the RFC 9449
 * §8 nonce challenge, and re-mints an expired token via the held credentials. The underlying
 * transport refuses redirects.
 */
function actorFetch(state: SolidSessionState, creds: ClientCredentials): typeof globalThis.fetch {
  const bound = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = urlOf(input);
    const method = (init?.method ?? "GET").toUpperCase();
    const headers = headerRecordOf(init?.headers);
    const body = init?.body;
    // The runtime only ever sends string bodies over the authed fetch (serialised RDF /
    // JSON). A non-string/Uint8Array body would be a programming error here.
    const requestInit: { headers?: Record<string, string>; body?: string | Uint8Array } = {
      headers,
    };
    if (typeof body === "string" || body instanceof Uint8Array) {
      requestInit.body = body;
    } else if (body != null) {
      throw new TypeError("actor fetch supports only string / Uint8Array request bodies");
    }
    return authedFetch(state, creds, method, url, requestInit, noFollowFetch);
  };
  return bound as typeof globalThis.fetch;
}

/**
 * Create a headless, DPoP-bound session for one actor: generate a fresh keypair, exchange
 * the client-credentials for a DPoP-bound access token (nonce-retry handled), and return the
 * actor's WebID + a redirect-refusing authed `fetch`.
 */
export async function createActorSession(actor: ActorCredentials): Promise<ActorSession> {
  // Fail closed BEFORE the token exchange: a non-loopback http: issuer would carry the
  // client-credentials Basic header + DPoP token over plaintext. Refuse it (roborev High).
  assertBaseTransport(actor.credentials.issuer);
  const state = await createSession(actor.credentials, noFollowFetch);
  return { webId: actor.webId, fetch: actorFetch(state, actor.credentials), state };
}

/** Create a session per actor (parallel). Keys are the caller's actor labels. */
export async function createActorSessions<K extends string>(
  actors: Readonly<Record<K, ActorCredentials>>,
): Promise<Record<K, ActorSession>> {
  const entries = Object.entries(actors) as [K, ActorCredentials][];
  const built = await Promise.all(
    entries.map(async ([label, actor]) => [label, await createActorSession(actor)] as const),
  );
  return Object.fromEntries(built) as Record<K, ActorSession>;
}

/**
 * The interactive (authorization-code + PKCE + DPoP) auth seam — reserved for the future
 * "maintainer's real WebID" variant (design §6.5.1 / §7), which would compose
 * `@jeswr/solid-openid-client`. It is deliberately NOT built for the headless demo.
 *
 * @throws Error always — a labelled stub, never a silent no-op.
 */
export function createInteractiveActorSession(): never {
  throw new Error(
    "interactive auth-code session is not implemented — reserved for the " +
      "@jeswr/solid-openid-client maintainer-WebID variant (design §7). Use " +
      "createActorSession (headless client-credentials) for the demo.",
  );
}
