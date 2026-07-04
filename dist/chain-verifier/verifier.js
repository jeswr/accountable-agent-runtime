// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// ===========================================================================
//  G7 — the composed FOUR-PHASE agent-authorization chain verifier.
// ===========================================================================
//
// The one genuinely new piece of logic in the runtime (DESIGN §4, decision D2).
// The credential note assigns it to "the integration layer" — neither `solid-vc`
// nor `solid-odrl` owns it alone, by design. Built runtime-local FIRST; extract to
// `@jeswr/agent-authz-verifier` once a second consumer exists (D2).
//
// It composes, IN ORDER and FAIL-CLOSED:
//   assembly — extract each credential's bound policy, order the chain root-first
//              by `odrld:delegatedUnder`; reject cycles / branches / gaps.
//   Phase A  — `solid-vc.verifyCredential` on every credential at ONE instant
//              (`now`): signature, cryptosuite, validity window, proof purpose —
//              plus the G1 policy-content digest gate (`presentedResources`): the
//              presented raw policy document must match the credential's SIGNED
//              `relatedResource` digest, fail-closed (a pure digest failure is
//              surfaced as a Phase-B `POLICY_INTEGRITY` deny).
//   Phase B  — cross-binding: each hop's credential is issued by (and self-asserts
//              a subject of) that hop's `odrl:assigner`; the delegate it authorizes
//              is the NEXT hop's assigner; the ROOT credential's issuer is the
//              trusted root principal for the target.
//   Phase C  — status ∪ revocation, fail-closed: any chain policy in the revoked
//              set (Phase 0/1: `odrld:Revocation` fixtures; G2 defers the Bitstring
//              status-list gate) → deny; an UNREACHABLE status source → deny
//              (`STATUS_RETRIEVAL_ERROR`, the note's fail-closed rule).
//   Phase D  — `solid-odrl.evaluateDelegated` over the ordered chain (the G10 seam):
//              in-scope intersection, unexpired, unrevoked, depth-bounded, acyclic.
//
// Plus the D9 IDENTITY-COMPOSITION rule: Phase D always runs with the requesting
// agent pinned to the LEAF ASSIGNEE `p` (legal accountability attaches to the
// party the leaf agreement names). An authenticated actor `w ≠ p` is accepted ONLY
// via a SECOND four-phase-verified chain whose trusted root principal IS `p` and
// which permits `w` the requested action — forbidding the fail-open of skipping the
// leaf-assignee check (the roborev round-1 finding this design was hardened against).
import { verifyCredential } from "@jeswr/solid-vc";
import { evaluateDelegated } from "../odrl.js";
import { SVC_ACTION, SVC_AUTHORIZES, SVC_POLICY, SVC_TARGET } from "../vocab.js";
import { PHASE_A_CODES, RELATED_RESOURCE_CODES, } from "./errors.js";
// --- reading the bound authorization from a credential ---------------------
/** The credentialSubject as a claim record (first subject if an array). */
function subjectRecord(vc) {
    const subject = Array.isArray(vc.credentialSubject)
        ? vc.credentialSubject[0]
        : vc.credentialSubject;
    return subject && typeof subject === "object" ? subject : undefined;
}
/** Coerce a claim value to a string, or `undefined`. */
function claimString(value) {
    return typeof value === "string" ? value : undefined;
}
/** Coerce a claim value to a string array. */
function claimStrings(value) {
    if (typeof value === "string") {
        return [value];
    }
    if (Array.isArray(value)) {
        return value.filter((v) => typeof v === "string");
    }
    return [];
}
/**
 * Read the AgentAuthorizationCredential's bound claim from its subject graph —
 * `issuer` is the principal (solid-vc asserts issuer ≡ subject.id); the subject
 * carries `svc:authorizes` / `svc:action` / `svc:target` / `svc:policy`.
 */
export function readBoundAuthorization(vc) {
    const types = vc.type ?? [];
    if (!types.includes("AgentAuthorizationCredential")) {
        return undefined;
    }
    const subject = subjectRecord(vc);
    const principal = claimString(subject?.id) ?? vc.issuer;
    const authorizes = claimString(subject?.[SVC_AUTHORIZES]);
    if (subject === undefined || authorizes === undefined) {
        return undefined;
    }
    const action = claimStrings(subject[SVC_ACTION]);
    const target = claimString(subject[SVC_TARGET]);
    const policy = claimString(subject[SVC_POLICY]);
    return {
        principal,
        authorizes,
        action,
        ...(target !== undefined && { target }),
        ...(policy !== undefined && { policy }),
    };
}
/**
 * Order the policies root-first by `odrld:delegatedUnder`, fail-closed on any
 * anomaly: duplicate ids, missing ids, ≠1 root, a branch (a policy delegated-under
 * by more than one child), a cycle, or a gap (a disconnected policy).
 */
function assembleChain(policies) {
    if (policies.length === 0) {
        return { error: "no policies presented — nothing to assemble." };
    }
    const byId = new Map();
    for (const p of policies) {
        if (p.id === undefined || p.id === "") {
            return { error: "a presented policy has no id." };
        }
        if (byId.has(p.id)) {
            return { error: `duplicate policy id <${p.id}>.` };
        }
        byId.set(p.id, p);
    }
    // Roots: no delegatedUnder (or a delegatedUnder pointing outside the set is a gap).
    const roots = policies.filter((p) => p.delegatedUnder === undefined);
    for (const p of policies) {
        if (p.delegatedUnder !== undefined && !byId.has(p.delegatedUnder)) {
            return {
                error: `policy <${p.id}> is delegatedUnder <${p.delegatedUnder}>, which is not present (gap).`,
            };
        }
    }
    if (roots.length !== 1) {
        return {
            error: `expected exactly one root (a policy with no delegatedUnder); found ${roots.length}.`,
        };
    }
    // Children index — a policy delegated-under by more than one child is a branch.
    const childrenByParent = new Map();
    for (const p of policies) {
        if (p.delegatedUnder !== undefined) {
            const list = childrenByParent.get(p.delegatedUnder) ?? [];
            list.push(p);
            childrenByParent.set(p.delegatedUnder, list);
        }
    }
    for (const [parent, children] of childrenByParent) {
        if (children.length > 1) {
            return {
                error: `policy <${parent}> is delegated-under by ${children.length} children (a branch, not a linear chain).`,
            };
        }
    }
    // Walk root → single child, detecting cycles, until exhausted. Cursor by id
    // (a string) so the loop carries no self-referential policy type.
    const ordered = [];
    const visited = new Set();
    // biome-ignore lint/style/noNonNullAssertion: roots.length === 1 + ids validated
    let cursor = roots[0].id;
    while (cursor !== undefined) {
        if (visited.has(cursor)) {
            return { error: `cycle detected at <${cursor}>.` };
        }
        visited.add(cursor);
        const policy = byId.get(cursor);
        if (policy === undefined) {
            break;
        }
        ordered.push(policy);
        const kids = childrenByParent.get(cursor) ?? [];
        const next = kids[0];
        cursor = next?.id;
    }
    if (ordered.length !== policies.length) {
        return {
            error: `chain is disconnected: walked ${ordered.length} of ${policies.length} policies (gap or branch).`,
        };
    }
    return { ordered };
}
// --- helpers ---------------------------------------------------------------
function deny(phase, code, reason, chainPolicyIds = [], extra = {}) {
    return {
        authorized: false,
        phase,
        code,
        reason,
        chainPolicyIds,
        duties: [],
        policyIntegrityProvisional: false,
        ...extra,
    };
}
// --- the composed verifier -------------------------------------------------
/**
 * Verify a presented delegation chain authorizes {@link VerifyAuthorityOptions.request},
 * fail-closed across assembly → Phase A → B → C → D (+ the D9 identity composition).
 * `now` is the single evaluation instant (pass the action's `prov:startedAtTime`
 * for an audit-time re-run — decision D5).
 */
export async function verifyAgentAuthority(chain, options) {
    const { request, rootPrincipal, now, resolveKey } = options;
    // --- assembly ------------------------------------------------------------
    const assembled = assembleChain(chain.policies);
    if ("error" in assembled) {
        return deny("assembly", "CHAIN_MALFORMED", `Chain assembly failed: ${assembled.error}`);
    }
    const ordered = assembled.ordered;
    const chainIds = ordered.map((p) => p.id);
    // Map each hop policy to its binding credential (svc:policy ≡ policy.id).
    const bound = new Map();
    for (const vc of chain.credentials) {
        const auth = readBoundAuthorization(vc);
        if (auth === undefined) {
            return deny("B", "BINDING_MISMATCH", "A presented credential is not a well-formed AgentAuthorizationCredential.", chainIds);
        }
        if (auth.policy === undefined) {
            return deny("B", "BINDING_MISMATCH", `Credential from <${auth.principal}> binds no svc:policy — nothing to place in the chain.`, chainIds);
        }
        if (bound.has(auth.policy)) {
            return deny("B", "BINDING_MISMATCH", `More than one credential binds policy <${auth.policy}>.`, chainIds);
        }
        bound.set(auth.policy, { vc, auth });
    }
    if (bound.size !== ordered.length) {
        return deny("B", "BINDING_MISMATCH", `Credential/policy count mismatch: ${bound.size} bound credential(s) for ${ordered.length} chain hop(s).`, chainIds);
    }
    for (const p of ordered) {
        if (!bound.has(p.id)) {
            return deny("B", "BINDING_MISMATCH", `Chain hop <${p.id}> has no binding credential.`, chainIds);
        }
    }
    // --- Phase A: every credential, one instant (+ the G1 content-digest gate) --
    // Each hop's credential is verified WITH its presented policy content (when the
    // chain carries it): solid-vc recomputes the RDFC-1.0 canonical digest of the raw
    // document and compares it to the credential's SIGNED `relatedResource`
    // `digestMultibase`, fail-closed — a substituted/mutated policy behind the
    // (mutable) `svc:policy` IRI can no longer verify.
    const contents = chain.policyContents ?? {};
    for (const hop of ordered) {
        // biome-ignore lint/style/noNonNullAssertion: every hop bound (checked above)
        const b = bound.get(hop.id);
        const presented = contents[hop.id];
        const res = await verifyCredential(b.vc, {
            resolveKey,
            ...(options.isControlledBy !== undefined && { isControlledBy: options.isControlledBy }),
            expectedProofPurpose: "assertionMethod",
            now,
            ...(presented !== undefined && { presentedResources: { [hop.id]: presented } }),
        });
        if (!res.verified) {
            const detail = res.errors.map((e) => e.message).join("; ");
            // A genuine Phase-A failure (signature/validity/issuer/…) always wins; a
            // PURE digest-binding failure is the G1 `POLICY_INTEGRITY` deny (Phase B
            // semantics — the credential↔policy-content cross-binding broke).
            const phaseAError = res.errors.find((e) => PHASE_A_CODES.has(e.code));
            if (phaseAError === undefined && res.errors.some((e) => RELATED_RESOURCE_CODES.has(e.code))) {
                return deny("B", "POLICY_INTEGRITY", `Policy-content binding failed for <${hop.id}>: ${detail}`, chainIds);
            }
            const code = phaseAError !== undefined ? phaseAError.code : "INVALID_SIGNATURE";
            return deny("A", code, `Phase A (credential verification) failed: ${detail}`, chainIds);
        }
    }
    // The permit is fully content-bound (non-provisional) only when EVERY hop's raw
    // policy content was presented — and therefore digest-checked above, fail-closed.
    const allContentBound = ordered.every((p) => contents[p.id] !== undefined);
    // --- Phase B: cross-binding ----------------------------------------------
    // biome-ignore lint/style/noNonNullAssertion: ordered non-empty (assembly)
    const rootHop = ordered[0];
    // biome-ignore lint/style/noNonNullAssertion: every hop bound (checked above)
    const rootBound = bound.get(rootHop.id);
    if (rootBound.auth.principal !== rootPrincipal) {
        return deny("B", "BINDING_MISMATCH", `Root credential issuer <${rootBound.auth.principal}> is not the trusted root principal <${rootPrincipal}> for this target.`, chainIds);
    }
    for (let i = 0; i < ordered.length; i++) {
        // biome-ignore lint/style/noNonNullAssertion: i in bounds
        const hop = ordered[i];
        // biome-ignore lint/style/noNonNullAssertion: every hop bound
        const b = bound.get(hop.id);
        // The hop's credential must be issued by (and self-assert a subject of) the
        // hop's assigner (the delegator). solid-vc already tied issuer ≡ subject.id;
        // here we tie both to the ODRL assigner.
        if (hop.assigner !== undefined && b.auth.principal !== hop.assigner) {
            return deny("B", "BINDING_MISMATCH", `Hop <${hop.id}> assigner <${hop.assigner}> ≠ its credential's issuer/subject <${b.auth.principal}>.`, chainIds);
        }
        // The delegate this hop authorizes must be the NEXT hop's assigner (the chain
        // linkage) — and, at the leaf, the party the leaf agreement names as assignee.
        if (i + 1 < ordered.length) {
            // biome-ignore lint/style/noNonNullAssertion: i+1 in bounds
            const nextHop = ordered[i + 1];
            if (nextHop.assigner === undefined) {
                return deny("B", "BINDING_MISMATCH", `Hop <${nextHop.id}> has no assigner to bind to its parent's authorized delegate.`, chainIds);
            }
            if (b.auth.authorizes !== nextHop.assigner) {
                return deny("B", "BINDING_MISMATCH", `Hop <${hop.id}> authorizes <${b.auth.authorizes}> but the next hop's assigner is <${nextHop.assigner}> — broken delegation linkage.`, chainIds);
            }
        }
    }
    // The leaf assignee `p`: the party the leaf credential authorizes (must agree
    // with the leaf policy's assignee where it states one).
    // biome-ignore lint/style/noNonNullAssertion: ordered non-empty
    const leafHop = ordered[ordered.length - 1];
    // biome-ignore lint/style/noNonNullAssertion: leaf hop bound
    const leafBound = bound.get(leafHop.id);
    const leafAssignee = leafBound.auth.authorizes;
    if (leafHop.assignee !== undefined && leafHop.assignee !== leafAssignee) {
        return deny("B", "BINDING_MISMATCH", `Leaf policy <${leafHop.id}> assignee <${leafHop.assignee}> ≠ the party its credential authorizes <${leafAssignee}>.`, chainIds);
    }
    // D9 pin: when the caller requires a specific leaf assignee (the identity
    // composition pins the second chain's leaf to the authenticated actor), the chain
    // MUST prove authority for exactly that party. Without this, a chain rooted
    // correctly but authorizing some OTHER party would be accepted, because Phase D
    // always evaluates the chain's OWN leaf assignee (the roborev round-1 HIGH).
    if (options.requireLeafAssignee !== undefined && leafAssignee !== options.requireLeafAssignee) {
        return deny("B", "BINDING_MISMATCH", `Chain leaf assignee <${leafAssignee}> ≠ the required party <${options.requireLeafAssignee}>.`, chainIds);
    }
    // --- Phase C: status ∪ revocation, fail-closed ---------------------------
    if (options.statusUnreachable === true) {
        return deny("C", "STATUS_RETRIEVAL_ERROR", "A revocation/status source could not be retrieved — denying (fail-closed).", chainIds);
    }
    const revoked = new Set(options.revoked ?? []);
    for (const p of ordered) {
        if (revoked.has(p.id)) {
            return deny("C", "REVOKED", `Chain policy <${p.id}> has been revoked.`, chainIds);
        }
    }
    // --- Phase D: the delegation-profile chain walk --------------------------
    // Pin the requesting agent to the LEAF ASSIGNEE (D9): legal accountability
    // attaches to the party the leaf agreement names, not to whoever authenticated.
    const primaryRequest = { ...request, agent: leafAssignee };
    const decision = evaluateDelegated(ordered, primaryRequest, {
        now,
        revoked: [...revoked],
        ...(options.requireDuties !== undefined && { requireDuties: options.requireDuties }),
        ...(options.maxChainLength !== undefined && { maxChainLength: options.maxChainLength }),
    });
    if (decision.decision !== "permit") {
        return deny("D", "POLICY_DENIED", `Phase D denied: ${decision.reason}`, chainIds, {
            decision,
            duties: decision.duties,
        });
    }
    // --- D9 identity composition ---------------------------------------------
    // The authenticated actor `w`. When `w ≠ p` (leaf assignee), `w` is authorized
    // ONLY via a second four-phase-verified chain rooted at `p`.
    let actorResult;
    if (options.actor !== undefined && options.actor !== leafAssignee) {
        if (options.actorChain === undefined) {
            return deny("composition", "IDENTITY_COMPOSITION_FAILED", `Acting WebID <${options.actor}> is not the leaf assignee <${leafAssignee}>, and no second chain rooted at <${leafAssignee}> was presented to authorize it.`, chainIds, {
                decision,
            });
        }
        actorResult = await verifyAgentAuthority(options.actorChain, {
            request: { ...request, agent: options.actor },
            rootPrincipal: leafAssignee, // composition rule: chain₂.root ≡ chain₁.leaf
            // PIN chain₂'s leaf assignee to the actor — chain₂ must prove authority for
            // `actor` itself, not for some other party it happens to be rooted to name.
            requireLeafAssignee: options.actor,
            now,
            resolveKey,
            ...(options.isControlledBy !== undefined && { isControlledBy: options.isControlledBy }),
            ...(options.revoked !== undefined && { revoked: options.revoked }),
            ...(options.statusUnreachable !== undefined && {
                statusUnreachable: options.statusUnreachable,
            }),
            ...(options.requireDuties !== undefined && { requireDuties: options.requireDuties }),
            ...(options.maxChainLength !== undefined && { maxChainLength: options.maxChainLength }),
            // the actor of chain₂ is its own leaf assignee (w authenticates as itself)
        });
        if (!actorResult.authorized) {
            return deny("composition", "IDENTITY_COMPOSITION_FAILED", `The second (identity-composition) chain for actor <${options.actor}> did not verify: ${actorResult.reason}`, chainIds, {
                decision,
                actorResult,
            });
        }
        // The second chain must actually authorize the ACTOR (its leaf assignee ≡ w).
        // verifyAgentAuthority already pins Phase D to chain₂'s leaf assignee; confirm
        // that leaf assignee is the actor so the chain proves `w`, not a third party.
        if (actorResult.decision === undefined) {
            return deny("composition", "IDENTITY_COMPOSITION_FAILED", "The second chain produced no Phase-D decision.", chainIds, { decision });
        }
    }
    return {
        authorized: true,
        phase: "complete",
        reason: actorResult !== undefined
            ? `Authorized: the ${ordered.length}-hop chain permits the leaf assignee <${leafAssignee}>, and a second chain rooted at <${leafAssignee}> authorizes the acting agent <${options.actor}>.`
            : `Authorized: the ${ordered.length}-hop chain permits the request for <${leafAssignee}>.`,
        chainPolicyIds: chainIds,
        decision,
        ...(actorResult !== undefined && { actorResult }),
        duties: decision.duties,
        // G1 (Phase 1: REAL) — `false` only when every hop of THIS chain and of the
        // identity-composition chain (when one ran) was content-digest-verified above;
        // any hop presented without raw content keeps the honest provisional marker.
        policyIntegrityProvisional: !allContentBound || (actorResult?.policyIntegrityProvisional ?? false),
    };
}
//# sourceMappingURL=verifier.js.map