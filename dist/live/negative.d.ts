import type { LiveRunResult } from "./run.js";
import type { LiveSubstrate } from "./seed.js";
/** The verdict of each negative act. */
export interface NegativeActsResult {
    /** N1 — the forged agreement credential is refused. */
    readonly forgedHop: {
        readonly authorized: boolean;
        readonly phase: string;
        readonly code?: string;
    };
    /** N2 — the out-of-scope (misuse-purpose) dispute is a breach. */
    readonly outOfScope: {
        readonly breach: boolean;
        readonly reason: string;
    };
    /** N3 — the revoked-subtree (flipped Bitstring bit) re-run denies at Phase C. */
    readonly revokedSubtree: {
        readonly reRunAuthorized: boolean;
        readonly phase: string;
        readonly code?: string;
        readonly reverted: boolean;
    };
    /** N4 — the PROV-omitting artifact has no generating activity. */
    readonly provOmit: {
        readonly provGap: boolean;
        readonly artifact: string;
    };
}
/**
 * Run the four negative acts over a live substrate after a happy-path {@link runLiveScenario}.
 * All resolvers are the live production ones; N3's status mutation is reverted so a following
 * audit sees a clean substrate.
 */
export declare function runNegativeActs(substrate: LiveSubstrate, runResult: LiveRunResult): Promise<NegativeActsResult>;
//# sourceMappingURL=negative.d.ts.map