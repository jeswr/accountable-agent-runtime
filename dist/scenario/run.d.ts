import { type VerifyAuthorityResult } from "@jeswr/agent-authz-verifier";
import type { AgentDiscovery } from "@jeswr/solid-agent-card";
import type { KeyPair, VerifiableCredential, WebIdKeyResolver } from "@jeswr/solid-vc";
import { type OdrlPolicy } from "../odrl.js";
import { type WrittenArtifact } from "../trace/index.js";
import { CAST } from "./cast.js";
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
    /**
     * The document-resolving `{ resolveKey, isControlledBy }` pair the run verified
     * with (G4/G5, real): keys resolve from the WebID documents hosted on the pod,
     * never from an in-memory ring. NOTE it caches documents for its lifetime —
     * after mutating key documents, build a fresh one with `podKeyResolver(pod)`.
     */
    readonly keyResolver: WebIdKeyResolver;
    /**
     * The actors' signing key pairs (test material — lets variant tests re-sign,
     * e.g. a revoked status list or a cross-signed credential).
     */
    readonly actorKeys: {
        readonly alice: KeyPair;
        readonly agentA: KeyPair;
        readonly inst: KeyPair;
    };
    /**
     * The hosted Bitstring status list (G2): its URL, the mandate credential's bit
     * index, and the SIGNED list credential as issued (all bits clear). Variant
     * tests flip the bit (`withStatusBit`), re-sign with `actorKeys.alice`, and
     * re-host to exercise the revoked path.
     */
    readonly statusList: {
        readonly url: string;
        readonly index: number;
        readonly credential: VerifiableCredential;
    };
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