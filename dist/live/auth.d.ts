import { type ClientCredentials, type SolidSessionState } from "@jeswr/solid-dpop";
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
/**
 * Create a headless, DPoP-bound session for one actor: generate a fresh keypair, exchange
 * the client-credentials for a DPoP-bound access token (nonce-retry handled), and return the
 * actor's WebID + a redirect-refusing authed `fetch`.
 */
export declare function createActorSession(actor: ActorCredentials): Promise<ActorSession>;
/** Create a session per actor (parallel). Keys are the caller's actor labels. */
export declare function createActorSessions<K extends string>(actors: Readonly<Record<K, ActorCredentials>>): Promise<Record<K, ActorSession>>;
/**
 * The interactive (authorization-code + PKCE + DPoP) auth seam — reserved for the future
 * "maintainer's real WebID" variant (design §6.5.1 / §7), which would compose
 * `@jeswr/solid-openid-client`. It is deliberately NOT built for the headless demo.
 *
 * @throws Error always — a labelled stub, never a silent no-op.
 */
export declare function createInteractiveActorSession(): never;
//# sourceMappingURL=auth.d.ts.map