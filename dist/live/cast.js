// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T2 (part) — the PARAMETERISED live cast (design §1.2). The Phase-0 `scenario/cast.ts`
// fixes example IRIs (`https://alice.solid.example/…`) so the deterministic golden tests
// stay byte-stable; this module derives the SAME conceptual cast over LIVE pod bases, so
// the live harness and the golden tests share one shape without either touching the other.
// `scenario/cast.ts` is UNCHANGED — this is additive.
/** The dpv purpose IRIs (external, unchanged from the fixed cast). */
export const PURPOSE = "https://w3id.org/dpv#ResearchAndDevelopment";
export const MISUSE_PURPOSE = "https://w3id.org/dpv#DirectMarketing";
/** The mandate credential's bit position in Alice's revocation status list (G2). */
export const MANDATE_STATUS_INDEX = 42;
/** The fixed evaluation windows (a one-year grant), mirrored from `scenario/cast.ts`. */
export const VALID_FROM = "2026-07-03T00:00:00Z";
export const VALID_UNTIL = "2027-07-03T00:00:00Z";
function trimSlash(base) {
    return base.endsWith("/") ? base : `${base}/`;
}
function actor(podRoot) {
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
export function actorBasesFor(serverBase) {
    const base = serverBase.endsWith("/") ? serverBase.slice(0, -1) : serverBase;
    return {
        alice: `${base}/alice/`,
        agentA: `${base}/agent-a/`,
        institute: `${base}/institute/`,
        agentR: `${base}/agent-r/`,
    };
}
/** Build the parameterised live cast from per-actor pod bases. */
export function buildCast(bases) {
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
//# sourceMappingURL=cast.js.map