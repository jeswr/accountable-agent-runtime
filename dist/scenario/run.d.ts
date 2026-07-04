import type { AgentDiscovery } from "@jeswr/solid-agent-card";
import type { VerifiableCredential } from "@jeswr/solid-vc";
import { type VerifyAuthorityResult } from "../chain-verifier/index.js";
import { type OdrlPolicy } from "../odrl.js";
import { type WrittenArtifact } from "../trace/index.js";
import { CAST } from "./cast.js";
import { KeyRing } from "./keys.js";
import { InMemoryPod } from "./pod.js";
/** A refusal at a negotiation step (a fail-closed exit before authorization). */
export declare class ScenarioRefusal extends Error {
}
/** The WAC grant the agreement materialised (step 6). */
export interface WacGrant {
    readonly target: string;
    readonly agent: string;
    readonly modes: readonly string[];
    /** The `.acl` resource the mutation lands on (G14 linkage lives in the decision record). */
    readonly aclResource: string;
}
/** The full result of a scenario run — everything the tests + auditor consume. */
export interface ScenarioResult {
    readonly pod: InMemoryPod;
    readonly keyRing: KeyRing;
    readonly now: Date;
    readonly discovery: AgentDiscovery;
    readonly protocolHash: string;
    readonly protocolPinned: boolean;
    readonly handshakeAccepted: boolean;
    readonly intentConforms: boolean;
    readonly verification: VerifyAuthorityResult;
    readonly mandate: OdrlPolicy;
    readonly agreement: OdrlPolicy;
    readonly instituteInternal: OdrlPolicy;
    readonly credentials: {
        readonly mandate: VerifiableCredential;
        readonly agreement: VerifiableCredential;
        readonly instituteAgent: VerifiableCredential;
    };
    /**
     * The EXACT policy-document bytes each credential digest-binds (G1) — the same
     * bytes hosted on the pod and presented to the verifier. Kept on the result so
     * tests present the true issuance bytes, never a parse→re-emit.
     */
    readonly policyDocuments: {
        readonly mandate: string;
        readonly agreement: string;
        readonly instituteInternal: string;
    };
    readonly wacGrant: WacGrant;
    readonly writtenArtifacts: readonly WrittenArtifact[];
    readonly activityId: string;
    readonly requestId: string;
    readonly cast: typeof CAST;
}
/** Options for {@link runScenario}. */
export interface RunScenarioOptions {
    /** The single instant the run is evaluated at (default: within the grant window). */
    readonly now?: Date;
}
/** Run the deterministic §4 scenario end to end. Throws {@link ScenarioRefusal} on a fail-closed exit. */
export declare function runScenario(options?: RunScenarioOptions): Promise<ScenarioResult>;
//# sourceMappingURL=run.d.ts.map