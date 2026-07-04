import type { PresentedResourceContent, VerifiableCredential, VerifyCredentialOptions } from "@jeswr/solid-vc";
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
 * A presented delegation chain: the AgentAuthorizationCredentials (any order), the
 * ODRL policies they bind, and — the G1 policy-content binding — the RAW policy
 * documents, keyed by the policy IRI each credential binds (`svc:policy`).
 *
 * `policyContents` MUST be the raw FETCHED document bytes (Turtle by default), NOT a
 * re-serialisation of the parsed {@link OdrlPolicy} — a lossy parse→re-emit can drop
 * triples the issuer signed over, silently breaking (or, worse, laundering) the
 * digest. When a hop's content is present, `verifyCredential` recomputes its
 * RDFC-1.0 canonical digest and compares it against the credential's SIGNED
 * `relatedResource` `digestMultibase`, fail-closed (`POLICY_INTEGRITY` deny on a
 * missing digest or a mismatch). When every hop's content is presented and passes,
 * the permit's `policyIntegrityProvisional` is `false`; a hop presented WITHOUT
 * content falls back to the trusted-by-location reading and keeps the honest
 * provisional marker.
 */
export interface PresentedChain {
    readonly credentials: readonly VerifiableCredential[];
    readonly policies: readonly OdrlPolicy[];
    /** RAW fetched policy-document content by policy IRI (the G1 digest gate input). */
    readonly policyContents?: Readonly<Record<string, PresentedResourceContent>>;
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
    /**
     * When set, the chain's leaf assignee MUST equal this WebID (else deny in Phase B).
     * Used by the D9 identity composition to PIN the second chain's leaf assignee to the
     * authenticated `actor` — without it, a second chain rooted correctly but authorizing
     * some OTHER party would be wrongly accepted for `actor` (Phase D pins the request to
     * the chain's own leaf assignee, so the actor identity must be checked explicitly).
     */
    readonly requireLeafAssignee?: string;
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
     * `true` when the permit (still) rests on a trusted-by-location policy binding
     * for at least one hop — i.e. that hop's raw policy content was NOT presented in
     * {@link PresentedChain.policyContents}, so its signed `relatedResource` digest
     * (if any) could not be checked. `false` IFF every hop of this chain AND of the
     * identity-composition chain (when one ran) passed the G1 content-digest gate.
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