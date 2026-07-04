import { type VerifyAuthorityResult } from "@jeswr/agent-authz-verifier";
import type { VerifiableCredential } from "@jeswr/solid-vc";
import type { LiveSubstrate } from "./seed.js";
/** A refusal at a live-scenario step (a fail-closed exit before authorization). */
export declare class LiveScenarioRefusal extends Error {
    constructor(message: string);
}
/** The notification IRIs the LDN carrier minted (transcript + assertions). */
export interface LdnTrace {
    /** Agent A's upgrade Offer in agent R's inbox. */
    readonly offer: string;
    /** Agent R's Accept in agent A's inbox. */
    readonly accept: string;
    /** Agent R's activity Announce in Alice's inbox. */
    readonly announce: string;
}
/** The full result of a live scenario run — everything the harness + auditor consume. */
export interface LiveRunResult {
    readonly now: Date;
    readonly cast: LiveSubstrate["cast"];
    /** The proven WAC transition — always `"403->200"` on the happy path (asserted). */
    readonly wacFlip: "403->200";
    /** The `.acl` resource Alice's grant landed on. */
    readonly aclResource: string;
    readonly protocolPinned: boolean;
    readonly handshakeAccepted: boolean;
    readonly intentConforms: boolean;
    readonly verification: VerifyAuthorityResult;
    readonly credentials: {
        readonly mandate: VerifiableCredential;
        readonly agreement: VerifiableCredential;
        readonly instituteAgent: VerifiableCredential;
    };
    /** The trace container the auditor reads (the institute's public-read mirror). */
    readonly auditTraceBase: string;
    /** Alice's own copy of the trace (the owner mirror, for divergence detection). */
    readonly aliceTraceBase: string;
    /** The derived artifact the auditor is handed. */
    readonly derivedArtifact: string;
    /** The action's PROV activity IRI (in the audited mirror). */
    readonly activityIri: string;
    /** The LDN notification IRIs minted along the way. */
    readonly ldn: LdnTrace;
}
/** Options for {@link runLiveScenario}. */
export interface RunLiveScenarioOptions {
    /** The single instant the run is evaluated at (default: within the grant window). */
    readonly now?: Date;
}
/**
 * Run the §4 scenario against a live seeded substrate. Throws {@link LiveScenarioRefusal} on
 * any fail-closed exit (discovery failure, protocol-pin mismatch, a denied verification, or a
 * WAC transition that does not flip 403→200).
 */
export declare function runLiveScenario(substrate: LiveSubstrate, options?: RunLiveScenarioOptions): Promise<LiveRunResult>;
//# sourceMappingURL=run.d.ts.map