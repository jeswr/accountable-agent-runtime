// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// G9 — the PROVISIONAL decision-record shape (decision D4). Reifies exactly the
// fields of a four-phase verification (request, instant, ordered chain IRIs, the
// revoked set consulted, decision + phase + reason, outstanding duties, and — per
// G14 — the WAC mutation the agreement justified) as RDF, so the trace's
// `decisions/` records have a vocabulary an auditor can COMPARE against an
// independent re-run. Terms are minted minimally under
// `https://w3id.org/jeswr/accountable-agent#` with an explicit re-basing plan onto
// the ODRL CG Formal Semantics report model once its namespace lands (verified
// "to be defined" 2026-07-03). Provisional — NOT a stable vocabulary.
import { GraphBuilder, iriRef } from "../rdf.js";
import { AAR_ACTOR, AAR_ACTOR_CHAIN_POLICY, AAR_CHAIN_POLICY, AAR_DECISION, AAR_DECISION_RECORD, AAR_ERROR_CODE, AAR_EVALUATED_AT, AAR_JUSTIFIES, AAR_LEAF_ASSIGNEE, AAR_OUTSTANDING_DUTY, AAR_PHASE, AAR_REASON, AAR_REQUEST_ACTION, AAR_REQUEST_AGENT, AAR_REQUEST_PURPOSE, AAR_REQUEST_TARGET, AAR_REVOKED_POLICY_CONSULTED, AAR_ROOT_PRINCIPAL, AAR_WAC_MUTATION, XSD_DATETIME, } from "../vocab.js";
/** A `purpose` attribute value, if the request context asserts one as a string. */
function purposeOf(request) {
    const p = request.attributes?.purpose;
    return typeof p === "string" ? p : undefined;
}
/** Serialise a {@link DecisionRecordInput} to quads (the provisional G9 shape). */
export function decisionRecordQuads(input) {
    const b = new GraphBuilder();
    const rec = iriRef(input.id);
    b.addType(rec, AAR_DECISION_RECORD);
    if (input.request.agent !== undefined) {
        b.addIri(rec, AAR_REQUEST_AGENT, input.request.agent);
    }
    b.addLiteral(rec, AAR_REQUEST_ACTION, input.request.action);
    if (input.request.target !== undefined) {
        b.addIri(rec, AAR_REQUEST_TARGET, input.request.target);
    }
    const purpose = purposeOf(input.request);
    if (purpose !== undefined) {
        b.addIri(rec, AAR_REQUEST_PURPOSE, purpose);
    }
    b.addLiteral(rec, AAR_EVALUATED_AT, input.evaluatedAt.toISOString(), XSD_DATETIME);
    b.addIri(rec, AAR_ROOT_PRINCIPAL, input.rootPrincipal);
    b.addIri(rec, AAR_LEAF_ASSIGNEE, input.leafAssignee);
    if (input.actor !== undefined) {
        b.addIri(rec, AAR_ACTOR, input.actor);
    }
    for (const id of input.result.chainPolicyIds) {
        b.addIri(rec, AAR_CHAIN_POLICY, id);
    }
    for (const id of input.result.actorResult?.chainPolicyIds ?? []) {
        b.addIri(rec, AAR_ACTOR_CHAIN_POLICY, id);
    }
    for (const id of input.revokedConsulted) {
        b.addIri(rec, AAR_REVOKED_POLICY_CONSULTED, id);
    }
    b.addLiteral(rec, AAR_DECISION, input.result.authorized ? "permit" : "deny");
    b.addLiteral(rec, AAR_PHASE, input.result.phase);
    if (input.result.code !== undefined) {
        b.addLiteral(rec, AAR_ERROR_CODE, input.result.code);
    }
    b.addLiteral(rec, AAR_REASON, input.result.reason);
    for (const duty of input.result.duties) {
        if (!duty.fulfilled) {
            b.addLiteral(rec, AAR_OUTSTANDING_DUTY, duty.action);
        }
    }
    if (input.wacMutation !== undefined) {
        b.addIri(rec, AAR_WAC_MUTATION, input.wacMutation);
        // The agreement (leaf policy) justifies the WAC mutation (G14 linkage).
        const leaf = input.result.chainPolicyIds[input.result.chainPolicyIds.length - 1];
        if (leaf !== undefined) {
            b.addIri(iriRef(input.wacMutation), AAR_JUSTIFIES, leaf);
        }
    }
    return b.quads();
}
//# sourceMappingURL=decision-record.js.map