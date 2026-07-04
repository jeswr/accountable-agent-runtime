import { type AuditLiveResult } from "./audit.js";
import type { BootCssOptions } from "./css.js";
import { type NegativeActsResult } from "./negative.js";
import { type LiveRunResult } from "./run.js";
/** Options for {@link runDemo}. */
export interface RunDemoOptions {
    /** Target an already-running local server instead of booting CSS. */
    readonly base?: string;
    /** Leave a booted CSS up after the run (debugging). */
    readonly keep?: boolean;
    /** Additionally write the machine-readable audit envelope to this path. */
    readonly json?: string;
    /** Override the evaluation instant (default: within the grant window). */
    readonly now?: Date;
    /** CSS boot options (ignored when `base` is given). */
    readonly bootOptions?: BootCssOptions;
    /** Sink for the human transcript + progress lines (default `console.log`). */
    readonly log?: (line: string) => void;
}
/** The full result of a demo run (for the integration suite's structural assertions). */
export interface DemoResult {
    readonly base: string;
    readonly run: LiveRunResult;
    readonly negatives: NegativeActsResult;
    readonly audit: AuditLiveResult;
    /** True iff every §4.4 verdict held (the harness exit is 0 iff this is true). */
    readonly ok: boolean;
    /** The human-readable assertions summary (each `PASS`/`FAIL`). */
    readonly checks: readonly {
        readonly name: string;
        readonly pass: boolean;
    }[];
}
/**
 * Run the whole demo against a freshly-booted (or `--base`-targeted) local Solid server.
 * Tears the server down on completion or failure (unless `keep`). Returns the structured
 * result; the caller decides the process exit code from {@link DemoResult.ok}.
 */
export declare function runDemo(options?: RunDemoOptions): Promise<DemoResult>;
//# sourceMappingURL=demo.d.ts.map