// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T6 — the AUDITOR, over a live pod, with ZERO credentials (design §5). This wraps the
// SHIPPED `loadTrace` + `auditArtifact` (the mechanical walk — no new audit logic) with:
//   • a server-root-scoped {@link LivePod} over the loopback SSRF-guarded discovery fetch as
//     the read SOURCE — it reads only PUBLIC resources across the pods, presents no token;
//   • the LIVE production resolvers ({@link liveKeyResolver}/{@link liveStatusResolver}) for
//     the four-phase re-run;
//   • engagement discovery from the artifact (`prov:wasGeneratedBy` → the activity → its
//     container) when the caller does not pass one;
//   • the versioned JSON `AuditReport` envelope (§5.3) + the human transcript (§5.2) + the
//     verdict exit codes (0 clean / 3 breach / 4 divergence / 5 provGap / 2 unwalkable).
//
// It authenticates NOTHING: if the trace is not publicly readable the read throws and the
// caller surfaces an honest "auditor needs read access" (exit 2), never a credentialed
// fallback.
import { DataFactory, Store } from "n3";
import { parseTurtle } from "../rdf.js";
import { auditArtifact, loadTrace } from "../trace/index.js";
import { PROV_WAS_GENERATED_BY } from "../vocab.js";
import { createDiscoveryFetch } from "./fetch.js";
import { LivePod, LivePodError } from "./pod.js";
import { liveKeyResolver, liveStatusResolver } from "./resolvers.js";
const { namedNode } = DataFactory;
/** The versioned audit-report schema IRI (§5.3; the provisional `w3id.org/jeswr` family). */
export const AUDIT_REPORT_SCHEMA = "https://w3id.org/jeswr/accountable-agent/audit-report/v1";
/** Raised when the auditor cannot walk the trace (unreadable / unresolvable). */
export class AuditUnwalkable extends Error {
    constructor(message, options = {}) {
        super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
        this.name = "AuditUnwalkable";
    }
}
/** The verdict exit code from a completed report (never the unwalkable 2 — that is thrown). */
export function exitCodeFor(report) {
    if (report.provGap) {
        return 5;
    }
    if (report.dispute?.breach === true) {
        return 3;
    }
    if (report.divergence === true) {
        return 4;
    }
    return 0;
}
/** Discover the engagement container of an artifact via `prov:wasGeneratedBy` → its activity. */
async function discoverEngagement(source, artifact) {
    let resource;
    try {
        resource = await source.get(artifact);
    }
    catch (error) {
        throw new AuditUnwalkable(`cannot read the artifact ${artifact} (auditor needs read access)`, {
            cause: error,
        });
    }
    if (resource === undefined) {
        throw new AuditUnwalkable(`artifact ${artifact} not found`);
    }
    const dataset = await parseTurtle(resource.body, resource.contentType, artifact);
    const store = new Store();
    store.addQuads([...dataset]);
    const activity = store.getQuads(namedNode(artifact), namedNode(PROV_WAS_GENERATED_BY), null, null)[0]?.object.value;
    if (activity === undefined) {
        throw new AuditUnwalkable(`artifact ${artifact} declares no prov:wasGeneratedBy — pass --engagement explicitly`);
    }
    const activityDoc = (() => {
        const u = new URL(activity);
        u.hash = "";
        return u.toString();
    })();
    const match = activityDoc.match(/^(.*\/)activities\/[^/]+$/);
    if (match?.[1] === undefined) {
        throw new AuditUnwalkable(`cannot derive the engagement container from ${activity} — pass --engagement explicitly`);
    }
    return match[1];
}
/**
 * Audit a derived artifact over a live pod with zero credentials. Discovers the engagement
 * container when not given, loads + walks the trace, and returns the report + versioned
 * envelope + verdict exit code.
 *
 * @throws AuditUnwalkable when the trace / artifact is unreadable or malformed (exit 2).
 */
export async function auditLive(options) {
    const discoveryFetch = createDiscoveryFetch(options.base);
    const source = new LivePod({ fetch: discoveryFetch, base: options.base });
    const keyResolver = liveKeyResolver(discoveryFetch);
    const serverOrigin = new URL(options.base).origin;
    const engagement = options.engagement ?? (await discoverEngagement(source, options.artifact));
    let report;
    try {
        const trace = await loadTrace(source, engagement, {
            // Fail-closed: only dereference policy IRIs on the SAME server origin as the trace.
            isPolicyUrlAllowed: (url) => {
                try {
                    return new URL(url).origin === serverOrigin;
                }
                catch {
                    return false;
                }
            },
        });
        report = await auditArtifact(trace, options.artifact, {
            resolveKey: keyResolver.resolveKey,
            isControlledBy: keyResolver.isControlledBy,
            resolveStatus: liveStatusResolver(discoveryFetch, options.at !== undefined ? { now: options.at } : {}),
            ...(options.revoked !== undefined && { revoked: options.revoked }),
            ...(options.actualUsePurpose !== undefined && {
                actualUsePurpose: options.actualUsePurpose,
            }),
        });
    }
    catch (error) {
        if (error instanceof AuditUnwalkable) {
            throw error;
        }
        if (error instanceof LivePodError && error.status !== undefined && error.status !== 404) {
            throw new AuditUnwalkable(`auditor needs read access to ${engagement} (server returned ${error.status})`, { cause: error });
        }
        throw new AuditUnwalkable(`could not walk the trace at ${engagement}`, { cause: error });
    }
    const envelope = {
        // biome-ignore lint/style/useNamingConvention: the `$schema` key is fixed by the §5.3 envelope contract.
        $schema: AUDIT_REPORT_SCHEMA,
        generatedAt: new Date().toISOString(),
        auditor: { credentialsPresented: false },
        trace: { engagement, source: options.base },
        report,
    };
    return { report, envelope, engagement, exitCode: exitCodeFor(report) };
}
/** Render the human transcript (§5.2) — read top-down as the answer to the three questions. */
export function renderTranscript(result) {
    const { report, engagement } = result;
    const lines = [];
    const push = (s = "") => {
        lines.push(s);
    };
    push(`AUDIT  ${report.artifact}`);
    push(`       trace: ${engagement}   read: public (no credentials presented)`);
    push();
    push("WHO AUTHORIZED THIS ACTION?");
    if (report.provGap) {
        push("  provGap: NO activity in the trace claims to have generated this artifact.");
        push("  ⇒ the absence itself is the finding (a PROV-omitting actor / mirrored-trace");
        push("    divergence). The server's own access log is the non-repudiable floor.");
        push();
        push(`VERDICT  breach=${String(report.dispute?.breach === true)}  divergence=${String(report.divergence === true)}  provGap=true`);
        return lines.join("\n");
    }
    push(`  artifact      ${report.artifact}`);
    if (report.activity !== undefined) {
        push(`    generated by  ${report.activity}${report.actionInstant !== undefined ? `   at ${report.actionInstant}` : ""}`);
    }
    if (report.actingAgent !== undefined) {
        push(`    acting agent  ${report.actingAgent}        (prov:wasAssociatedWith)`);
    }
    if (report.onBehalfOf !== undefined) {
        push(`    on behalf of  ${report.onBehalfOf}      (prov:actedOnBehalfOf)`);
    }
    push("  authority chain (root → leaf):");
    report.authorityChain.forEach((link, i) => {
        push(`    [${i + 1}] ${link.policy}${link.attributedTo !== undefined ? `   attributed to ${link.attributedTo}` : ""}`);
    });
    if (report.actingAgent !== undefined &&
        report.onBehalfOf !== undefined &&
        report.actingAgent !== report.onBehalfOf) {
        push("  identity composition:");
        push(`    leaf assignee ${report.onBehalfOf} ≠ acting agent ${report.actingAgent}`);
        push(`    second (actor) chain verified via the re-run (D9).`);
    }
    push();
    push("UNDER WHAT POLICY?");
    if (report.leafPolicy !== undefined) {
        push(`  leaf agreement ${report.leafPolicy}`);
    }
    for (const used of report.used) {
        push(`    on  ${used}`);
    }
    push();
    push("WAS IT IN SCOPE?");
    if (report.reRun !== undefined) {
        const decision = report.reRun.authorized ? "PERMIT" : "DENY";
        push(`  four-phase re-run at the action instant: ${decision}  (phase ${report.reRun.phase}${report.reRun.code !== undefined ? `, ${report.reRun.code}` : ""})`);
        push(`  recorded-vs-re-run divergence: ${report.divergence === true ? "YES — a finding" : "none"}`);
    }
    else {
        push("  four-phase re-run: not performed (insufficient trace to reconstruct the request)");
    }
    if (report.dispute !== undefined) {
        push(`  DISPUTE — actual use purpose ${report.dispute.actualUsePurpose}:`);
        push(`    ${report.dispute.authorized ? "PERMIT" : "DENY"}  — ${report.dispute.reason}`);
        if (report.dispute.breach) {
            push("    ⇒ BREACH: the action was authorized; THIS USE was not.");
        }
    }
    push();
    push(`VERDICT  breach=${String(report.dispute?.breach === true)}  divergence=${String(report.divergence === true)}  provGap=${String(report.provGap)}`);
    return lines.join("\n");
}
//# sourceMappingURL=audit.js.map