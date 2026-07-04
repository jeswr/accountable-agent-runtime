// AUTHORED-BY Claude Fable 5
//
// Key material for the scripted scenario — REAL `@jeswr/solid-vc` crypto (decision
// D7: Phase 0 doubles I/O + the clock, NEVER the signatures), now with REAL
// WebID-DOCUMENT key resolution (Phase 1, G4/G5 CLOSED):
//
//   • {@link publishActorKey} — the WRITE side (G5): `publishVerificationMethod`
//     produces the standard `sec:Multikey` RDF, split by AUTHORITATIVE DOCUMENT
//     (the controller-side listing into the WebID's own document, the key material
//     into the key id's own document) and MERGED into whatever the pod already
//     hosts there (parse → union → re-serialise via the sanctioned RDF path, never
//     a string concat).
//
//   • {@link podKeyResolver} — the READ side (G4): `createWebIdKeyResolver` over
//     the pod's injectable `fetch`. `resolveKey` and `isControlledBy` are now
//     document-resolved and fail-closed — a credential naming a verification
//     method its issuer's WebID document never authorised cannot verify. This
//     retires the Phase-0 `KeyRing` (in-memory key map) and
//     `sameOriginController` (origin heuristic) stubs.
//
// NOTE the resolver instance CACHES documents for its lifetime (one verification
// never re-fetches a profile). Tests that mutate the pod's key documents must
// create a FRESH resolver (call {@link podKeyResolver} again) to observe the change.
import { createBitstringStatusResolver, createWebIdKeyResolver, generateKeyPairForSuite, publishVerificationMethod, } from "@jeswr/solid-vc";
import { parseTurtle, serializeTurtle } from "../rdf.js";
/** Generate an Ed25519 key pair for the given verification-method IRI. */
export function generateActorKey(verificationMethod) {
    return generateKeyPairForSuite(verificationMethod, "Ed25519");
}
/** The fragment-stripped document URL of an IRI. */
function documentUrlOf(iri) {
    const u = new URL(iri);
    u.hash = "";
    return u.href;
}
/** Merge quads into a pod document: parse what is hosted, union, re-serialise. */
async function mergeIntoPod(pod, docUrl, quads) {
    const existing = pod.get(docUrl);
    const existingQuads = existing !== undefined
        ? [...(await parseTurtle(existing.body, existing.contentType, docUrl))]
        : [];
    const body = await serializeTurtle([...existingQuads, ...quads]);
    pod.put(docUrl, body, "text/turtle");
}
/**
 * Publish an actor's verification method into the pod (G5, the write side):
 * the controller-side listing (`sec:verificationMethod` + `sec:assertionMethod`)
 * goes into the WebID's OWN document; the key material (`a sec:Multikey`,
 * `sec:controller`, `sec:publicKeyMultibase`) into the key id's OWN document —
 * exactly the two authoritative documents `resolveWebIdKey` reads, fail-closed.
 * Existing document content (e.g. an agent pointer on the org profile) is
 * preserved by a parse→union→re-serialise merge.
 */
export async function publishActorKey(pod, controller, key) {
    const published = await publishVerificationMethod({ controller, key });
    const controllerDoc = documentUrlOf(published.controller);
    const keyDoc = documentUrlOf(published.verificationMethod);
    const controllerQuads = published.quads.filter((q) => q.subject.termType === "NamedNode" && q.subject.value === published.controller);
    const keyQuads = published.quads.filter((q) => q.subject.termType === "NamedNode" && q.subject.value === published.verificationMethod);
    if (controllerDoc === keyDoc) {
        await mergeIntoPod(pod, controllerDoc, published.quads);
        return;
    }
    await mergeIntoPod(pod, controllerDoc, controllerQuads);
    await mergeIntoPod(pod, keyDoc, keyQuads);
}
/**
 * The document-resolving `{ resolveKey, isControlledBy }` pair (G4/G5, the read
 * side) over the pod's fetch — solid-vc's `createWebIdKeyResolver`, fail-closed
 * and redirect-refusing. Create a FRESH instance after mutating key documents
 * (the resolver caches documents for its lifetime).
 */
export function podKeyResolver(pod) {
    return createWebIdKeyResolver({ fetch: pod.fetch });
}
/**
 * The CREDENTIAL-STATUS resolver (G2, the read side) over the pod's fetch —
 * solid-vc's `createBitstringStatusResolver` wired to a fresh document-resolving
 * key pair (the hosted status list's OWN signature is verified through the same
 * WebID-document seams). Pass as `resolveStatus` to `verifyAgentAuthority` /
 * `verifyCredential`. `now` bounds the list credential's validity window (pass
 * the single evaluation instant). Build a FRESH one after mutating the hosted
 * list (the key resolver underneath caches documents).
 */
export function podStatusResolver(pod, options = {}) {
    const keyResolver = podKeyResolver(pod);
    return createBitstringStatusResolver({
        resolveKey: keyResolver.resolveKey,
        isControlledBy: keyResolver.isControlledBy,
        fetch: pod.fetch,
        ...(options.now !== undefined && { now: options.now }),
    });
}
//# sourceMappingURL=keys.js.map