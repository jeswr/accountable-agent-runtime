import type { VerifiableCredential } from "@jeswr/solid-vc";
import { Store } from "n3";
import { type VerifyAuthorityResult, verifyAgentAuthority } from "../chain-verifier/index.js";
import type { OdrlPolicy } from "../odrl.js";
/** A stored pod resource. */
export interface StoredResource {
    readonly body: string;
    readonly contentType: string;
}
/**
 * A read source over the pod (Phase 0: the in-memory double; Phase 2: authed fetch).
 *
 * SECURITY — this source is the SSRF boundary. `loadTrace` dereferences policy
 * documents at IRIs read from (untrusted) credentials in the trace. A NETWORK-backed
 * `ResourceSource` MUST therefore be SSRF-guarded itself (e.g. `@jeswr/guarded-fetch`:
 * https-only, private/loopback/metadata ranges blocked, no auto-redirect) — exactly
 * the discipline `@jeswr/solid-agent-card`'s `discoverAgent` documents for its fetch.
 * `loadTrace` additionally scheme-checks + allowlist-filters every policy IRI before
 * dereferencing (see {@link LoadTraceOptions.isPolicyUrlAllowed}), but the source is
 * the last line of defence.
 */
export interface ResourceSource {
    get(url: string): Promise<StoredResource | undefined> | StoredResource | undefined;
    list(prefix: string): Promise<readonly string[]> | readonly string[];
}
/** Options for {@link loadTrace}. */
export interface LoadTraceOptions {
    /**
     * A predicate gating WHICH policy-document URLs (dereferenced from credential
     * `svc:policy` IRIs) `loadTrace` may fetch — the caller's allowlist against a
     * malicious trace pointing policy IRIs at arbitrary hosts. When omitted, only the
     * scheme guard applies (http(s), no embedded credentials). Runs BEFORE any fetch.
     */
    readonly isPolicyUrlAllowed?: (url: string) => boolean;
}
/** The loaded, parsed engagement trace the auditor queries. */
export interface LoadedTrace {
    readonly base: string;
    /** The combined PROV graph (chain overlay + every activity bundle). */
    readonly graph: Store;
    /** The engagement policies, by IRI. */
    readonly policies: ReadonlyMap<string, OdrlPolicy>;
    /** The binding credentials, by the policy IRI each binds (`svc:policy`). */
    readonly credentialsByPolicy: ReadonlyMap<string, VerifiableCredential>;
    /** The recorded decisions (G9), for the recorded-vs-re-run divergence check. */
    readonly recordedDecisions: readonly RecordedDecision[];
    /** The revoked policy IRIs the trace itself publishes (`revocations.ttl`, Phase C). */
    readonly revokedPolicies: readonly string[];
    /** The root principal (the root policy's assigner). */
    readonly rootPrincipal?: string;
}
/** A projection of a recorded decision record (G9) — the recorded request + verdict. */
export interface RecordedDecision {
    readonly requestTarget?: string;
    readonly requestAction?: string;
    readonly requestPurpose?: string;
    readonly requestAgent?: string;
    readonly decision: string;
}
/**
 * Load + parse the engagement trace from the pod: the PROV overlay + every activity
 * bundle into one query graph; the policy files + credentials into typed maps.
 */
export declare function loadTrace(source: ResourceSource, base: string, options?: LoadTraceOptions): Promise<LoadedTrace>;
/** One link in the authority chain the auditor recovers. */
export interface AuthorityLink {
    readonly policy: string;
    readonly attributedTo?: string;
}
/** The result of an audit walk over one derived artifact. */
export interface AuditReport {
    readonly artifact: string;
    /** `true` when NO activity in the trace claims to have generated the artifact
     *  (the mirrored-trace divergence a PROV-omitting actor leaves). */
    readonly provGap: boolean;
    readonly activity?: string;
    readonly actingAgent?: string;
    readonly onBehalfOf?: string;
    readonly leafPolicy?: string;
    /** The authority chain, root → leaf, each with its `prov:wasAttributedTo` party. */
    readonly authorityChain: readonly AuthorityLink[];
    readonly used: readonly string[];
    readonly actionInstant?: string;
    /** The independent four-phase re-run at the action instant. */
    readonly reRun?: VerifyAuthorityResult;
    /** `true` when the re-run's decision differs from the recorded decision — a finding. */
    readonly divergence?: boolean;
    /** The dispute re-run with the ACTUAL use — a breach when Phase D then denies. */
    readonly dispute?: {
        readonly actualUsePurpose: string;
        readonly authorized: boolean;
        readonly reason: string;
        readonly breach: boolean;
    };
}
/** Options for {@link auditArtifact}. */
export interface AuditOptions {
    /** Resolve a `verificationMethod` to a public key (for the four-phase re-run). */
    readonly resolveKey: Parameters<typeof verifyAgentAuthority>[1]["resolveKey"];
    /** The issuer↔key controller check to use in the re-run (G4 stub). */
    readonly isControlledBy?: Parameters<typeof verifyAgentAuthority>[1]["isControlledBy"];
    /** The revoked set to consult in the re-run (Phase C). */
    readonly revoked?: readonly string[];
    /** The purpose evident in the offending artifact — drives the dispute re-run. */
    readonly actualUsePurpose?: string;
}
/**
 * Walk the trace for one derived artifact and answer the accountability questions,
 * including an independent four-phase re-run at the action instant and (when
 * `actualUsePurpose` is supplied) the dispute re-run.
 */
export declare function auditArtifact(trace: LoadedTrace, artifact: string, options: AuditOptions): Promise<AuditReport>;
//# sourceMappingURL=reader.d.ts.map