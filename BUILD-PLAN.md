<!-- AUTHORED-BY Claude Fable 5 -->

# Build plan — accountable-agent-runtime

Phased, deterministic-first, each phase independently shippable and gate-green
(lint + typecheck + vitest + build, roborev PASS per commit). Package naming:
`@jeswr/accountable-agent-runtime` (never `@solid/…`). Gap IDs (G1…G15) refer to
[`docs/DESIGN.md`](./docs/DESIGN.md) §4.

## Phase 0 — the deterministic scripted scenario over test doubles

Goal: the whole §4 flow runs as a **pure, golden-master-tested script** — no network, no pod, no
crypto stubs *hidden* (doubles are explicit and labelled).

1. Scaffold the package (suite new-repo checklist; TypeScript ESM, vitest, biome, committed
   `dist/`, `ignore-scripts=true`).
2. `scenario/` — the scripted flow of `docs/SCENARIO.md` steps 0–8 with:
   - an **in-memory pod double** (a `Map<string, {body, contentType}>` behind the injectable
     `fetch`), an injected fixed `now`, fixed key material (generated once per test run — real
     `solid-vc` crypto, since it is already pure and fast);
   - real `solid-odrl@feat/delegation-profile`, `solid-vc`, `solid-a2a`, `solid-agent-card`
     calls everywhere the API already exists (they are all pure/injectable — that is the point
     of their designs);
   - explicit doubles ONLY where a gap forces one: policy-content binding treated as
     trusted-by-location (G1), revocation via `odrld:Revocation` fixtures only (G2), the
     in-process carrier (G11).
3. `chain-verifier/` — the four-phase verifier (G7): assemble + Phase A–D, structured error
   codes per the credential note, **golden-master decision matrix** covering: happy chain; each
   Phase A failure; each Phase B mismatch; revoked root / revoked hop; out-of-scope,
   over-depth, prohibition-laundering, expired-middle-hop Phase D denials; and the
   stale-vs-action-time `now` distinction.
4. `trace/` — writer (activity bundle [G8 authored locally], chain overlay, decision record
   [G9 provisional shape]) + reader (the auditor walk of SCENARIO step 8, including the
   **negative demos**: forged hop, out-of-scope use, revoked subtree, PROV-omitting actor →
   mirrored-trace divergence).
5. Exit criteria: `npm test` replays the entire scenario + all negative acts deterministically;
   the produced trace container serialises byte-stable (canonical ordering) so the golden
   masters pin it.

## Phase 1 — real packages end-to-end (close the blocking gaps)

Package follow-ups, in dependency order — each is a separate builder-agent brief on its own
repo, normal gate + roborev:

1. **solid-odrl: merge `feat/delegation-profile` → main** (G10) and rebuild the committed
   `dist/`. Prerequisite for everything below.
2. **solid-odrl: `actionProvenance()`** (G8) — the §8 activity-bundle emitter beside
   `delegationProvenance`; runtime deletes its local authoring.
3. **solid-vc: policy content binding** (G1) — embedded-Agreement path in
   `buildAgentAuthorizationCredential` + `relatedResource` digest emission + the verifier digest
   check; runtime drops the trusted-by-location stub, Phase B gains `POLICY_INTEGRITY` for real.
4. **solid-vc: WebID key helpers** (G5) + **document-resolved `isControlledBy`** (G4) — the
   `publishVerificationMethod`/`resolveWebIdKey` pair over `@jeswr/guarded-fetch`.
5. **solid-vc: Bitstring Status List** (G2) — issuance param + list encode/decode/hosting helper
   + the Phase C gate (fail-closed on retrieval failure), then wire the note's bit↔policy
   mapping into `chain-verifier/`.
6. **decision-record shape** (G9) — provisional `https://w3id.org/jeswr/accountable-agent#`
   terms in the runtime (documented, minimal); file the tracking item to re-base on the ODRL CG
   report vocabulary when its namespace lands.
7. Runtime: swap each stub for the landed API as it merges; extend the golden masters (the
   matrix rows flip from "provisional" to "enforced", none are deleted).
8. Exit criteria: the scenario runs with **zero gap-stubs except the carrier (G11) and
   countersigning (G15 mirrored-credential pattern documented)**; `chain-verifier/` extraction
   readiness reviewed (→ `@jeswr/agent-authz-verifier` when a second consumer exists).

## Phase 2 — live pod demo

1. Target a **local** stack first (the house rule — never the live deploy for tests):
   `npx @solid/community-server` and/or a local `prod-solid-server` via `docker compose up`.
   Real WebIDs, real DPoP-authed fetch (compose `@jeswr/solid-openid-client` +
   `@jeswr/solid-dpop`), real WAC materialisation via `@solid/object`.
2. **LDN carrier** (G11): UpgradeOffer/Response + intents as RDF POSTs to the peer agent's
   `ldp:inbox`; notifications of new activity bundles likewise. Keep it runtime-local until it
   proves reusable, then consider extracting the roadmap's `@jeswr/solid-agent` carrier.
3. **solid-vc: `verifyPresentation` + challenge/domain** (G3) — needed once chains travel
   between live parties (replay defence); until it lands, the live demo pins TLS-server-identity
   + DPoP as the presentation-freshness stopgap and says so.
4. The demo artifact: one command boots the stack, runs the scenario, then prints the
   **auditor's walk** over the real pod — the answer to "who authorized this action, under what
   policy, and was it in scope?" rendered from live data. That output is the vision paper's §4
   made executable, and links back into `agentic-solid-vision` §5.5 (flip the "does not exist
   yet" line when it ships).
5. Deferred beyond Phase 2 (explicitly out of scope): server-side ODRL enforcement beside WAC
   (M5a — CORE-PSS, ADR + maintainer approval), federation-membership verification breadth
   (compose `@jeswr/federation-trust` as-is), countersigned single-VC agreements (G15 native
   multi-proof in solid-vc).

## Standing constraints

- Design-only until the maintainer steers; Phase 0 may start under the proceed-and-document
  rule (this repo + a review issue are that documentation).
- Every network-facing default fail-closed + SSRF-guarded; keys/credentials never in
  logs/URLs/plaintext.
- No new vocabulary beyond the provisional decision-record terms (G9), and those under
  `w3id.org/jeswr` with an explicit re-basing plan.
