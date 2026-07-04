/** A running CSS child + its base URL. */
export interface CssServer {
    /** The server root, e.g. `http://localhost:41234` (loopback — the `allowLoopback` path). */
    readonly base: string;
    /** The port it bound. */
    readonly port: number;
    /** Kill the child and await its exit. Idempotent. */
    stop(): Promise<void>;
}
/** Options for {@link bootCss}. */
export interface BootCssOptions {
    /** Bind this port instead of a free one (e.g. an external `--base` run wants a fixed port). */
    readonly port?: number;
    /** Readiness deadline in ms (cold `npx` can take 15–20 s). Default 60 000. */
    readonly readyTimeoutMs?: number;
    /** CSS log level (`-l`). Default `warn`. */
    readonly logLevel?: string;
    /** Inherit CSS stdio to this process (for `--keep` debugging). Default false (quiet). */
    readonly inheritStdio?: boolean;
}
/**
 * Boot an in-memory CSS on a free (or given) loopback port and wait until it answers. The
 * returned handle's `stop()` tears it down; the child is also orphan-proofed against this
 * process exiting. `base` is `http://localhost:<port>` — a loopback base, so the discovery
 * fetch's `allowLoopback` hatch applies and no other network is touched.
 */
export declare function bootCss(options?: BootCssOptions): Promise<CssServer>;
//# sourceMappingURL=css.d.ts.map