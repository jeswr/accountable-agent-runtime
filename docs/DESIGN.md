<!-- AUTHORED-BY Claude Fable 5 -->

# Accountable Agent Runtime — design

**Status:** design-only (no code yet). This document is the buildable design for a **reference
accountable-agent runtime**: the small executable that composes the now-complete agentic stack —
`@jeswr/solid-agent-card` (M1), `@jeswr/solid-a2a` (M2), `@jeswr/solid-odrl` (M3, plus its
agent-delegation profile), `@jeswr/solid-vc` (M4), and the Agent Authorization Credentials note —
into the [Accountable Web of Agents](https://github.com/jeswr/agentic-solid-vision) vision paper's
**§4 worked accountability scenario**, made executable end to end. The paper itself names the gap
this closes (§5.5): *"the agent runtime that carries the §3 handshake over live transports (the
codec libraries exist; the long-running carrier is in design)"* — this is that design.

The runtime's deliverable is dual: the **running scenario** and the **accountability trace** it
leaves behind — the on-pod artifact from which an auditor answers, mechanically, *who authorized
this action, under what policy, and was it in scope?*

- The step-by-step API walk of the scenario: [`SCENARIO.md`](./SCENARIO.md).
- The phased build plan: [`../BUILD-PLAN.md`](../BUILD-PLAN.md).
- Design rationale per decision: [`DECISIONS.md`](./DECISIONS.md).

> ⚠️ Experimental, AI-agent-authored (Claude Fable 5), design pending maintainer steer. Nothing
> here claims production readiness; the composed packages are all explicitly experimental.

---

## 1. Verified inputs (what this design builds ON, not redesigns)

All checked against the working trees / branches on 2026-07-03:

| Input | Version verified | What it contributes |
|---|---|---|
| Vision paper §4 (`agentic-solid-vision/docs/PAPER.md`) | current main | the scenario narrative: setup → negotiation → agreement → action → dispute, and the three honest caveats (enforcement is legal not cryptographic; policy semantics; server-side enforcement staged) |
| `@jeswr/solid-agent-card` | `etc/solid-agent-card.api.md` (main) | `describeAgent`, `discoverAgent`, `verifyDescriptor`, `buildAgentPointer`, `AgentDescriptor.protocolSources`, well-known paths |
| `@jeswr/solid-a2a` | README + exports (main) | `parseIntent` (+ injected `translate` seam), `validateIntent`, `buildProtocolDocument`/`verifyProtocolDocument` (sha256 hash-pinned SHACL PD), the upgrade-handshake codec + `mayDowngradeToNl`; **codec only — no transport, by design** |
| `@jeswr/solid-odrl` main | README + `src/index.ts` | policy express/parse (`policyToTurtle`/`parsePolicy`), pure `evaluate`, `requestContextFromA2AIntent`, `requestContextFromWac` |
| `@jeswr/solid-odrl` **`feat/delegation-profile` @ `18df183`** | `docs/delegation-profile.md` + `src/delegation.ts` | the ODRL agent-delegation profile (`https://w3id.org/jeswr/odrl-delegation`, `odrld:`): `evaluateDelegated(chain, request, {now, revoked, maxChainLength})` fail-closed chain walker; `delegationProvenance(chain)` PROV overlay; policy round-trip includes `profile` + `delegatedUnder` |
| `@jeswr/solid-vc` | `etc/solid-vc.api.md` (main) | VC 2.0 + Data Integrity (`eddsa-rdfc-2022`/`ecdsa-rdfc-2019`): `issue`, `verifyCredential` (structured error codes), `issueAgentAuthorization`/`buildAgentAuthorizationCredential` (`svc:` AgentAuthorizationCredential), key helpers, `resolveKey`/`isControlledBy` seams |
| Agent Authorization Credentials note (`jeswr/agent-authz-credential-spec`) | draft of 2026-07-03 | the **four-phase verification algorithm** (extract policies → assemble chain → Phase A credential gates → Phase B cross-binding → Phase C status ∪ revocation → Phase D `evaluateDelegated`), the Bitstring ↔ `odrld:Revocation` mapping, and the honest implemented-vs-proposed inventory this design's gap list extends |
| Access-management proposal (`full-solid-ecosystem/docs/design/access-management-solid-lws.md`) | in-repo | how a delegated agent actually *receives* pod access today: grants compile to the target-based WAC/ACP core; the request→consent→grant→materialise lifecycle (R6); DPoP-bound down-scoped tokens |
| ODRL Formal Semantics (W3C ODRL CG draft) | fetched 2026-07-03 | an **evaluation-report vocabulary** (`PolicyReport`/`RuleReport`/`ConstraintReport`…) exists in draft but its namespace is explicitly "to be defined" and parts are "pending to be written" — usable as direction, not yet as a binding target (see G9) |

The layering rule this whole design honours (from the credential note): **credential verification
(Phases A–C) establishes authenticity and currency of the artifacts; policy evaluation (Phase D)
establishes authorization of the request. Both, in that order, fail-closed.**

---

## 2. The runtime's shape

### 2.1 Actors

| Actor | Identity | Holds |
|---|---|---|
| **Alice** (principal) | WebID `…/profile/card#me` | pod; a Data Integrity key pair whose `verificationMethod` her profile advertises |
| **Alice's agent A** | its **own** WebID (`agent-a…#it`); Alice's profile links it via an agent pointer (`interop:hasAuthorizationAgent`) | its own key pair; the AgentAuthorizationCredential Alice issued it; the root ODRL Agreement (mandate P) |
| **Institute agent R** | its own WebID + Agent Card at its origin's `/.well-known/agent-card.json` | its own credential chain from the institute; a federation-membership credential (out of the runtime's critical path; verified when presented) |
| **Auditor** | anyone with read access to the trace | nothing — that is the point |

### 2.2 Components (all thin; the packages do the work)

```
accountable-agent-runtime
├─ principal/        mint mandate: build root Agreement (solid-odrl types)
│                    + issue AgentAuthorizationCredential (solid-vc)
├─ agent/            the loop: discover (solid-agent-card) → handshake + intent
│                    (solid-a2a codec) → verify counterparty (chain-verifier)
│                    → conclude Agreement → act (injected authed fetch)
├─ chain-verifier/   the composed FOUR-PHASE verifier (credential-note §Verification)
│                    — the one genuinely new piece of logic (gap G7)
├─ trace/            the accountability artifact writer/reader: PROV activity
│                    bundles, chain provenance, decision records, trace container
│                    layout (§3 below); reader = the auditor walk
└─ scenario/         the deterministic scripted §4 scenario (Phase 0: test doubles;
                     Phase 1: real packages, in-memory pod; Phase 2: live pod)
```

House seams, non-negotiable: every network touch goes through an **injectable `fetch`**
(authenticated fetches DPoP-bound by the caller's auth layer; unauthenticated discovery fetches
through `@jeswr/guarded-fetch` SSRF policy — agent cards, protocol documents, revocation lists and
WebID key documents are **user/peer-configured remote URLs** and get the full guard: https-only,
private/loopback/metadata-blocked, size+time capped, no auto-redirect). Keys live only in the
process's key objects (`CryptoKey`, non-extractable where possible); credentials never in logs or
URLs. RDF only via `@jeswr/fetch-rdf` (parse), `@solid/object`/`@rdfjs/wrapper` (typed access),
`n3.Writer`/`@jeswr/rdf-serialize` (serialise) — never hand-built triples.

### 2.3 The loop in one paragraph

Alice mints mandate P (root ODRL Agreement: `read` on the records + a depth-bounded `grantUse`)
and issues agent A a signed AgentAuthorizationCredential binding P. A discovers R via R's WebID →
agent pointer → Agent Card, verifies the descriptor, pins R's Protocol Document by hash, and runs
the NL→RDF upgrade handshake (`required: true` — no silent downgrade). Both sides exchange
SHACL-validated intents; **each side runs the four-phase verifier over the other's presented
credential chain before treating any intent as authorized**. The outcome is a leaf ODRL Agreement
(assigner = Alice through A within P; assignee = the institute), stored in both pods, each hop
credential-bound. Access is materialised as a WAC grant on the concrete targets. Every action R
then performs is recorded as a PROV activity bundle whose `prov:hadPlan` is the leaf Agreement —
and the chain overlay (`delegationProvenance`) makes the walk from any derived artifact back to
Alice a mechanical PROV traversal.

---

## 3. The accountability artifact

### 3.1 What lands on the pod

A `trace` container per engagement, in **both** parties' pods (each party writes its own copy —
see the honest boundary, §5, for why duplication matters):

```
/agents/engagements/<id>/                 ldp:Container — the accountability trace
  mandate.ttl              the ROOT ODRL Agreement (Alice → agent A: read + grantUse,
                           odrl:profile <https://w3id.org/jeswr/odrl-delegation>)
  agreement.ttl            the LEAF ODRL Agreement (Alice-via-A → institute), with
                           odrld:delegatedUnder <mandate.ttl's policy IRI>
  credentials/
    mandate.vc.jsonld      AgentAuthorizationCredential binding mandate.ttl
                           (issuer = subject = Alice's WebID; svc:authorizes = A)
    agreement.vc.jsonld    the credential binding agreement.ttl (issuer = A… see G15
                           for the countersignature honest note)
    institute-agent.vc.jsonld  the institute's own credential covering its acting
                           agent (principal = inst, svc:authorizes = its agent) —
                           the identity-composition chain (§3.2 step 3, G7)
  chain.prov.ttl           delegationProvenance([mandate, agreement]) — the PROV
                           overlay: wasAttributedTo / delegatedUnder / wasDerivedFrom
                           / actedOnBehalfOf per hop
  decisions/
    <request-id>.ttl       the recorded evaluation decision for each authorization
                           check the runtime performed (request, instant, chain IRIs,
                           revoked set consulted, decision, reason, per-hop trace —
                           the reified DelegatedEvaluationResult; vocabulary: G9)
  activities/
    <activity-id>.ttl      one PROV bundle per ACTION the counterparty performed
  revocations.ttl          any odrld:Revocation statements the owner has published
                           (also mirrored beside the revoked policy, per profile §7)
```

Discovery-facing conventions (LD best practice): the container content-negotiates
Turtle/JSON-LD like any pod resource; new activity bundles are additionally **LDN-POSTed to the
counterparty's `ldp:inbox`** so the data owner holds a copy she did not have to poll for; the
engagement container is advertised from each agent's description with `rdfs:seeAlso`.

The per-action PROV bundle is exactly the delegation profile §8 shape:

```turtle
<#act> a prov:Activity ;
  prov:wasAssociatedWith <https://institute.example/agents/research#it> ;
  prov:used <https://alice.solid.example/data/records.ttl> ;
  prov:generated <https://institute.example/derived/summary-2027.ttl> ;
  prov:startedAtTime "…"^^xsd:dateTime ; prov:endedAtTime "…"^^xsd:dateTime ;
  prov:qualifiedAssociation [
    a prov:Association ;
    prov:agent <https://institute.example/agents/research#it> ;
    prov:hadPlan <https://alice.solid.example/agents/engagements/e1/agreement.ttl#policy>
  ] .
<https://institute.example/agents/research#it>
  prov:actedOnBehalfOf <https://institute.example/org#id> .
<https://institute.example/derived/summary-2027.ttl>
  prov:wasDerivedFrom <https://alice.solid.example/data/records.ttl> ;
  prov:wasGeneratedBy <#act> .
```

### 3.2 The auditor's walk (how the questions get answered)

Given any artifact IRI (e.g. the derived summary Alice found misused), the auditor — who needs
only read access and the standard vocabularies:

1. **Which action produced it?** `artifact prov:wasGeneratedBy ?activity` — the activity bundle
   names the acting software agent (`prov:wasAssociatedWith`) and its organisation
   (`prov:actedOnBehalfOf`).
2. **Under what policy?** `?activity prov:qualifiedAssociation/prov:hadPlan ?leafPolicy` — the
   leaf Agreement, then `?leafPolicy odrld:delegatedUnder* ?root` walks to the mandate; each
   policy's `prov:wasAttributedTo` names its issuer. The chain of *people/orgs who authorized* is
   now explicit: Alice → agent A → institute.
3. **Was it authorized — then, and in scope?** Re-run the **four-phase verification** over the
   trace: (a) fetch the credentials binding each hop, verify each (Phase A) **with `now` = the
   activity's `prov:startedAtTime`** (the credential note's stale-replay discipline: the question
   is "was it authorized *when it acted*", answered at that instant, plus optionally at the
   current instant for "is it still"); (b) cross-bind issuer/subject/assigner/assignee (Phase B);
   (c) union the Bitstring status bits and `odrld:Revocation` statements into the revoked set
   (Phase C); (d) `evaluateDelegated(chain, {agent, action, target, attributes}, {now, revoked})`
   (Phase D) with the request reconstructed from the activity bundle (action = read/derive per
   `prov:used`; target = the used resource; purpose from the agreement's constraint
   left-operands). Where the leaf assignee is an **organisation** and the associated agent is
   its software agent, the walk applies the **identity-composition rule** (part of G7, §4):
   Phase D runs with agent = the leaf assignee, and the acting WebID is covered only by a
   *second* four-phase-verified chain whose trusted root principal **is** that leaf assignee
   (the institute's own AgentAuthorizationCredential over its agent — the
   `prov:actedOnBehalfOf` edge, made verifiable). The recorded `decisions/<id>.ttl` lets the auditor
   *compare* what the verifier decided at action time with what an independent re-run decides —
   a divergence is itself a finding.
4. **The dispute answer.** If the *use* (the purpose evident in the offending artifact) falls
   outside the agreement's `purpose`/period constraints, Phase D on the *actual* use denies —
   and the chain names, with signed artifacts at every link, exactly who is answerable: the
   institute (assignee of the breached agreement), through terms Alice demonstrably set (signed
   root mandate). "The AI did it" fails because the AI's authority is Alice's signed authority.

Everything the auditor consumes is standard: PROV-O, ODRL 2.2 + the delegation profile, VC 2.0 +
Data Integrity. No runtime-proprietary reader is needed for the walk; the runtime's `trace`
reader is a convenience, not a dependency.

---

## 4. Composition seams — which package API each step calls, and the gaps

The full call-by-call walk is [`SCENARIO.md`](./SCENARIO.md). The seam table:

| # | Step | Package call(s) | Status |
|---|---|---|---|
| 0 | keys + publication | `solid-vc` `generateKeyPairForSuite`, `exportPublicJwk` | ✅ / **G5** (no publish/resolve helper) |
| 0 | agent pointer | `solid-agent-card` `buildAgentPointer(webId, agent)` → write to profile | ✅ |
| 0 | agent self-description | `solid-agent-card` `describeAgent(descriptor)` → host both docs | ✅ |
| 1 | mandate P (root Agreement) | `solid-odrl` policy types + `policyToTurtle` (`profile`, `grantUse`, `odrld:delegationDepth`, `nextPolicy` duty round-trip) | ✅ **G10 CLOSED** (delegation profile merged to `solid-odrl` main; pinned by sha) |
| 1 | mint the credential | `solid-vc` `issueAgentAuthorization({principal, agent, action, target, policy, policyContent}, key)` | ✅ **G1 CLOSED** (Phase 1: `relatedResource` digest binding emitted at issuance + verified fail-closed via `presentedResources`) |
| 2 | discover the counterparty | `solid-agent-card` `discoverAgent(webId, {fetch})`, `verifyDescriptor`; PD URLs from `descriptor.protocolSources` | ✅ |
| 3 | pin + verify the protocol | `solid-a2a` `verifyProtocolDocument(fetchedTurtle, hash)` | ✅ / **G11** (no transport — runtime is the carrier) |
| 3 | upgrade handshake | `solid-a2a` `encodeUpgradeOffer({…, required: true})`, `decodeUpgradeResponse`, `mayDowngradeToNl` | ✅ |
| 3 | intent exchange | `solid-a2a` `parseIntent` / `validateIntent(intent, pd)` | ✅ / **G12** (no prebuilt purpose+period grant shape) |
| 4 | verify the peer's authority | **the four-phase verifier**: `solid-vc` `verifyCredential` (Phase A) + cross-binding (Phase B) + status∪revocation (Phase C) + `solid-odrl` `evaluateDelegated` (Phase D); request via `requestContextFromA2AIntent`; org-assignee actors via the **identity-composition rule** (second chain rooted at the leaf assignee) | **G7** (Phases B–C + assembly + identity composition implemented nowhere; the runtime's one new component) + **G2, G4** |
| 5 | conclude the Agreement | `solid-odrl` policy types (+ `odrld:delegatedUnder`), `policyToTurtle`; sign via `solid-vc` `issue` | ✅ / **G15** (no countersigning path) |
| 6 | materialise access | `@solid/object` typed `.acl` accessors (WAC grant: institute WebID, `acl:Read`, target) | ✅ (existing lib) / **G14** (WAC cannot reference the agreement) |
| 7 | act + record | injected DPoP-authed `fetch`; PROV bundle via `solid-odrl` `actionProvenance` + `delegationProvenance(chain)` for the overlay | ✅ **G8 CLOSED** (Phase 1: `actionProvenance()` shipped in `solid-odrl`; the runtime's local emitter is deleted) |
| 7 | record the decision | reify `DelegatedEvaluationResult` → RDF | **G9** (no decision-record vocabulary/serialiser) |
| 8 | audit | PROV walk (SPARQL/typed accessors) + re-run of step 4 | **G7** again + a thin trace reader (runtime-local) |

### The gap list (the concrete package follow-ups)

Stress-testing the M1–M4 + delegation + credential APIs against this end-to-end flow surfaces the
following. Each is scoped to a package and phrased as the work item a builder agent would pick up.
G1–G3 restate the credential note's own implemented-vs-proposed inventory (so they are confirmed,
not newly discovered); the rest are new findings from this design.

**`@jeswr/solid-vc`**

- **G1 — policy content binding. CLOSED (Phase 1, `solid-vc` @ 45de2a1).** `relatedResource`
  digest emission at issuance (`policyContent`) + the fail-closed digest check in
  `verifyCredential` (`presentedResources`) shipped; the runtime's chain verifier presents each
  hop's RAW fetched policy document and maps `RELATED_RESOURCE_MISSING`/`_MISMATCH` to a
  `POLICY_INTEGRITY` deny, so `policyIntegrityProvisional` is `false` on a fully content-bound
  chain. Original statement (for the record): `buildAgentAuthorizationCredential` emits only a bare-IRI
  `svc:policy`; the credential note **rejects** bare IRI references (a signed pointer to mutable
  content binds nothing). Add: (a) an embedded-Agreement path (the hop policy's RDF carried in
  the credential subject graph, signed with it) and/or (b) `relatedResource` + digest emission,
  with the corresponding digest check in `verifyCredential`. *Blocking for Phase 1* (Phase 0 can
  stub it).
- **G2 — `credentialStatus` / Bitstring Status List.** Only a vocabulary constant exists; no
  issuance parameter, no hosting/encoding helper, no Phase-C gate in `verifyCredential`
  (retrieval failure must deny, per the note). Needed for the revocation half of the scenario's
  dispute act; Phase 0/1 can carry `odrld:Revocation` only and defer the bitstring.
- **G3 — `verifyPresentation` with challenge/domain binding.** Presentations are modelled but not
  verifiable; live agent-to-agent presentation (Phase 2+) needs it to prevent replay of a
  captured presentation.
- **G4 — document-resolved `isControlledBy`.** The default issuer–key controller check is a
  prefix heuristic the note itself flags as unsafe; ship a reference resolver that fetches the
  controller document (SSRF-guarded) and checks `assertionMethod` listing. Compose with G5.
- **G5 — WebID ↔ verification-method helpers.** The `resolveKey` seam has no reference
  implementation: nothing publishes a key into a WebID/controller document and nothing resolves
  `verificationMethod → CryptoKey` from one. A small `publishVerificationMethod` /
  `resolveWebIdKey` pair (guarded fetch, `importPublicKey`) unblocks every verifying party.
- **G6 (minor) — `agentAuthorizationFromRdf` drops `id`/`validFrom`/`validUntil`** (returns only
  the five core fields). The runtime reads windows from the credential layer instead, so this is
  a completeness nit, not a blocker.

**the composed verifier (implemented nowhere, by design)**

- **G7 — the four-phase chain verifier.** The credential note specifies extract-policies →
  assemble-chain (order by `odrld:delegatedUnder`, reject cycles/branches/gaps) → Phase A → B →
  C → D, and its inventory states plainly: *"the integration layer this note specifies; neither
  package implements it alone by design."* This is the runtime's one genuinely new component.
  Build it **inside the runtime first** (`chain-verifier/`), with the delegation decision matrix
  discipline (golden-master over the note's error codes: `POLICY_INTEGRITY`, `CHAIN_MALFORMED`,
  `BINDING_MISMATCH`, `STATUS_RETRIEVAL_ERROR`, `POLICY_DENIED`, plus Phase A's codes). Its spec
  additionally pins the **identity-composition rule** the note leaves implicit: when the leaf
  assignee is a principal `p` and the authenticated actor is `w ≠ p`, the verifier accepts `w`
  only via a second four-phase-verified chain **whose trusted root principal is `p`** and which
  permits `w` the requested action (chain₂'s root = chain₁'s leaf assignee) — otherwise an
  org-assigned agreement could never be exercised by the org's own agents, or worse, would
  tempt implementers to skip the leaf-assignee check (the fail-open the roborev round-1 review
  caught in this design's own first draft). Then
  extract to `@jeswr/agent-authz-verifier` once stable — it is exactly the artifact a *pod
  server's* future authorizer (M5a) and any relying party both need, so it must not stay
  runtime-private long.

**`@jeswr/solid-odrl`**

- **G8 — `actionProvenance()`. CLOSED (Phase 1, `solid-odrl` @ db97922).** Shipped beside
  `delegationProvenance` with the identical input shape; the runtime deleted its local
  `trace/activity.ts` and imports it through the G10 seam. Original statement (for the
  record): Profile §8's per-action SHOULD (the `prov:Activity` +
  `qualifiedAssociation`/`hadPlan` bundle) has no emitter; `delegationProvenance` covers only the
  chain overlay. Add `actionProvenance({activity, agent, used, generated, plan, started, ended})
  → Quad[]` beside it — same file, same discipline, trivially testable.
- **G9 — decision-record serialisation.** `DelegatedEvaluationResult` (decision, reason, per-hop
  trace, duties) has no RDF form, so the trace's `decisions/` records have no vocabulary. The
  ODRL Formal Semantics draft defines an evaluation-report model (`PolicyReport`/`RuleReport`/
  `ConstraintReport`…) that is directionally exactly this — but its namespace is literally "to be
  defined" and sections are "pending to be written" (verified 2026-07-03), so it cannot be a
  fail-closed binding target yet. Interim: a minimal decision-record shape under
  `https://w3id.org/jeswr/accountable-agent#` (only the fields above; explicitly marked
  provisional, to be re-based onto the CG vocabulary when it lands). Track the CG draft.
- **G10 — merge `feat/delegation-profile`. CLOSED (Phase 1).** Merged to `solid-odrl` `main`
  with the committed `dist/`; the runtime pins the merged sha. Original statement (for the
  record): the entire design depends on the branch @
  `18df183`; it is roborev-hardened through four rounds but unmerged. Merging it to `main` (and
  cutting the committed `dist/`) is a prerequisite for Phase 1's real-package wiring.

**`@jeswr/solid-a2a`**

- **G11 — the transport binding.** By design absent from the codec package; the runtime IS the
  reference carrier. Phase 0–1 carry the handshake in-process; Phase 2 pins the **LDN
  convention**: an `UpgradeOffer`/`UpgradeResponse`/intent travels as an RDF-native POST to the
  peer agent's `ldp:inbox` (discovered from the agent's WebID document — standard LDN, no new
  vocabulary), correlation via the handshake's own IRIs. If this proves reusable, extract as the
  roadmap's `@jeswr/solid-agent` carrier — but do not pre-build it.
- **G12 (minor) — a purpose+period grant shape.** The scenario's negotiated intent ("selected
  records, stated purpose, one year") is expressible today via `Intent.parameters`, but no
  prebuilt SHACL shape constrains purpose/duration on a `grant` intent. The runtime ships its
  own Protocol Document with that shape (which is the *intended* extension pattern — PDs are the
  per-deployment protocol surface), and upstreams it as a stock shape only if it recurs.

**`@jeswr/solid-agent-card`** — no blocking gap. The descriptor carries everything discovery
needs (`protocolSources` closes the M1→M2 loop; `owner` closes descriptor→principal). The
agent's LDN inbox is discovered from its WebID document per standard LDN, so no new field is
needed; an optional `x-solid.inbox` mirror is a nice-to-have, not filed.

**cross-cutting**

- **G14 — WAC cannot reference the Agreement.** The materialised `.acl` grant (step 6) has no
  hook to name the policy that justified it; the linkage lives only in the trace (PROV +
  `decisions/`). This is an honest structural limit of the target-based core — the access-
  management proposal's server-side lifecycle and the M5a pod-side ODRL authorizer (CORE-PSS,
  maintainer-gated, explicitly out of scope here) are the real fix. The runtime mitigates by
  recording, in the decision record, *which* WAC mutation each agreement produced.
- **G15 — countersigned Agreements.** §4 says the agreement is "signed by both sides' keys". VC
  2.0 allows multiple proofs, but `solid-vc`'s `issue()` is single-issuer and adding a second
  proof to an existing VC is unexposed/untested. Workaround (Phase 1): **two mirrored
  credentials** — each party issues its own AgentAuthorizationCredential embedding the *same*
  agreement content (digest-equal, once G1 lands); the verifier requires both. Native
  multi-proof issuance is a candidate `solid-vc` follow-up, not a blocker.

---

## 5. The honest boundary — enforced vs. accountable

Extending the paper's own caveats (§4) with this design's specifics. The claim being demonstrated
is **accountability, not prevention** — and the demonstration must say so out loud.

**Cryptographically enforced** (a violation is *detectable by verification failing*):

- integrity + issuer-binding of every credential and (post-G1) of every bound policy — Data
  Integrity proofs over canonical RDF;
- chain issuance authenticity: each hop signed by its `odrl:assigner`'s key (Phase B discharges
  the delegation profile's trust-anchoring precondition);
- the protocol document actually negotiated (sha256 content pin; no silent NL downgrade for
  `required` protocols);
- transport identity: the acting agent is the DPoP-bound WebID the server authenticated — holding
  a credential chain is not authority; being the delegate it names is (note, Phase D).

**Audit/legally enforced** (a violation is *provable afterwards*, not preventable):

- **scope and purpose of actual use.** ODRL evaluation is client-side; the pod server enforces
  WAC, which is coarser than the agreement (G14). An agent with a valid `acl:Read` grant can read
  for the wrong purpose; the chain proves what it was *allowed* to do, and the artifact's PROV +
  the agreement prove the breach — courts and regulators do the rest. Server-side ODRL beside WAC
  (M5a) narrows this gap later; it does not exist today and this design does not pretend it does.
- **duty discharge** (deletion at expiry, inform-on-delegate): recorded, aggregated
  (`requireDuties` makes them permit-blocking at evaluation time), but their real-world
  performance is attested, not enforced.
- **data escape.** Nothing technical stops a reader copying what it read. DRM is explicitly the
  road not taken (paper §4).

**Where a malicious agent can still act — and what limits the damage:**

| Attack | Possible? | What bounds it |
|---|---|---|
| act within its WAC grant but outside the ODRL purpose/period | **yes** | the trace makes it provable; revocation cuts future access; liability attaches to the signed chain |
| act and write **no** PROV (or false PROV) | **yes — the trace is self-reported** | the counterparty's mirrored trace copy + LDN-delivered bundles (it cannot silently edit the owner's copy); the pod server's own audit log (server-side, not agent-controlled) records the raw requests; absence of PROV on a surfaced artifact is itself incriminating under an agreement whose duty requires it |
| replay a since-revoked chain inside the revocation-propagation window | **yes, briefly** | revocation freshness is the relying party's trust decision (profile §7); Phase C's fail-closed rule (status unreachable → deny) prevents the *indefinite* variant |
| mid-chain key compromise | **yes** | the note's security considerations: ancestor revocation (`odrld:Revocation` from any ancestor assigner) cuts the whole subtree; short `validUntil` windows bound exposure |
| forge a chain / widen a grant / launder around a prohibition | **no** | signatures (Phase A/B) + fail-closed chain semantics: subset intersection, strict prohibitions, depth default 1, `nextPolicy` identity, deny on any ambiguity |

The runtime's demo must include the **negative acts**: a forged hop (verification fails), an
out-of-scope request (Phase D denies), a revoked mid-chain hop (subtree dies), and a
PROV-omitting actor (the mirrored-trace divergence an auditor sees) — accountability claims are
only credible when the failure modes are exercised, not narrated.

## 6. Security posture (summary)

- **Fail-closed everywhere**: empty/odd input → deny; unresolvable status → deny; one evaluation
  instant across phases; two-valued decisions (no `notApplicable` to default around).
- **SSRF**: all peer-configured URLs (cards, PDs, inboxes, revocation lists, key documents)
  through `@jeswr/guarded-fetch` (https-only, private/metadata ranges blocked, caps, no
  auto-redirect).
- **Credentials/keys**: never in plaintext files, logs, or URLs; `resolveKey` returns
  `CryptoKey`s; the runtime never persists private material (Phase 2 uses the suite's existing
  DPoP/session machinery, injected).
- **No bespoke RDF**: parse `@jeswr/fetch-rdf`, access `@rdfjs/wrapper`/`@solid/object`,
  serialise `n3.Writer` — the trace writer included.
- **Determinism**: injectable `now` and injectable fetch make the whole scenario, including the
  four-phase verifier, golden-master testable (the same discipline as `evaluateDelegated`'s
  decision matrix).
