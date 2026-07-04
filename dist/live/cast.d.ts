/** The four actors that authenticate in the live demo (the auditor holds no account). */
export type LiveActorId = "alice" | "agentA" | "institute" | "agentR";
/** Each actor's pod root (an absolute container URL, trailing slash). */
export type ActorBases = Readonly<Record<LiveActorId, string>>;
/** The dpv purpose IRIs (external, unchanged from the fixed cast). */
export declare const PURPOSE = "https://w3id.org/dpv#ResearchAndDevelopment";
export declare const MISUSE_PURPOSE = "https://w3id.org/dpv#DirectMarketing";
/** The mandate credential's bit position in Alice's revocation status list (G2). */
export declare const MANDATE_STATUS_INDEX = 42;
/** The fixed evaluation windows (a one-year grant), mirrored from `scenario/cast.ts`. */
export declare const VALID_FROM = "2026-07-03T00:00:00Z";
export declare const VALID_UNTIL = "2027-07-03T00:00:00Z";
/** A live actor's canonical IRIs. */
export interface LiveActor {
    /** WebID (`<podRoot>profile/card#me`). */
    readonly webId: string;
    /** WebID document (`<podRoot>profile/card`). */
    readonly profileDoc: string;
    /** The verification-method IRI (co-located in the profile document: `<profileDoc>#key`). */
    readonly keyVm: string;
    /** The LDN inbox container. */
    readonly inbox: string;
    /** The pod root container. */
    readonly podRoot: string;
}
/** The full live cast the seeding writes and the scenario/auditor read. */
export interface LiveCast {
    readonly alice: LiveActor & {
        /** The selected records the agreement governs. */
        readonly records: string;
        /** The container holding the records. */
        readonly dataContainer: string;
        /** Alice's signed Bitstring Status List (G2). */
        readonly statusListUrl: string;
        /** Alice's engagement trace container (her copy). */
        readonly engagementBase: string;
    };
    readonly agentA: LiveActor;
    readonly institute: LiveActor & {
        /** The hash-pinned Protocol Document. */
        readonly protocolDocUrl: string;
        /** The institute's MIRROR trace container (its copy). */
        readonly mirrorBase: string;
    };
    readonly agentR: LiveActor;
    readonly purpose: string;
    readonly misusePurpose: string;
    readonly mandateStatusIndex: number;
    /** The root mandate policy IRI (in Alice's trace). */
    readonly mandateId: string;
    /** The leaf agreement policy IRI (in Alice's trace). */
    readonly agreementId: string;
    /** The institute-internal (D9 second-chain) policy IRI. */
    readonly instituteInternalId: string;
    /** The derived artifact the auditor is handed. */
    readonly derivedArtifact: string;
}
/** The default actor→pod mapping for a CSS server root (one account per actor, §1.2). */
export declare function actorBasesFor(serverBase: string): ActorBases;
/** Build the parameterised live cast from per-actor pod bases. */
export declare function buildCast(bases: ActorBases): LiveCast;
//# sourceMappingURL=cast.d.ts.map