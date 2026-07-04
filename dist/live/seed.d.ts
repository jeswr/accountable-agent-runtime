import { type KeyPair } from "@jeswr/solid-vc";
import { type SeededAccount } from "./account.js";
import { type ActorSession } from "./auth.js";
import { type LiveActorId, type LiveCast } from "./cast.js";
import { type BootCssOptions, type CssServer } from "./css.js";
/** The fully-seeded live substrate the tests / harness consume. */
export interface LiveSubstrate {
    /** The server root. */
    readonly base: string;
    /** The parameterised live cast. */
    readonly cast: LiveCast;
    /** The provisioned accounts (credentials in memory only). */
    readonly accounts: Readonly<Record<LiveActorId, SeededAccount>>;
    /** The per-actor DPoP sessions (redirect-refusing authed fetch each). */
    readonly sessions: Readonly<Record<LiveActorId, ActorSession>>;
    /** The generated signing keypairs (test material — lets variant tests re-sign). */
    readonly actorKeys: Readonly<Record<LiveActorId, KeyPair>>;
    /** The zero-credential loopback guarded fetch (discovery / auditor reads). */
    readonly discoveryFetch: typeof globalThis.fetch;
    /** The CSS child (absent when targeting an external `--base`). */
    readonly css?: CssServer;
    /** Tear down (kill CSS if we booted it). Idempotent. */
    stop(): Promise<void>;
}
/** Options for {@link seedDemo}. */
export interface SeedOptions {
    /** Target an already-running server instead of booting CSS. */
    readonly base?: string;
    /** Leave a booted CSS up after `stop()` (debugging). */
    readonly keep?: boolean;
    /** CSS boot options (ignored when `base` is given). */
    readonly bootOptions?: BootCssOptions;
}
/**
 * Seed the full live substrate. Returns the substrate handle; on any failure it tears the
 * server down (unless `keep`) and rethrows.
 */
export declare function seedDemo(options?: SeedOptions): Promise<LiveSubstrate>;
//# sourceMappingURL=seed.d.ts.map