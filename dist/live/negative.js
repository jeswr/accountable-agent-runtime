// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T7 (part) — the FOUR NEGATIVE ACTS, live (design §4.4). Accountability claims are only
// credible when the failure modes are exercised on the SAME live stack (DESIGN §5). Each act
// runs after the happy path, as a fresh verification/audit over the live resolvers or a scoped
// mutation that is REVERTED — none leaves the substrate dirty:
//
//   N1 forged hop        — a FRESH (unseeded) key signs the agreement credential at agent A's
//                          own verification-method IRI; the live WebID-document key resolver
//                          returns agent A's REAL published key, so the forged signature fails
//                          → Phase A denies (INVALID_SIGNATURE).
//   N2 out-of-scope use  — the auditor's dispute re-run with the misuse purpose → Phase D
//                          denies; `dispute.breach === true` (the §4 dispute itself).
//   N3 revoked subtree   — Alice flips the mandate's Bitstring status bit and RE-HOSTS the
//                          signed list over the live resource; a FRESH status resolver then
//                          denies at Phase C (STATUS_REVOKED). Reverted after the assertion.
//   N4 PROV-omitting     — the auditor is handed a derived artifact NO activity in the trace
//                          claims to have generated → `provGap === true` (the absence is the
//                          finding; the server's own access log is the non-repudiable floor).
//
// N1 exercises the LIVE key resolver refusing a forged proof; N3 the LIVE status resolver
// reading a re-hosted revocation; N2/N4 the auditor's walk over the live public-read trace.
import { verifyAgentAuthority } from "@jeswr/agent-authz-verifier";
import { generateKeyPairForSuite, issue, issueAgentAuthorization, withStatusBit, } from "@jeswr/solid-vc";
import { policyToTurtle, requestContextFromA2AIntent } from "../odrl.js";
import { auditArtifact, loadTrace } from "../trace/index.js";
import { VALID_FROM, VALID_UNTIL } from "./cast.js";
import { createDiscoveryFetch } from "./fetch.js";
import { LivePod } from "./pod.js";
import { buildLiveAgreement, buildLiveInstituteInternal, buildLiveMandate } from "./policies.js";
import { liveKeyResolver, liveStatusResolver } from "./resolvers.js";
/** Rebuild the primary + actor presented chains from the happy-path result (deterministic). */
function chainsOf(runResult, policies, contents, overrides = {}) {
    const cast = runResult.cast;
    const primary = {
        credentials: [
            runResult.credentials.mandate,
            overrides.agreementVc ?? runResult.credentials.agreement,
        ],
        policies: [policies.mandate, policies.agreement],
        policyContents: {
            [cast.mandateId]: { content: contents.mandate },
            [cast.agreementId]: { content: contents.agreement },
        },
    };
    const actor = {
        credentials: [runResult.credentials.instituteAgent],
        policies: [policies.institute],
        policyContents: {
            [cast.instituteInternalId]: { content: contents.institute },
        },
    };
    return { primary, actor };
}
/**
 * Run the four negative acts over a live substrate after a happy-path {@link runLiveScenario}.
 * All resolvers are the live production ones; N3's status mutation is reverted so a following
 * audit sees a clean substrate.
 */
export async function runNegativeActs(substrate, runResult) {
    const { cast, base } = substrate;
    const now = runResult.now;
    const discoveryFetch = createDiscoveryFetch(base);
    const keyResolver = liveKeyResolver(discoveryFetch);
    const policies = {
        mandate: buildLiveMandate(cast),
        agreement: buildLiveAgreement(cast),
        institute: buildLiveInstituteInternal(cast),
    };
    const contents = {
        mandate: await policyToTurtle(policies.mandate),
        agreement: await policyToTurtle(policies.agreement),
        institute: await policyToTurtle(policies.institute),
    };
    const happyRequest = requestContextFromA2AIntent({ action: "read", target: cast.alice.records }, { purpose: cast.purpose, dateTime: now.toISOString() });
    // --- N1: forged hop ------------------------------------------------------
    const forgeKey = await generateKeyPairForSuite(cast.agentA.keyVm, "Ed25519");
    const forgedAgreementVc = await issueAgentAuthorization({
        principal: cast.agentA.webId,
        agent: cast.institute.webId,
        action: "read",
        target: cast.alice.records,
        policy: cast.agreementId,
        policyContent: contents.agreement,
        validFrom: VALID_FROM,
        validUntil: VALID_UNTIL,
    }, forgeKey);
    const forgedChains = chainsOf(runResult, policies, contents, {
        agreementVc: forgedAgreementVc,
    });
    const forgedResult = await verifyAgentAuthority(forgedChains.primary, {
        request: happyRequest,
        rootPrincipal: cast.alice.webId,
        now,
        resolveKey: keyResolver.resolveKey,
        isControlledBy: keyResolver.isControlledBy,
        resolveStatus: liveStatusResolver(discoveryFetch, { now }),
        revoked: [],
        actor: cast.agentR.webId,
        actorChain: forgedChains.actor,
    });
    // --- N2: out-of-scope dispute (the auditor) ------------------------------
    // A server-root-scoped LivePod over the zero-credential guarded fetch is the auditor's
    // read source: it can GET/LIST any PUBLIC resource across every pod on the server, still
    // SSRF-guarded + redirect-refusing, but never a credential in sight.
    const auditFetch = createDiscoveryFetch(base);
    const source = new LivePod({ fetch: auditFetch, base });
    const trace = await loadTrace(source, runResult.auditTraceBase, {
        isPolicyUrlAllowed: (url) => new URL(url).origin === new URL(base).origin,
    });
    const disputeReport = await auditArtifact(trace, runResult.derivedArtifact, {
        resolveKey: keyResolver.resolveKey,
        isControlledBy: keyResolver.isControlledBy,
        resolveStatus: liveStatusResolver(auditFetch, { now }),
        actualUsePurpose: cast.misusePurpose,
    });
    // --- N3: revoked subtree (flip the Bitstring bit, re-run, revert) --------
    const revoked = await runRevokedSubtree(substrate, runResult, {
        primary: chainsOf(runResult, policies, contents).primary,
        actor: chainsOf(runResult, policies, contents).actor,
        request: happyRequest,
    });
    // --- N4: PROV-omitting actor (an ungenerated artifact) -------------------
    const omittedArtifact = `${cast.institute.podRoot}derived/summary-omitted.ttl`;
    const omitReport = await auditArtifact(trace, omittedArtifact, {
        resolveKey: keyResolver.resolveKey,
        isControlledBy: keyResolver.isControlledBy,
        resolveStatus: liveStatusResolver(auditFetch, { now }),
    });
    return {
        forgedHop: {
            authorized: forgedResult.authorized,
            phase: forgedResult.phase,
            ...(forgedResult.code !== undefined && { code: forgedResult.code }),
        },
        outOfScope: {
            breach: disputeReport.dispute?.breach ?? false,
            reason: disputeReport.dispute?.reason ?? "",
        },
        revokedSubtree: revoked,
        provOmit: { provGap: omitReport.provGap, artifact: omittedArtifact },
    };
}
/** N3 — flip Alice's mandate status bit, re-host the signed list, re-verify, then revert. */
async function runRevokedSubtree(substrate, runResult, chains) {
    const { cast, sessions, actorKeys, base } = substrate;
    const now = runResult.now;
    const discoveryFetch = createDiscoveryFetch(base);
    const alicePod = new LivePod({ fetch: sessions.alice.fetch, base: cast.alice.podRoot });
    // Read the current signed list (public), flip the mandate's bit, re-sign, re-host.
    const original = await alicePod.get(cast.alice.statusListUrl);
    if (original === undefined) {
        throw new Error("N3: the seeded status list is missing");
    }
    const listVc = JSON.parse(original.body);
    const flipped = withStatusBit(listVc, cast.mandateStatusIndex, true);
    const reIssued = await issue({ credential: flipped, key: actorKeys.alice });
    await alicePod.put(cast.alice.statusListUrl, JSON.stringify(reIssued), "application/ld+json", {
        overwrite: true,
    });
    let reRun;
    let reverted = false;
    try {
        // A FRESH key + status resolver (the cached one would not see the re-hosted list).
        const keyResolver = liveKeyResolver(discoveryFetch);
        reRun = await verifyAgentAuthority(chains.primary, {
            request: chains.request,
            rootPrincipal: cast.alice.webId,
            now,
            resolveKey: keyResolver.resolveKey,
            isControlledBy: keyResolver.isControlledBy,
            resolveStatus: liveStatusResolver(discoveryFetch, { now }),
            revoked: [],
            actor: cast.agentR.webId,
            actorChain: chains.actor,
        });
    }
    finally {
        // Revert: re-host the ORIGINAL clear list so a following audit sees a clean substrate.
        await alicePod.put(cast.alice.statusListUrl, original.body, original.contentType, {
            overwrite: true,
        });
        reverted = true;
    }
    return {
        reRunAuthorized: reRun.authorized,
        phase: reRun.phase,
        ...(reRun.code !== undefined && { code: reRun.code }),
        reverted,
    };
}
//# sourceMappingURL=negative.js.map