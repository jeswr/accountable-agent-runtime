// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The accountability-artifact WRITER — lays the engagement trace onto a pod
// (DESIGN §3.1). Everything RDF goes through the sanctioned serialisers: policies
// via the G10 seam's `policyToTurtle`, the chain overlay via `delegationProvenance`,
// the per-action bundle via G8's `actionProvenance`, the decision record via G9 —
// never a hand-built triple. The pod is an injectable {@link ResourceSink} (Phase 0
// an in-memory double; Phase 2 a DPoP-authed `fetch`).
import { delegationProvenance, policyToTurtle } from "../odrl.js";
import { canonicalize, parseTurtle, serializeTurtle } from "../rdf.js";
import { actionProvenance } from "./activity.js";
import { decisionRecordQuads } from "./decision-record.js";
function join(base, path) {
    return base.endsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
/**
 * Write the once-per-engagement trace: `mandate.ttl`, `agreement.ttl`,
 * `chain.prov.ttl` (the `delegationProvenance` overlay), the binding credentials,
 * and `revocations.ttl` (when present). Returns the canonical form of each RDF
 * artifact so a golden master can pin the byte-stable trace.
 */
export async function writeEngagement(sink, trace) {
    const written = [];
    const putRdf = async (path, quads) => {
        const url = join(trace.base, path);
        const turtle = typeof quads === "string" ? quads : await serializeTurtle(quads);
        await sink.put(url, turtle, "text/turtle");
    };
    const mandateTtl = await policyToTurtle(trace.mandate);
    await putRdf("mandate.ttl", mandateTtl);
    written.push({
        path: "mandate.ttl",
        contentType: "text/turtle",
        canonical: await canonicalize(await quadsOfPolicy(trace.mandate)),
    });
    const agreementTtl = await policyToTurtle(trace.agreement);
    await putRdf("agreement.ttl", agreementTtl);
    written.push({
        path: "agreement.ttl",
        contentType: "text/turtle",
        canonical: await canonicalize(await quadsOfPolicy(trace.agreement)),
    });
    const overlay = delegationProvenance([trace.mandate, trace.agreement]);
    await putRdf("chain.prov.ttl", overlay);
    written.push({
        path: "chain.prov.ttl",
        contentType: "text/turtle",
        canonical: await canonicalize(overlay),
    });
    for (const { name, vc } of trace.credentials) {
        const url = join(trace.base, `credentials/${name}.vc.jsonld`);
        await sink.put(url, JSON.stringify(vc), "application/ld+json");
    }
    if (trace.revocations !== undefined && trace.revocations.length > 0) {
        await putRdf("revocations.ttl", trace.revocations);
        written.push({
            path: "revocations.ttl",
            contentType: "text/turtle",
            canonical: await canonicalize(trace.revocations),
        });
    }
    return written;
}
/**
 * The policy's quads for golden pinning — obtained by parsing its serialised
 * Turtle (`policyToRdf` is not on the G10 seam's public export set, and
 * canonicalising the round-tripped form is equivalent + byte-stable).
 */
async function quadsOfPolicy(policy) {
    const dataset = await parseTurtle(await policyToTurtle(policy));
    return [...dataset];
}
/** Write one per-action PROV bundle to `activities/<id>.ttl`. Returns its quads (for LDN mirroring). */
export async function writeActivity(sink, base, activityId, input) {
    const quads = actionProvenance(input);
    const url = join(base, `activities/${activityId}.ttl`);
    await sink.put(url, await serializeTurtle(quads), "text/turtle");
    return quads;
}
/** Write one decision record to `decisions/<id>.ttl`. Returns its quads. */
export async function writeDecision(sink, base, recordId, input) {
    const quads = decisionRecordQuads(input);
    const url = join(base, `decisions/${recordId}.ttl`);
    await sink.put(url, await serializeTurtle(quads), "text/turtle");
    return quads;
}
//# sourceMappingURL=writer.js.map