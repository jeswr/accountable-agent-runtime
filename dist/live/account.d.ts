import type { ClientCredentials } from "@jeswr/solid-dpop";
/** A provisioned actor account. */
export interface SeededAccount {
    /** The actor's WebID (`<podRoot>profile/card#me`). */
    readonly webId: string;
    /** The pod root container. */
    readonly podRoot: string;
    /** The client-credentials + issuer for `@jeswr/solid-dpop`'s client-credentials grant. */
    readonly credentials: ClientCredentials;
    /** The account email (deterministic, per-pod). */
    readonly email: string;
    /** The account password (ephemeral, per-run). */
    readonly password: string;
}
/**
 * Provision one CSS account + pod + WebID-bound client-credentials. `pod` MUST be unique on
 * the server (CSS rejects duplicates). `webId` is the WebID the credentials are bound to —
 * default `<base>/<pod>/profile/card#me`.
 */
export declare function seedAccount(base: string, pod: string, options?: {
    readonly webId?: string;
    readonly email?: string;
    readonly password?: string;
}): Promise<SeededAccount>;
//# sourceMappingURL=account.d.ts.map