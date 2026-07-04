import type { OdrlPolicy, RequestContext } from "../odrl.js";
/** The fixed evaluation windows used throughout (a one-year grant). */
export declare const VALID_FROM: "2026-07-03T00:00:00Z";
export declare const VALID_UNTIL: "2027-07-03T00:00:00Z";
/** The mandate credential's bit position in Alice's revocation status list (G2). */
export declare const MANDATE_STATUS_INDEX = 42;
/** The cast IRIs (SCENARIO). */
export declare const CAST: {
    readonly alice: "https://alice.solid.example/profile/card#me";
    readonly aliceKeyVm: "https://alice.solid.example/keys#k1";
    readonly aliceProfileDoc: "https://alice.solid.example/profile/card";
    readonly agentA: "https://agent-a.example/id#it";
    readonly agentAKeyVm: "https://agent-a.example/keys#k1";
    readonly inst: "https://institute.example/org#id";
    readonly instKeyVm: "https://institute.example/keys#k1";
    readonly instProfileDoc: "https://institute.example/org";
    readonly agentR: "https://institute.example/agents/research#it";
    readonly agentRDoc: "https://institute.example/agents/research";
    readonly records: "https://alice.solid.example/data/records.ttl";
    readonly purpose: "https://w3id.org/dpv#ResearchAndDevelopment";
    readonly misusePurpose: "https://w3id.org/dpv#DirectMarketing";
    readonly engagementBase: "https://alice.solid.example/agents/engagements/e1/";
    readonly aliceInbox: "https://alice.solid.example/inbox/";
    readonly mandateId: "https://alice.solid.example/agents/engagements/e1/mandate.ttl#policy";
    readonly agreementId: "https://alice.solid.example/agents/engagements/e1/agreement.ttl#policy";
    readonly instituteInternalId: "https://institute.example/policies/internal-e1.ttl#policy";
    readonly statusListUrl: "https://alice.solid.example/status/e1-revocation.json";
    readonly derivedArtifact: "https://institute.example/derived/summary-2027.ttl";
};
/** The root mandate P (Alice → agent A: read + a depth-1 grantUse, distribute prohibited). */
export declare function buildMandate(): OdrlPolicy;
/** The leaf Agreement (Alice-via-A → the institute: read for a stated purpose). */
export declare function buildAgreement(): OdrlPolicy;
/**
 * The institute's INTERNAL authorization (inst → agentR: "our research agent may
 * exercise this for us"). A single-policy chain rooted at the LEAF ASSIGNEE — the
 * D9 identity-composition second chain. `assigner` = inst so the chain's trusted
 * root is the institute (chain₂.root ≡ chain₁.leaf assignee).
 */
export declare function buildInstituteInternal(): OdrlPolicy;
/** The read request R performs (SCENARIO step 4/7), with a stated purpose + instant. */
export declare function buildReadRequest(purpose: string, now: Date): RequestContext;
//# sourceMappingURL=cast.d.ts.map