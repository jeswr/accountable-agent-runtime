<!-- AUTHORED-BY Claude Fable 5 -->

# Design decisions

Rationale per load-bearing call, for maintainer review (proceed-and-document rule). D-numbers
are stable references.

**D1 — the runtime is a COMPOSITION, not a platform.** Every capability that exists in an M1–M4
package is called, never reimplemented; the runtime adds only (a) the composed four-phase chain
verifier (which the credential note explicitly assigns to "the integration layer" — no package
owns it by design), (b) the trace writer/reader, and (c) the scripted scenario. Alternative
rejected: a fat `@jeswr/solid-agent` framework first — premature; the paper needs the *scenario*
demonstrable, and the reusable carrier should be extracted from a working scenario, not
speculated.

**D2 — the four-phase verifier is built runtime-local FIRST, extracted later.** Target name when
extracted: `@jeswr/agent-authz-verifier`. Extraction trigger: a second consumer (a relying
server, PM, or federation-trust). Building it as a package on day one would freeze an API before
the scenario has stress-tested it — the exact mistake this design exists to catch in others.

**D3 — the trace lives in BOTH parties' pods + LDN copies, because PROV is self-reported.** A
single-writer trace is silently editable by its writer. Mirroring + LDN-pushing activity bundles
to the counterparty's inbox gives the auditor divergence evidence (and the pod server's own audit
log is a third, agent-independent record). Alternative rejected: a transparency log (RFC 9162
style) — right long-term (the R6 audit spine already names it), too heavy for the reference
runtime; noted as future work, not designed here.

**D4 — decision records use a provisional `w3id.org/jeswr/accountable-agent#` shape (G9).** The
ODRL CG Formal Semantics draft's report model (`PolicyReport`/`RuleReport`/…) is the right
eventual home but its namespace is literally "to be defined" (verified 2026-07-03) — binding
fail-closed tooling to an undefined namespace is worse than minting minimally with a documented
re-basing plan. Minted terms are the reified fields of `DelegatedEvaluationResult` only.

**D5 — audit-time verification uses `now` = the action instant, and optionally the current
instant.** "Was this authorized?" is a question about the moment of action; "is it still?" is a
different question. Conflating them makes either stale-replay or retroactive-revocation
paradoxes. This follows the credential note's one-instant-across-phases rule, applied twice.

**D6 — the mirrored-credentials pattern stands in for countersigned Agreements (G15).** VC 2.0
multi-proof issuance is unexposed in solid-vc; two credentials each binding digest-equal
agreement content give the verifier "both parties signed these terms" without new crypto surface.
Native multi-proof is a solid-vc follow-up, not a runtime blocker.

**D7 — Phase 0 uses REAL crypto, doubled I/O.** `solid-vc` signing/verifying is pure and fast, so
the deterministic scenario doubles only the pod/network (in-memory fetch) and the clock — never
the security-relevant code paths. A scenario that stubs the signatures would demonstrate nothing.

**D8 — negative acts are first-class scenario content.** The demo ships the forged hop, the
out-of-scope use, the revoked subtree, and the PROV-omitting actor alongside the happy path. An
accountability demonstration that only shows compliance is marketing; the §4 claim is only
credible where the failure modes are exercised (the suite's adversarial-verify discipline,
applied to the artifact itself).

**D9 — the identity-composition rule (from roborev round 1).** The first draft granted WAC to
`agentR` while the leaf agreement named `inst` as assignee — Phase D would correctly deny the
acting agent (the reviewer's Medium). Rather than flip the assignee to `agentR` (which would
detach *legal* accountability from the organisation the paper attaches it to), the verifier spec
gains an explicit composition rule: an acting WebID `w ≠ leaf assignee p` is covered only by a
second four-phase-verified chain whose trusted root principal is `p` (the institute's own
AgentAuthorizationCredential over its agent). This keeps org-level accountability AND a
verifiable `prov:actedOnBehalfOf` edge, and forecloses the tempting fail-open of skipping the
leaf-assignee check. Alternative rejected: extending Alice's chain with an inst→agentR hop —
that would require Alice's agreement to carry `grantUse` for inst (widening Alice's grant) and
puts the institute's internal delegation under Alice's policy authority, which is backwards.
