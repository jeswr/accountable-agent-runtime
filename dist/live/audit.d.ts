import { type AuditReport } from "../trace/index.js";
/** The versioned audit-report schema IRI (§5.3; the provisional `w3id.org/jeswr` family). */
export declare const AUDIT_REPORT_SCHEMA = "https://w3id.org/jeswr/accountable-agent/audit-report/v1";
/** The machine-readable audit envelope (§5.3): the `AuditReport` verbatim, versioned. */
export interface AuditReportEnvelope {
    readonly $schema: string;
    readonly generatedAt: string;
    readonly auditor: {
        readonly credentialsPresented: false;
    };
    readonly trace: {
        readonly engagement: string;
        readonly source: string;
    };
    readonly report: AuditReport;
}
/** Options for {@link auditLive}. */
export interface AuditLiveOptions {
    /** The server root (loopback for the demo; a non-loopback base gets the https-only guard). */
    readonly base: string;
    /** The derived artifact IRI found in the wild. */
    readonly artifact: string;
    /** The engagement trace container; discovered from the artifact when omitted. */
    readonly engagement?: string;
    /** The purpose evident in the offending artifact — triggers the dispute re-run. */
    readonly actualUsePurpose?: string;
    /** The instant to re-run at (default: the activity's start instant, per stale-replay). */
    readonly at?: Date;
    /** Extra policy-level revoked IRIs to consult in Phase C. */
    readonly revoked?: readonly string[];
}
/** The full result of a live audit. */
export interface AuditLiveResult {
    readonly report: AuditReport;
    readonly envelope: AuditReportEnvelope;
    readonly engagement: string;
    /** 0 clean / 3 breach / 4 divergence / 5 provGap / 2 unwalkable. */
    readonly exitCode: number;
}
/** Raised when the auditor cannot walk the trace (unreadable / unresolvable). */
export declare class AuditUnwalkable extends Error {
    constructor(message: string, options?: {
        cause?: unknown;
    });
}
/** The verdict exit code from a completed report (never the unwalkable 2 — that is thrown). */
export declare function exitCodeFor(report: AuditReport): number;
/**
 * Audit a derived artifact over a live pod with zero credentials. Discovers the engagement
 * container when not given, loads + walks the trace, and returns the report + versioned
 * envelope + verdict exit code.
 *
 * @throws AuditUnwalkable when the trace / artifact is unreadable or malformed (exit 2).
 */
export declare function auditLive(options: AuditLiveOptions): Promise<AuditLiveResult>;
/** Render the human transcript (§5.2) — read top-down as the answer to the three questions. */
export declare function renderTranscript(result: AuditLiveResult): string;
//# sourceMappingURL=audit.d.ts.map