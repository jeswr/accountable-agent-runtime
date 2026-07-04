// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T2 (part) — the PARAMETERISED live cast (design §1.2). The Phase-0 `scenario/cast.ts`
// fixes example IRIs (`https://alice.solid.example/…`) so the deterministic golden tests
// stay byte-stable; this module derives the SAME conceptual cast over LIVE pod bases, so
// the live harness and the golden tests share one shape without either touching the other.
// `scenario/cast.ts` is UNCHANGED — this is additive.

/** The four actors that authenticate in the live demo (the auditor holds no account). */
export type LiveActorId = "alice" | "agentA" | "institute" | "agentR";

/** Each actor's pod root (an absolute container URL, trailing slash). */
export type ActorBases = Readonly<Record<LiveActorId, string>>;

/** The dpv purpose IRIs (external, unchanged from the fixed cast). */
export const PURPOSE = "https://w3id.org/dpv#ResearchAndDevelopment";
export const MISUSE_PURPOSE = "https://w3id.org/dpv#DirectMarketing";

/** The mandate credential's bit position in Alice's revocation status list (G2). */
export const MANDATE_STATUS_INDEX = 42;

/** The fixed evaluation windows (a one-year grant), mirrored from `scenario/cast.ts`. */
export const VALID_FROM = "2026-07-03T00:00:00Z";
export const VALID_UNTIL = "2027-07-03T00:00:00Z";

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

function trimSlash(base: string): string {
  return base.endsWith("/") ? base : `${base}/`;
}

function actor(podRoot: string): LiveActor {
  const root = trimSlash(podRoot);
  const profileDoc = `${root}profile/card`;
  return {
    podRoot: root,
    profileDoc,
    webId: `${profileDoc}#me`,
    keyVm: `${profileDoc}#key`,
    inbox: `${root}inbox/`,
  };
}

/** The default actor→pod mapping for a CSS server root (one account per actor, §1.2). */
export function actorBasesFor(serverBase: string): ActorBases {
  const base = serverBase.endsWith("/") ? serverBase.slice(0, -1) : serverBase;
  return {
    alice: `${base}/alice/`,
    agentA: `${base}/agent-a/`,
    institute: `${base}/institute/`,
    agentR: `${base}/agent-r/`,
  };
}

/** Build the parameterised live cast from per-actor pod bases. */
export function buildCast(bases: ActorBases): LiveCast {
  const alice = actor(bases.alice);
  const agentA = actor(bases.agentA);
  const institute = actor(bases.institute);
  const agentR = actor(bases.agentR);
  const engagementBase = `${alice.podRoot}agents/engagements/e1/`;
  const mirrorBase = `${institute.podRoot}agents/engagements/e1/`;
  return {
    alice: {
      ...alice,
      records: `${alice.podRoot}data/records.ttl`,
      dataContainer: `${alice.podRoot}data/`,
      statusListUrl: `${alice.podRoot}status/list`,
      engagementBase,
    },
    agentA,
    institute: {
      ...institute,
      protocolDocUrl: `${institute.podRoot}protocols/data-sharing.ttl`,
      mirrorBase,
    },
    agentR,
    purpose: PURPOSE,
    misusePurpose: MISUSE_PURPOSE,
    mandateStatusIndex: MANDATE_STATUS_INDEX,
    mandateId: `${engagementBase}mandate.ttl#policy`,
    agreementId: `${engagementBase}agreement.ttl#policy`,
    instituteInternalId: `${institute.podRoot}policies/internal-e1.ttl#policy`,
    derivedArtifact: `${institute.podRoot}derived/summary.ttl`,
  };
}
