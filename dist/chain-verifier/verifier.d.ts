import type { VerifiableCredential, VerifyCredentialOptions } from "@jeswr/solid-vc";
import type { ActiveDuty, DelegatedEvaluationResult, OdrlPolicy, RequestContext } from "../odrl.js";
import { type VerifierErrorCode, type VerifierPhase } from "./errors.js";
/** The bound agent-authorization claim read from an AgentAuthorizationCredential. */
export interface BoundAuthorization {
    /** The issuer / subject / delegator (svc credential: issuer ≡ subject.id). */
    readonly principal: string;
    /** The delegate the credential authorizes (`svc:authorizes`). */
    readonly authorizes: string;
    /** The authorized action(s) (`svc:action`). */
    readonly action: readonly string[];
    /** The authorized target (`svc:target`), if any. */
    readonly target?: string;
    /** The bound ODRL policy IRI (`svc:policy`) — the hop this credential covers. */
    readonly policy?: string;
}
/**
 * A presented delegation chain: the AgentAuthorizationCredentials (any order) plus
 * the ODRL policies they bind. Phase 0/1 resolves each credential's `svc:policy`
 * IRI to the pod-fetched policy content — TRUSTED BY LOCATION (G1: `solid-vc` binds
 * only a bare policy IRI today, which the note flags as binding nothing
 * cryptographically; a permit therefore carries the `POLICY_INTEGRITY`-provisional
 * marker until the embedded/digest binding lands).
 */
export interface PresentedChain {
    readonly credentials: readonly VerifiableCredential[];
    readonly policies: readonly OdrlPolicy[];
}
/** Options for {@link verifyAgentAuthority}. */
export interface VerifyAuthorityOptions {
    /** The request context (action / target / constraint attributes like purpose+time). */
    readonly request: RequestContext;
    /** The trusted root principal for the target — the resource owner for the primary chain. */
    readonly rootPrincipal: string;
    /** The single evaluation instant across all phases (the note's one-instant rule). */
    readonly now: Date;
    /** Resolve a `verificationMethod` IRI to a public `CryptoKey` (G5: runtime-supplied). */
    readonly resolveKey: VerifyCredentialOptions["resolveKey"];
    /** Document-resolved issuer↔key controller check (G4). Defaults to solid-vc's heuristic. */
    readonly isControlledBy?: VerifyCredentialOptions["isControlledBy"];
    /** Phase C: policy IRIs known revoked (G2: `odrld:Revocation` fixtures only in Phase 0/1). */
    readonly revoked?: readonly string[];
    /**
     * Phase C fail-closed hook: a status/revocation source that could not be
     * retrieved. When `true`, the verifier denies with `STATUS_RETRIEVAL_ERROR`
     * (the note's "retrieval failure must deny"). Phase 0 supplies the revoked set
     * directly, so this is the seam Phase 1's Bitstring-status fetch reports through.
     */
    readonly statusUnreachable?: boolean;
    /** Gate the permit on the AGGREGATE chain duties being discharged (Phase D). */
    readonly requireDuties?: boolean;
    /** Absolute chain-length cap (Phase D structural guard). */
    readonly maxChainLength?: number;
    /** The AUTHENTICATED acting WebID on the wire (D9 identity composition). */
    readonly actor?: string;
    /**
     * The SECOND chain (D9) rooted at the leaf assignee, authorizing `actor` — required
     * when `actor` differs from the primary chain's leaf assignee. Its trusted root
     * principal MUST equal that leaf assignee (composition rule: chain₂.root ≡ chain₁.leaf).
     */
    readonly actorChain?: PresentedChain;
}
/** The result of a four-phase verification. */
export interface VerifyAuthorityResult {
    /** `true` only when every phase (and, when applicable, the second chain) passed. */
    readonly authorized: boolean;
    /** The phase the result was decided in. */
    readonly phase: VerifierPhase;
    /** The deny code (absent on an authorize). */
    readonly code?: VerifierErrorCode;
    /** Human/agent-readable reason. */
    readonly reason: string;
    /** The chain's policy IRIs, ordered root-first (as far as assembly reached). */
    readonly chainPolicyIds: readonly string[];
    /** The Phase-D delegation decision (present once the chain reached Phase D). */
    readonly decision?: DelegatedEvaluationResult;
    /** The second-chain verification result (D9), when identity composition ran. */
    readonly actorResult?: VerifyAuthorityResult;
    /** The aggregate duties the permit is contingent on. */
    readonly duties: readonly ActiveDuty[];
    /**
     * `true` when the permit rests on the G1 trusted-by-location policy binding (a
     * bare-IRI `svc:policy`, cryptographically un-bound). Honest provisional marker;
     * flips to `false` once `solid-vc` embeds/digests the policy (Phase 1, G1).
     */
    readonly policyIntegrityProvisional: boolean;
}
/**
 * Read the AgentAuthorizationCredential's bound claim from its subject graph —
 * `issuer` is the principal (solid-vc asserts issuer ≡ subject.id); the subject
 * carries `svc:authorizes` / `svc:action` / `svc:target` / `svc:policy`.
 */
export declare function readBoundAuthorization(vc: VerifiableCredential): BoundAuthorization | undefined;
/**
 * Verify a presented delegation chain authorizes {@link VerifyAuthorityOptions.request},
 * fail-closed across assembly → Phase A → B → C → D (+ the D9 identity composition).
 * `now` is the single evaluation instant (pass the action's `prov:startedAtTime`
 * for an audit-time re-run — decision D5).
 */
export declare function verifyAgentAuthority(chain: PresentedChain, options: VerifyAuthorityOptions): Promise<VerifyAuthorityResult>;
//# sourceMappingURL=verifier.d.ts.map