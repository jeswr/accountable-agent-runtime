// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The auditor's MECHANICAL WALK (DESIGN §3.2, SCENARIO step 8). Given any derived
// artifact IRI and read access to the engagement trace, it answers — from STANDARD
// vocabularies only (PROV-O, ODRL + the delegation profile, the provisional G9
// terms) — the three accountability questions:
//   1. which action produced it (`prov:wasGeneratedBy` → the activity → the acting
//      agent + its organisation);
//   2. under what policy (`prov:hadPlan` → the leaf Agreement → `odrld:delegatedUnder*`
//      → the mandate; each `prov:wasAttributedTo` names the authorizing party);
//   3. was it authorized — a full RE-RUN of the four-phase verifier at `now` = the
//      action instant (decision D5), plus a dispute re-run with the ACTUAL use, which
//      denies when the use falls outside the agreement.
//
// The walk is a query over parsed RDF; nothing runtime-proprietary is required. It
// also surfaces the negative demos: a PROV gap (the mirrored-trace divergence a
// PROV-omitting actor leaves), a recorded-vs-re-run divergence, and the breach.
import { DataFactory, Store } from "n3";
import { readBoundAuthorization, verifyAgentAuthority, } from "../chain-verifier/index.js";
import { ODRLD_DELEGATED_UNDER, ODRLD_REVOKED_POLICY, parsePolicy } from "../odrl.js";
import { AAR_DECISION, AAR_REQUEST_ACTION, AAR_REQUEST_AGENT, AAR_REQUEST_PURPOSE, AAR_REQUEST_TARGET, PROV_ACTED_ON_BEHALF_OF, PROV_HAD_PLAN, PROV_QUALIFIED_ASSOCIATION, PROV_STARTED_AT_TIME, PROV_USED, PROV_WAS_ASSOCIATED_WITH, PROV_WAS_ATTRIBUTED_TO, PROV_WAS_GENERATED_BY, } from "../vocab.js";
const { namedNode } = DataFactory;
/**
 * Validate a credential-supplied policy IRI and return the document URL to fetch, or
 * `undefined` to skip it. Fail-closed: only absolute http(s) URLs with NO embedded
 * credentials, and (when supplied) passing the caller's allowlist, are dereferenced.
 */
function safePolicyDocUrl(policyIri, isAllowed) {
    let url;
    try {
        url = new URL(policyIri);
    }
    catch {
        return undefined;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
        return undefined;
    }
    if (url.username !== "" || url.password !== "") {
        return undefined;
    }
    url.hash = "";
    const docUrl = url.toString();
    if (isAllowed !== undefined && !isAllowed(docUrl)) {
        return undefined;
    }
    return docUrl;
}
function join(base, path) {
    return base.endsWith("/") ? `${base}${path}` : `${base}/${path}`;
}
async function readParsed(source, url) {
    const res = await source.get(url);
    if (res === undefined) {
        return undefined;
    }
    const { parseTurtle } = await import("../rdf.js");
    // The resource URL is the base IRI — resolves any relative IRIs in the document.
    const dataset = await parseTurtle(res.body, res.contentType, url);
    const store = new Store();
    store.addQuads([...dataset]);
    return store;
}
/**
 * Load + parse the engagement trace from the pod: the PROV overlay + every activity
 * bundle into one query graph; the policy files + credentials into typed maps.
 */
export async function loadTrace(source, base, options = {}) {
    const graph = new Store();
    // The PROV overlay + every activity bundle → the query graph.
    const overlay = await readParsed(source, join(base, "chain.prov.ttl"));
    if (overlay !== undefined) {
        graph.addQuads(overlay.getQuads(null, null, null, null));
    }
    const activityUrls = (await source.list(join(base, "activities/"))) ?? [];
    for (const url of activityUrls) {
        const store = await readParsed(source, url);
        if (store !== undefined) {
            graph.addQuads(store.getQuads(null, null, null, null));
        }
    }
    // The credentials → keyed by the policy IRI each binds.
    const credentialsByPolicy = new Map();
    const credentialUrls = (await source.list(join(base, "credentials/"))) ?? [];
    for (const url of credentialUrls) {
        const res = await source.get(url);
        if (res === undefined) {
            continue;
        }
        let vc;
        try {
            vc = JSON.parse(res.body);
        }
        catch {
            continue;
        }
        const auth = readBoundAuthorization(vc);
        if (auth?.policy !== undefined) {
            credentialsByPolicy.set(auth.policy, vc);
        }
    }
    // Discover the bound policies GENERICALLY: each credential's `svc:policy` IRI
    // dereferences to a policy document (the IRI minus its fragment) — no hard-coded
    // filenames, so any chain shape / resource name audits.
    const policies = new Map();
    for (const policyIri of credentialsByPolicy.keys()) {
        const docUrl = safePolicyDocUrl(policyIri, options.isPolicyUrlAllowed);
        if (docUrl === undefined) {
            continue; // fail-closed: bad scheme / embedded creds / not allowlisted
        }
        const res = await source.get(docUrl);
        if (res === undefined) {
            continue;
        }
        // Parse relative to the policy document URL (relative IRIs resolve correctly).
        const policy = await parsePolicy(res.body, res.contentType, docUrl);
        if (policy?.id !== undefined) {
            policies.set(policy.id, policy);
        }
    }
    // Trace-published revocations (Phase C) — union'd into every re-run's revoked set.
    const revokedPolicies = [];
    const revocations = await readParsed(source, join(base, "revocations.ttl"));
    if (revocations !== undefined) {
        for (const q of revocations.getQuads(null, namedNode(ODRLD_REVOKED_POLICY), null, null)) {
            revokedPolicies.push(q.object.value);
        }
    }
    // The recorded decisions (G9) → for the recorded-vs-re-run divergence check.
    const recordedDecisions = [];
    const decisionUrls = (await source.list(join(base, "decisions/"))) ?? [];
    for (const url of decisionUrls) {
        const store = await readParsed(source, url);
        if (store === undefined) {
            continue;
        }
        const decisionQuad = store.getQuads(null, namedNode(AAR_DECISION), null, null)[0];
        if (decisionQuad === undefined) {
            continue;
        }
        const subject = decisionQuad.subject.value;
        const one = (predicate) => store.getQuads(namedNode(subject), namedNode(predicate), null, null)[0]?.object.value;
        const requestTarget = one(AAR_REQUEST_TARGET);
        const requestAction = one(AAR_REQUEST_ACTION);
        const requestPurpose = one(AAR_REQUEST_PURPOSE);
        const requestAgent = one(AAR_REQUEST_AGENT);
        recordedDecisions.push({
            decision: decisionQuad.object.value,
            ...(requestTarget !== undefined && { requestTarget }),
            ...(requestAction !== undefined && { requestAction }),
            ...(requestPurpose !== undefined && { requestPurpose }),
            ...(requestAgent !== undefined && { requestAgent }),
        });
    }
    // The root principal = the root policy's assigner (the policy no other is under).
    let rootPrincipal;
    for (const policy of policies.values()) {
        if (policy.delegatedUnder === undefined && policy.assigner !== undefined) {
            // Prefer a policy that IS delegated-under by another (a real chain root).
            const isChainRoot = [...policies.values()].some((p) => p.delegatedUnder === policy.id);
            if (isChainRoot) {
                rootPrincipal = policy.assigner;
            }
        }
    }
    return {
        base,
        graph,
        policies,
        credentialsByPolicy,
        recordedDecisions,
        revokedPolicies,
        ...(rootPrincipal !== undefined && { rootPrincipal }),
    };
}
function objectValue(graph, subject, predicate) {
    const quads = graph.getQuads(namedNode(subject), namedNode(predicate), null, null);
    return quads[0]?.object.value;
}
function objectValues(graph, subject, predicate) {
    return graph
        .getQuads(namedNode(subject), namedNode(predicate), null, null)
        .map((q) => q.object.value);
}
/** Reconstruct the ordered policy chain root→leaf from a leaf policy via `odrld:delegatedUnder*`. */
function chainFrom(graph, policies, leaf) {
    const order = [leaf];
    const seen = new Set([leaf]);
    let current = leaf;
    // Walk up the delegatedUnder edges (present in the PROV overlay AND the policies).
    for (;;) {
        const parent = objectValue(graph, current, ODRLD_DELEGATED_UNDER) ?? policies.get(current)?.delegatedUnder;
        if (parent === undefined || seen.has(parent)) {
            break;
        }
        order.unshift(parent);
        seen.add(parent);
        current = parent;
    }
    return order;
}
/** The stated purpose the agreement permits (its `purpose eq …` constraint), if any. */
function statedPurpose(policy) {
    for (const rule of policy?.permissions ?? []) {
        for (const c of rule.constraints ?? []) {
            if (c.leftOperand === "purpose" && typeof c.rightOperand === "string") {
                return c.rightOperand;
            }
        }
    }
    return undefined;
}
/** Build a {@link PresentedChain} for a set of policy IRIs from the loaded trace. */
function presentedChain(trace, policyIds) {
    const policies = [];
    const credentials = [];
    for (const id of policyIds) {
        const policy = trace.policies.get(id);
        const vc = trace.credentialsByPolicy.get(id);
        if (policy === undefined || vc === undefined) {
            return undefined;
        }
        policies.push(policy);
        credentials.push(vc);
    }
    return { policies, credentials };
}
/**
 * Walk the trace for one derived artifact and answer the accountability questions,
 * including an independent four-phase re-run at the action instant and (when
 * `actualUsePurpose` is supplied) the dispute re-run.
 */
export async function auditArtifact(trace, artifact, options) {
    const activity = objectValue(trace.graph, artifact, PROV_WAS_GENERATED_BY);
    if (activity === undefined) {
        return { artifact, provGap: true, authorityChain: [], used: [] };
    }
    const actingAgent = objectValue(trace.graph, activity, PROV_WAS_ASSOCIATED_WITH);
    const onBehalfOf = actingAgent !== undefined
        ? objectValue(trace.graph, actingAgent, PROV_ACTED_ON_BEHALF_OF)
        : undefined;
    // The qualifiedAssociation is a BLANK node — query it by its object TERM, not by
    // re-wrapping its label as a named node.
    const assocTerm = trace.graph.getQuads(namedNode(activity), namedNode(PROV_QUALIFIED_ASSOCIATION), null, null)[0]?.object;
    const leafPolicy = assocTerm !== undefined
        ? trace.graph.getQuads(assocTerm, namedNode(PROV_HAD_PLAN), null, null)[0]?.object.value
        : undefined;
    const used = objectValues(trace.graph, activity, PROV_USED);
    const actionInstant = objectValue(trace.graph, activity, PROV_STARTED_AT_TIME);
    const authorityChain = [];
    let orderedIds = [];
    if (leafPolicy !== undefined) {
        orderedIds = chainFrom(trace.graph, trace.policies, leafPolicy);
        for (const id of orderedIds) {
            const attributedTo = objectValue(trace.graph, id, PROV_WAS_ATTRIBUTED_TO);
            authorityChain.push({ policy: id, ...(attributedTo !== undefined && { attributedTo }) });
        }
    }
    const base = {
        artifact,
        provGap: false,
        activity,
        ...(actingAgent !== undefined && { actingAgent }),
        ...(onBehalfOf !== undefined && { onBehalfOf }),
        ...(leafPolicy !== undefined && { leafPolicy }),
        authorityChain,
        used,
        ...(actionInstant !== undefined && { actionInstant }),
    };
    // The four-phase re-run needs: the primary chain, the actor's second chain, the
    // root principal, the action instant, and the request reconstructed from the use.
    if (leafPolicy === undefined ||
        actionInstant === undefined ||
        actingAgent === undefined ||
        trace.rootPrincipal === undefined ||
        used.length === 0) {
        return base;
    }
    const now = new Date(actionInstant);
    const primary = presentedChain(trace, orderedIds);
    if (primary === undefined) {
        return base;
    }
    const leaf = trace.policies.get(leafPolicy);
    const leafAssignee = leaf?.assignee;
    // The actor's second chain: the institute-internal policy whose assigner is the
    // organisation (`onBehalfOf`) and which authorizes the acting agent.
    const actorChainIds = [...trace.policies.values()]
        .filter((p) => p.delegatedUnder === undefined && p.assigner === onBehalfOf && p.id !== leafPolicy)
        .map((p) => p.id);
    const actorChain = actorChainIds.length === 1 ? presentedChain(trace, actorChainIds) : undefined;
    // Match the recorded decision for this use (by target) so the re-run reconstructs
    // the ACTUAL recorded request — the action is NOT assumed to be `read` (a non-read
    // action must not be falsely reported authorized just because read is permitted).
    void leafAssignee;
    const recorded = trace.recordedDecisions.find((d) => d.requestTarget === used[0]) ??
        (trace.recordedDecisions.length === 1 ? trace.recordedDecisions[0] : undefined);
    const action = (recorded?.requestAction ?? "read");
    // Use the recorded purpose EXACTLY when a decision was recorded — `undefined` means
    // the request asserted NO purpose, which a purpose-constrained policy must deny; do
    // NOT silently inject the policy's permitted purpose (that would mask a real
    // divergence). Only when NO record exists do we fall back to the stated purpose.
    const recordedPurpose = recorded !== undefined ? recorded.requestPurpose : statedPurpose(leaf);
    // Phase C consults BOTH the caller-supplied revoked set AND the trace's own
    // published revocations (a revocation present in the trace is never skipped).
    const revoked = [...new Set([...(options.revoked ?? []), ...trace.revokedPolicies])];
    const buildRequest = (usePurpose) => ({
        action,
        target: used[0],
        ...(usePurpose !== undefined && {
            attributes: { purpose: usePurpose, dateTime: now.toISOString() },
        }),
    });
    const reRun = await verifyAgentAuthority(primary, {
        request: buildRequest(recordedPurpose),
        rootPrincipal: trace.rootPrincipal,
        now,
        resolveKey: options.resolveKey,
        ...(options.isControlledBy !== undefined && { isControlledBy: options.isControlledBy }),
        revoked,
        actor: actingAgent,
        ...(actorChain !== undefined && { actorChain }),
    });
    // Recorded-vs-re-run divergence (DESIGN §3.2 step 3): a mismatch is itself a finding.
    const reRunDecision = reRun.authorized ? "permit" : "deny";
    const divergence = recorded !== undefined ? recorded.decision !== reRunDecision : undefined;
    let dispute;
    if (options.actualUsePurpose !== undefined) {
        const disputeRun = await verifyAgentAuthority(primary, {
            request: buildRequest(options.actualUsePurpose),
            rootPrincipal: trace.rootPrincipal,
            now,
            resolveKey: options.resolveKey,
            ...(options.isControlledBy !== undefined && { isControlledBy: options.isControlledBy }),
            revoked,
            actor: actingAgent,
            ...(actorChain !== undefined && { actorChain }),
        });
        dispute = {
            actualUsePurpose: options.actualUsePurpose,
            authorized: disputeRun.authorized,
            reason: disputeRun.reason,
            breach: !disputeRun.authorized,
        };
    }
    return {
        ...base,
        reRun,
        ...(divergence !== undefined && { divergence }),
        ...(dispute !== undefined && { dispute }),
    };
}
//# sourceMappingURL=reader.js.map