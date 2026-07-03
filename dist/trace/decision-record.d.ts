import type { Quad } from "@rdfjs/types";
import type { VerifyAuthorityResult } from "../chain-verifier/index.js";
import type { RequestContext } from "../odrl.js";
/** The recorded evaluation decision for one authorization check (a `decisions/<id>.ttl`). */
export interface DecisionRecordInput {
    /** The record IRI. */
    readonly id: string;
    /** The request that was evaluated. */
    readonly request: RequestContext;
    /** The instant the check was performed (`now`). */
    readonly evaluatedAt: Date;
    /** The trusted root principal for the target. */
    readonly rootPrincipal: string;
    /** The authenticated acting WebID, when identity composition applied. */
    readonly actor?: string;
    /** The leaf assignee the primary chain proved. */
    readonly leafAssignee: string;
    /** The revoked policy IRIs consulted (Phase C). */
    readonly revokedConsulted: readonly string[];
    /** The verifier's result. */
    readonly result: VerifyAuthorityResult;
    /** The WAC resource this decision's agreement mutated (G14 linkage), if any. */
    readonly wacMutation?: string;
}
/** Serialise a {@link DecisionRecordInput} to quads (the provisional G9 shape). */
export declare function decisionRecordQuads(input: DecisionRecordInput): Quad[];
/** A decision record read back from RDF (the auditor's independent re-run compares to it). */
export interface ParsedDecisionRecord {
    readonly id: string;
    readonly decision: "permit" | "deny";
    readonly phase: string;
    readonly errorCode?: string;
    readonly reason?: string;
    readonly requestAgent?: string;
    readonly requestAction?: string;
    readonly requestTarget?: string;
    readonly requestPurpose?: string;
    readonly leafAssignee?: string;
    readonly rootPrincipal?: string;
    readonly chainPolicyIds: readonly string[];
    readonly revokedConsulted: readonly string[];
}
//# sourceMappingURL=decision-record.d.ts.map