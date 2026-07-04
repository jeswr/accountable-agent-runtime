<!-- AUTHORED-BY Claude Fable 5 -->

# Phase-2 demo design — the §4 scenario, live, one command

**Bead:** `suite-tracker-r8mz`. **Status:** build-ready design; no implementation code in this
change. This document turns [`BUILD-PLAN.md`](../BUILD-PLAN.md) Phase 2's four bullet points into
a concrete, sub-task-sequenced design for **THE north-star artifact**: a one-command, live-pod
demonstration of the [Accountable Web of Agents](https://github.com/jeswr/agentic-solid-vision)
§4 accountability scenario, ending in an **auditor command** that mechanically answers

> *who authorized this action, under what policy, and was it in scope?*

from data read off a real Solid pod.

It closes two rows of the vision paper's honest gap inventory (`implementation.html`):
the **"runs as … doubled I/O … not yet demonstrated on a live pod"** row (the §4 scenario), and
narrows the **"no long-running agent endpoint"** row (§6.4 below is honest about how far).

Everything here builds on decisions already made in [`DESIGN.md`](./DESIGN.md) (the trace layout
§3.1, the auditor walk §3.2, the honest boundary §5) and [`SCENARIO.md`](./SCENARIO.md) (the API
walk). Nothing is redesigned; this document only adds the live-I/O layer.

---

## 0. Verified ground (what exists today, checked in-tree 2026-07-04)

| Piece | State | Load-bearing fact for this design |
|---|---|---|
| Phase-0/1 runtime (`main @ 6231860`) | shipped | the whole scenario + auditor already run over **real crypto** with exactly three I/O seams: `ResourceSink.put`, `ResourceSource.get/list`, and a `fetch`-shaped discovery seam (`src/scenario/pod.ts`). Phase 2 = swap `InMemoryPod` for live adapters; **no scenario logic changes** |
| `@jeswr/agent-authz-verifier` | published (`github.com/jeswr/agent-authz-verifier`, security-hardened through the delegation-trust-bypass rounds) | the four-phase verifier is pure + zero-I/O by design (`resolveKey`/`isControlledBy`/`resolveStatus` injected) — it is **already live-pod-ready**; only its resolvers change |
| runtime rewire onto the extracted verifier | **in flight** — branch `refactor/consume-agent-authz-verifier @ ad4d176` (worktree `aar-vqyk`) | Phase 2 builds **on top of** that branch once merged; do not duplicate (T0 below) |
| `@jeswr/solid-dpop` | published | `acquireToken` does the **client-credentials → DPoP-bound token** exchange incl. the RFC 9449 §8 nonce retry; `createSession`/`authedFetch`/`rdfFetchFor` give a per-actor DPoP-attaching fetch. This is the headless auth path — no browser, no redirect |
| `@jeswr/solid-openid-client` | published | the interactive auth-code/PKCE path — **not needed** for the headless demo; it is the documented seam for the later "maintainer's real WebID" variant (§7) |
| `@jeswr/guarded-fetch` | published | has the **`allowLoopback`** dev hatch (loopback-only, http-to-loopback permitted, non-loopback private still refused) — the sanctioned way to point the SSRF-guarded discovery fetch at a local pod without weakening the production policy |
| CSS seeding harness | proven (vendored `solid-test-infrastructure` skill) | `POST /.account/account/` account creation → client-credentials minting → DPoP token; fresh CSS profiles need seeding (`foaf:name`, `pim:storage`); an in-memory CSS boots via `npx @solid/community-server` on `:3000` |
| trace reader / `AuditReport` | shipped (`src/trace/reader.ts`) | the auditor walk (`auditArtifact`) already returns the full structured verdict — provGap, authority chain, action-instant re-run, divergence, dispute breach. The auditor CLI (§5) **wraps** this; it does not reimplement it |
| `prod-solid-server` | live LDP+WAC+DPoP stack via `docker compose up -d` | viable secondary target; NOT the default (docker dependency + the known docker-socket flakiness on the dev box). See §1.3 |

House rules honoured throughout: local servers only (never `solid-test.jeswr.org`); credentials
never in logs/URLs/plaintext; all RDF through `@jeswr/fetch-rdf` / `@solid/object` /
`n3.Writer`; every remote fetch through the guarded/authed seams; fail-closed defaults.

---

## 1. The stack

### 1.1 Target server: CSS by default

**Primary target: Community Solid Server, in-memory, booted by the harness itself** —
`npx @solid/community-server` with an in-memory, account-API-enabled config (the exact config the
`solid-test-infrastructure` skill's `dev.mjs` harness already uses), on a **free port picked at
runtime** (fall back to `:3000`). Rationale:

- one command with **zero prerequisites beyond Node** (no docker, no accounts, no network);
- the account API gives programmatic account/pod/client-credentials seeding — proven pattern;
- in-memory ⇒ every run starts clean; teardown = kill the child process.

### 1.2 Actors, accounts, pods

Four actors need to *authenticate* (Alice writes her pod; agent A patches Alice's profile and
concludes the agreement; the institute issues its internal credential; agent R reads the records
and writes activities). The clean mapping — one CSS account per actor, so each DPoP token's
`webid` claim IS the actor IRI the WAC/ACL layer sees:

| Actor | CSS account/pod | WebID (live) | Client-credentials |
|---|---|---|---|
| Alice | `alice` | `<base>/alice/profile/card#me` | yes — seeds + owns everything under `/alice/` |
| Agent A | `agent-a` | `<base>/agent-a/profile/card#me` | yes — profile PATCH on `/alice/` (granted), agreement writes |
| Institute | `institute` | `<base>/institute/profile/card#me` | yes — issues `instAgentVc`, hosts the mirror trace |
| Agent R | `agent-r` | `<base>/agent-r/profile/card#me` | yes — the **authenticated actor**: reads records, writes activities, LDN-POSTs |
| Auditor | *none* | — | **none, deliberately** — the auditor authenticates nothing; it reads (§5) |

Consequence: the Phase-0 `cast.ts` fixed example IRIs (`https://alice.solid.example/…`) become a
**parameterised cast** — `buildCast(actorBases: Record<Actor, string>)` returning the same shape
with live IRIs. The scenario code keys everything off the cast object already, so this is
mechanical (sub-task T2). The deterministic Phase-0/1 tests keep the fixed cast; only the live
harness passes real bases.

### 1.3 `prod-solid-server` as a secondary target

A `--server=pss` variant boots the PSS docker stack (`docker compose up -d` in
`prod-solid-server`, MinIO+QLever+Keycloak) and provisions the four WebIDs/pods through PSS's
provisioning surface instead of the CSS account API. Everything above the seeding layer is
identical (LDP+WAC+DPoP are the spec surfaces the runtime talks). This is **deferred to T8**
(optional): it adds a docker + Keycloak dependency, the dev box has a known docker-socket issue,
and the demo's claim ("a live Solid pod") is fully made by CSS. Running the same demo against a
*second, independent* server implementation is however exactly the kind of evidence the
conformance story wants — hence kept as a tracked follow-up, not dropped.

### 1.4 Pod layout + ACLs

The engagement trace layout is DESIGN §3.1 verbatim, now with concrete live paths and the three
additions a live pod needs (records, inboxes, status list) and an **explicit ACL per container**:

```
/alice/
  profile/card                #me WebID: solid:oidcIssuer, ldp:inbox </alice/inbox/>,
                              interop:hasAuthorizationAgent <agent-a's WebID>,
                              sec:assertionMethod → </alice/keys#k1>       [public read — a WebID must dereference]
  keys                        the sec:Multikey verification-method document [public read]
  status/list                 Alice's signed Bitstring Status List VC       [public read — relying parties poll it]
  data/records.ttl            the selected records                          [owner Control; + acl:Read <agent-r WebID> AFTER step 6 — the grant IS the demo]
  inbox/                      LDN inbox                                     [owner Read/Write/Control; acl:Read for AGENT A
                                                                             (accessTo + default — A is Alice's delegated
                                                                             inbox processor, §3.4; read-not-write: it mirrors
                                                                             into the trace, it cannot edit the inbox);
                                                                             acl:Append for agent-r (the only sender here)]
  agents/engagements/e1/      the trace container (mandate.ttl, agreement.ttl,
                              credentials/, chain.prov.ttl, decisions/,
                              activities/, revocations.ttl)                 [owner Control; acl:Write for AGENT A via BOTH
                                                                             acl:accessTo <e1/> (create inside the container
                                                                             itself) AND acl:default <e1/> (descendants incl.
                                                                             the credentials/decisions/activities
                                                                             subcontainers) — never acl:Control; Alice
                                                                             delegates trace AUTHORING, not ACL authority;
                                                                             PUBLIC READ — see the auditor note]
/agent-a/  profile/card + keys                                             [public read]  + inbox/ [Append for institute actors]
/institute/
  profile/card + keys                                                      [public read]
  protocols/data-sharing.ttl  the hash-pinned Protocol Document             [public read]
  agents/engagements/e1/      the MIRROR trace (institute's own copy)       [owner Control; acl:Write for AGENT R via BOTH
                                                                             acl:accessTo <e1/> AND acl:default <e1/> (same
                                                                             container-vs-descendant split as Alice's trace;
                                                                             never acl:Control) — the institute delegates
                                                                             trace authoring to its acting agent (the same
                                                                             delegation instAgentVc attests); public read]
  inbox/                      [Append for agent-a]
/agent-r/  profile/card + keys                                             [public read]
```

**The auditor-access decision:** the engagement trace containers are **public-read in the demo**.
DESIGN §2.1 defines the auditor as "anyone with read access"; public-read is the strongest form
of the demo's claim (the auditor runs with *zero* credentials) and removes a whole
account/consent flow from the harness. The design records the honest caveat (§6.2): a real
deployment would grant the auditor scoped read instead — nothing in the walk depends on
public-ness, only on readability.

All ACLs are written via `@solid/object` typed `.acl` accessors (house rule — never hand-built
triples), owner-control fail-closed: every container gets an explicit ACL before any non-owner
touches it; a missing ACL is a seeding bug, not an inherit-and-hope.

**The mirror-integrity invariant these grants preserve** (DESIGN §5's duplicated-trace
argument): the two write delegations are **disjoint** — agent A can write only Alice's trace
copy, agent R only the institute's; neither party's credential can touch the other's copy (and
the owners hold `acl:Control`, so neither delegate can widen its own grant). No single
credential can therefore forge or silently edit **both** copies, which is exactly what makes a
mirrored-trace divergence evidential. The seeding tests assert both cross-writes 403.

**Agent-card hosting (resolved against `solid-agent-card` `src/discover.ts`, 2026-07-04):**
`discoverAgent` dereferences the **agent-pointer IRI itself** and verifies the ANP
`ad:AgentDescription` found in that document (subject bound to the agent IRI, exactly one
`ad:owner` back-link) — `/.well-known/` is **not on the discovery path** (the well-known
helpers are separate conveniences for origin-rooted deployments). So no shared-origin problem
exists and **no `solid-agent-card` change is needed**: seeding merges each agent's
`describeAgent(...).agentDescription` quads (subject = the agent's WebID) into its profile
document, with `ad:owner` = its principal's WebID. The A2A JSON card
(`describeAgent(...).agentCard`) is additionally hosted at a pod path
(`/agent-r/card/agent-card.json`, public read) for completeness/exhibition; nothing in the demo
flow depends on it.

---

## 2. The runtime made real — the three live adapters

Phase 2 introduces **adapters only**. The scenario (`src/scenario/run.ts`), the verifier, and the
trace writer/reader do not change; they already consume injected seams.

### 2.1 Auth: per-actor DPoP sessions (`live/auth.ts`)

```
seedAccounts(css)  →  per actor: { webId, podRoot, clientCredentials }
                      (CSS account API: create account → create pod → mint token)

actorSession(creds) →  @jeswr/solid-dpop:
                        generateSessionKeyPair()
                        createSession({ issuer: cssBase, id, secret }, keyPair)
                        → session.authedFetch   (DPoP proof per request, nonce-retry,
                                                  token refresh on expiry)
```

Rules (all already the packages' defaults — restated as acceptance criteria):

- client-credentials (`id`/`secret`) live only in the harness process memory; **never logged,
  never in URLs, never written to disk** (`StoredSession` persistence is NOT used — the demo is
  ephemeral by design);
- one DPoP keypair per actor per run; keys non-extractable where the runtime allows;
- `authedFetch` is handed to exactly the components acting **as** that actor (the WAC grant in
  step 6 uses Alice's; the record read in step 7 uses R's) — no shared super-fetch.

### 2.2 Pod I/O: the `LivePod` adapter (`live/pod.ts`)

One class implementing the two existing seams over an injected authed fetch:

```ts
class LivePod implements ResourceSink, ResourceSource {
  constructor(opts: {
    fetch: typeof globalThis.fetch;   // the actor's authedFetch (writes) or the
                                      // guarded loopback fetch (auditor reads)
    base: string;                     // fail-closed scope guard: every URL must
  })                                  // be within base (assertWithinBase pattern)

  // ResourceSink
  put(url, body, contentType)         // PUT; create-parent containers first
                                      // (PUT with intermediate containers: CSS
                                      // auto-creates ancestors; PSS may not —
                                      // the adapter MKCOLs explicitly: PUT each
                                      // missing ancestor as ldp:Container);
                                      // first write of a resource sends
                                      // If-None-Match: * (create-only — a demo
                                      // re-run must not silently clobber);
                                      // overwrites send If-Match: <etag> from
                                      // the tracked etag map (lost-update guard)

  // ResourceSource
  get(url)                            // GET, Accept from the expected contentType;
                                      // keeps the ETag (fetch-rdf discipline)
  list(prefix)                        // GET the container, parse ldp:contains via
                                      // @jeswr/fetch-rdf + @solid/object
                                      // ContainerDataset — NEVER a bespoke parse;
                                      // recurses one level per container walk
}
```

Non-negotiables: `redirect: "manual"` + refuse redirects (the suite's redirect-refusal SSRF
pattern — a redirect on a credentialed write is always refused); the scope guard refuses any URL
outside the constructed base (so a hostile IRI inside parsed RDF can never steer a credentialed
write elsewhere — same fail-closed posture as `unstorage-solid`/`y-solid`).

Profile/key-document updates (agent pointer, `ldp:inbox`, verification methods) are
**read-merge-write**: GET the document (keep ETag) → parse → union with the new quads
(`publishActorKey` already implements parse→union→re-serialise) → PUT with `If-Match`. No
PATCH dependency (N3-Patch support differs across targets; conditional PUT is universal).

### 2.3 Discovery + verification resolvers, live

- **Discovery fetch** (agent cards, protocol documents, WebID documents, status lists — all
  *unauthenticated* reads of public documents): `createGuardedFetch({ allowLoopback: true })`
  from `@jeswr/guarded-fetch`. The hatch is loopback-only — non-loopback private targets stay
  refused, so the demo exercise **is** the production code path modulo that one documented flag,
  which the harness sets only when the pod base is itself loopback (assert at startup; a
  non-loopback base gets the unmodified production guard).
- **`resolveKey` / `isControlledBy`**: `@jeswr/solid-vc`'s `createWebIdKeyResolver` with that
  guarded fetch — this is the exact production resolver; nothing pod-double-shaped remains.
- **`resolveStatus`**: `createBitstringStatusResolver` with the same fetch, pointed at the
  live-hosted status list. Fail-closed semantics already pinned by the golden matrix.

With these three, `verifyAgentAuthority` (the extracted `@jeswr/agent-authz-verifier`) runs
**unmodified** against live documents — the demo's central claim.

### 2.4 WAC materialisation, live (step 6)

`writeAclGrant` becomes real: Alice's `LivePod` (her authed fetch, she holds `acl:Control`)
reads `/alice/data/records.ttl.acl` (discover the ACL location from the `Link rel="acl"` header,
never assume the suffix), parses via `@solid/object` typed accessors, adds an
`acl:Authorization` (`acl:agent` = agent R's WebID, `acl:mode acl:Read`, `acl:accessTo` the
records), and PUTs it back with `If-Match`. The decision record (G14 mitigation, already
implemented) records `aclResource` + the mutation — on the live pod that record now names a real,
dereferenceable `.acl`.

**The demo must show WAC working both ways**: before step 6, agent R's authed GET of the records
returns **403** (asserted); after the grant, **200**. That before/after pair is printed in the
demo transcript — the pod server itself enforcing the materialised boundary is half the story.

### 2.5 PROV bundle + trace writes, live (step 7)

`writeEngagement` / `writeActivity` / `writeDecision` run unchanged over `LivePod`. Each party's
trace copy is written **only by that party's side, with its own sessions** — Alice's copy under
`/alice/agents/engagements/e1/` by Alice's session (setup: mandate, credentials, status
mirror) and agent A's session (negotiation outputs: agreement, chain overlay, decisions, and
the activity bundles Alice's side mirrors from R's LDN announcements, §3.4); the institute's
mirror under `/institute/agents/engagements/e1/` by agent R's session (its `acl:Write`
delegation, §1.4). The mirrored-copy integrity argument of DESIGN §5 only holds if no single
credential can write both copies — the disjoint §1.4 grants enforce it, and the seeding tests
assert the cross-writes 403.

---

## 3. G11 — the LDN carrier

### 3.1 What travels over LDN

Two distinct uses of the same mechanism, both plain LDN (POST to a discovered `ldp:inbox`; no
new vocabulary):

**(a) The A2A handshake carrier** (agent A ↔ agent R): `UpgradeOffer`, `UpgradeResponse`, the
SHACL-validated intents, and the concluded-agreement pointer. Sender POSTs to the peer's inbox;
receiver polls its own inbox (it owns it; `acl:Read` is the owner's — plus, for Alice's inbox,
her delegated processor agent A, per the §1.4 grant).

**(b) The accountability notification** (agent R → Alice): after each activity bundle lands in
the institute's trace, R POSTs an announcement to Alice's inbox — "the owner's unpollable copy"
(SCENARIO step 7b).

### 3.2 Inbox discovery + provisioning

Standard LDN: the receiver's WebID document carries `<webid> ldp:inbox <inbox-container>`.
Seeding (T2) creates the container and writes the triple. ACL: owner full; `acl:Append` (only)
for the specific counterparty WebIDs — LDN receivers grant append-not-read to senders, so a
sender cannot enumerate or read others' notifications. No public append in the demo (spam is
out of scope; the two senders are known).

### 3.3 The notification shape

One envelope for both uses — an AS2 activity, JSON-LD (`application/ld+json`), the LDN default
media type; the pod assigns the notification IRI on POST (201 + Location):

```jsonc
{
  "@context": "https://www.w3.org/ns/activitystreams",
  "type": "Announce",                     // (b); the handshake (a) uses "Offer" /
                                          // "Accept" / "Reject" mapped from the
                                          // codec's own semantics
  "actor":  "<sender agent WebID>",
  "target": "<engagement container IRI>", // correlation: the engagement IS the thread
  "object": {
    // (a) handshake: the codec payload embedded verbatim — encodeUpgradeOffer()
    //     etc. already produce a self-contained JSON object; it rides as the
    //     object with its own type field intact. No re-encoding, no lossy wrap.
    // (b) activity announce: the IRI of the just-written activity bundle:
    //     { "id": "<…/activities/act-1.ttl#act>", "type": "prov:Activity" }
  },
  "inReplyTo": "<the notification IRI this responds to>",   // handshake threading
  "published": "<xsd:dateTime>"
}
```

Receiver processing rules (fail-closed, all asserted in tests):

- the receiver **trusts nothing in the envelope**: the handshake payload is decoded by the
  `solid-a2a` codec (which validates), and any dereferenceable `object` IRI is fetched through
  the receiver's own guarded fetch and **must be within the counterparty's already-verified
  origin** — a notification cannot steer the receiver to a third origin (SSRF discipline);
- `actor` is advisory; authority comes only from the four-phase-verified chain exchanged in the
  payload — an inbox POST authorizes nothing by itself;
- unknown `type` / malformed body → the notification is skipped and logged, never fatal
  (untrusted-input discipline: drop, don't abort);
- polling: the demo agents poll their inbox container listing (via `ContainerDataset`) with a
  short interval + overall deadline; live WebSocket notifications are explicitly **not** used
  (one less moving part; the `solid-notifications` upgrade is a stretch note, §6.4).

### 3.4 Who posts / who reads — the full message flow

```
A: POST Offer(upgrade)            → R's inbox          R polls, decodes, verifies PD pin
R: POST Accept + intent           → A's inbox          A validates intent (SHACL), verifies R's chain (4-phase)
A: POST intent + chain pointers   → R's inbox          R verifies A's chain (4-phase)
A: writes agreement + credentials → Alice's trace copy (A's session; §2.5)
A: POST Announce(agreement)       → R's inbox          R countersigns (mirrored credential, G15
                                                        pattern) and writes the agreement +
                                                        credentials into the INSTITUTE trace
                                                        (R's session — its own copy, §2.5)
[Alice's session materialises the WAC grant — step 6]
R: acts (reads records), writes activity bundle + decision record → institute trace
R: POST Announce(activity)        → Alice's inbox      Alice's copy: AGENT A's session (the ONE
                                                        Alice-side trace writer, §2.5) polls the
                                                        inbox, dereferences the announced bundle
                                                        (guarded fetch, counterparty-origin-bound
                                                        §3.3) and mirrors it into
                                                        /alice/…/activities/ — Alice's own session
                                                        is reserved for owner acts (ACL grant,
                                                        revocation), never routine trace writes
```

The carrier stays **runtime-local** (`live/ldn.ts`), per BUILD-PLAN Phase 2.2: extract a
`@jeswr/solid-agent` carrier only after a second consumer exists.

---

## 4. The demo harness — one command

### 4.1 Invocation

```
npm run demo:live            # in accountable-agent-runtime; or, once bin is wired:
npx @jeswr/accountable-agent-runtime demo [--keep] [--base <url>] [--json <file>]
```

| Flag | Meaning |
|---|---|
| *(none)* | boot CSS on a free port → seed → run → audit → print → teardown |
| `--keep` | leave the server up + print the base URL and every seeded IRI (for poking around; credentials are NOT printed — see §6.2 note on reruns) |
| `--base <url>` | skip the boot; target an **already-running** local server (this is also how the PSS variant and any future maintainer-pod run enter — the harness then only seeds what is missing and requires the credentials via env, never argv) |
| `--json <file>` | additionally write the machine-readable run record (§5.3) |

### 4.2 The phases (what's scripted vs. what needs a running server)

```
[1] BOOT      spawn `npx @solid/community-server` (in-memory config, free port);
              poll / until 200; ~10–20 s cold npx, <5 s warm      — scripted, self-contained
[2] SEED      4 accounts + pods (CSS account API) → client-credentials
              → DPoP sessions; profiles (name, storage, inbox triple, agent
              pointer); keys (publishActorKey → live documents); records;
              protocol document; status list; inboxes; ALL ACLs    — scripted (live/seed.ts)
[3] SCENARIO  SCENARIO.md steps 1–7 over the live adapters:
              mandate + credential → discovery (guarded fetch) →
              LDN handshake (§3) → four-phase verify (live resolvers)
              → agreement + mirrored credentials → WAC grant
              (403→200 asserted) → action → PROV + decision records
              → LDN announce                                        — scripted (the runtime)
[4] NEGATIVE  the four negative acts, §4.4                          — scripted
[5] AUDIT     the auditor CLI (§5) against the pod, ZERO credentials — scripted
[6] PRINT     the human transcript + optional JSON; exit 0 iff every
              assertion held                                        — scripted
[7] TEARDOWN  kill the CSS child (skipped under --keep)             — scripted
```

Only [1] "needs a server" and the harness itself provides it; with `--base` even that is
external. Target wall-clock for the full run: under a minute warm.

Failure discipline: any phase failure tears down (unless `--keep`), prints the failing step +
the last server log lines, exits non-zero. The child process is orphan-proofed (killed on
`exit`/`SIGINT`; a PID file guard for the `--keep` case).

### 4.3 Testing posture

- The live path ships as an **opt-in integration suite**: `AAR_IT=1 npm test` runs
  `test/integration/live-demo.test.ts`, which drives the same phases programmatically and
  asserts the §4.4 verdicts + the audit output shape. Default `npm test` stays hermetic
  (Phase-0/1 golden masters untouched) — same convention as PSS's `PSS_IT=1`.
- Live-run assertions are **structural, not golden**: real timestamps/ports/UUIDs make bytes
  non-reproducible; the invariants asserted are decisions (`permit`/`deny` + error codes),
  breach verdicts, the 403→200 WAC flip, provGap flags, and the JSON schema (§5.3).

### 4.4 The negative acts, live

Accountability claims are only credible when the failure modes are exercised on the same live
stack (DESIGN §5). Each act runs after the happy path, in its own engagement container or a
scoped mutation that is reverted:

| # | Act | Live mechanics | Asserted verdict |
|---|---|---|---|
| N1 | forged hop | a fifth, unseeded keypair signs a tampered agreement credential; written to a `…/e-n1/` trace | Phase A `INVALID_SIGNATURE` → audit re-run deny |
| N2 | out-of-scope use | dispute re-run with `actualUsePurpose` ≠ the agreement's `purpose` (the §4 dispute itself) | Phase D deny; `dispute.breach === true` |
| N3 | revoked subtree | Alice flips the mandate's Bitstring status bit (re-issues the signed list over the live resource) AND publishes `odrld:Revocation` | Phase C deny on the current-instant re-run; the action-instant re-run still permits — the divergence is reported as the finding it is |
| N4 | PROV-omitting actor | R reads the records again but writes NO activity bundle | the auditor's `provGap: true` on the derived artifact + the mirrored-trace divergence; and the server's own access log (CSS request log) is named in the transcript as the non-repudiable floor |

---

## 5. The auditor command

### 5.1 Invocation + inputs

```
npx @jeswr/accountable-agent-runtime audit <artifact-iri> \
    [--engagement <container-iri>] [--purpose <actual-use-iri>] [--json] [--at <instant>]
```

- `<artifact-iri>` — the thing found in the wild (the derived summary). The walk needs a trace
  container; `--engagement` gives it directly, otherwise the auditor dereferences the artifact
  and follows its `prov:wasGeneratedBy` → the activity bundle's own location implies the
  container (both live under `…/engagements/<id>/`).
- `--purpose` — the purpose evident in the offending artifact; triggers the dispute re-run.
- `--at` — override the re-run instant (defaults to the activity's `prov:startedAtTime`, per the
  stale-replay discipline; a second current-instant run is always added for "is it still").
- **No credentials.** The auditor constructs `LivePod`-as-source over the plain guarded fetch;
  its resolvers are §2.3's. If the trace is not publicly readable it fails with a clear
  "auditor needs read access to <iri>" — an honest error, not a fallback.

Implementation: a thin `bin/` entry (`src/cli.ts`, wired via `package.json` `"bin"`) around the
existing `loadTrace` + `auditArtifact`. No new audit logic.

### 5.2 Human output

Designed to be read top-down as the answer to the three questions, one section each; fixed
ASCII (no color dependency; `--no-color` unnecessary), IRIs printed in full (an auditor
copy-pastes them):

```
AUDIT  <artifact-iri>
       trace: <engagement container>   read: public (no credentials presented)

WHO AUTHORIZED THIS ACTION?
  artifact   <derived-iri>
    generated by  <activity-iri>   at 2026-07-04T09:12:03Z
    acting agent  <agent-r webid>        (prov:wasAssociatedWith)
    on behalf of  <institute webid>      (prov:actedOnBehalfOf)
  authority chain (root → leaf):
    [1] mandate    <mandate-iri>     attributed to <alice>       signed ✓ (eddsa-rdfc-2022)
    [2] agreement  <agreement-iri>   attributed to <agent-a>     signed ✓   delegatedUnder [1]
  identity composition:
    leaf assignee <institute> ≠ acting agent <agent-r>
    second chain  <instAgentVc-iri>  root = <institute>          verified ✓ (D9)

UNDER WHAT POLICY?
  leaf agreement <agreement-iri>
    permits  read  on  <records-iri>
    purpose  = <dpv:ResearchAndDevelopment>
    until    2027-07-03T00:00:00Z
    duties   delete at expiry (unfulfilled as of now — finding)

WAS IT IN SCOPE?
  four-phase re-run at action instant (2026-07-04T09:12:03Z):
    A credential integrity  PASS   B cross-binding  PASS
    C status ∪ revocation   PASS   D policy walk    PERMIT
    recorded decision at action time: PERMIT      divergence: none
  four-phase re-run at current instant:            PERMIT       (chain still live)
  DISPUTE — actual use purpose <marketing-iri>:
    phase D  DENY  (purpose constraint violated on permission #1)
    ⇒ BREACH: action was authorized; THIS USE was not.
    answerable: <institute>  under <agreement-iri>, terms set by <alice> in <mandate-iri>

VERDICT  breach=true  divergence=false  provGap=false
```

(A `provGap` artifact short-circuits: the WHO section prints the gap + the mirrored-trace
divergence and the verdict is `provGap=true` — the absence itself is the finding.)

### 5.3 Machine output (`--json`)

The JSON is the existing `AuditReport` interface (reader.ts) — already the machine shape —
wrapped in a versioned envelope so consumers can pin it:

```jsonc
{
  "$schema": "https://w3id.org/jeswr/accountable-agent/audit-report/v1",
  "generatedAt": "…", "auditor": { "credentialsPresented": false },
  "trace": { "engagement": "…", "source": "…" },
  "report": { /* AuditReport verbatim: artifact, provGap, activity, actingAgent,
                 onBehalfOf, leafPolicy, authorityChain[], used[], actionInstant,
                 reRun { decision, phase, code, hops[] }, divergence,
                 dispute { actualUsePurpose, authorized, reason, breach } */ }
}
```

Exit codes: `0` walk completed, no breach/divergence/provGap; `3` breach; `4` divergence;
`5` provGap; `2` walk impossible (unreadable trace / malformed chain). Non-zero-but-successful
verdicts are deliberate: in CI the *demo* asserts N2 exits `3`.

The `$schema` IRI joins the provisional `w3id.org/jeswr/accountable-agent#` family (G9's
decision-record terms) — same re-basing caveat, same w3id redirect `needs:user`.

---

## 6. Honest gap list — what this demo proves and doesn't

### 6.1 Proves (new, beyond Phase 1)

- the §4 scenario end-to-end over a **real Solid server**: real DPoP auth, real WAC enforcement
  (the 403→200 flip is the server's own decision, not the runtime's), real LDN delivery, real
  dereferenceable trace/keys/status documents;
- the four-phase verifier and the auditor walk operating on **live documents fetched over HTTP**
  with the production resolvers — no test double anywhere in the verification path;
- the auditor needs **zero credentials and zero runtime-proprietary data** — every input to the
  walk is a standard-vocabulary resource on the pod.

### 6.2 Demo-only relaxations (each printed in the transcript, none silent)

- **loopback HTTP, not TLS** — `allowLoopback` on the guard; transport confidentiality/identity
  is out of demo scope. A non-loopback base gets the unmodified https-only guard.
- **public-read trace** — the strongest auditor claim, but a real deployment scopes it (§1.4).
- **G3 open (`verifyPresentation` challenge/domain)** — chains travel as pod resources +
  in-envelope payloads; presentation-replay defence remains DPoP + the fail-closed status gate,
  and the transcript says so (BUILD-PLAN Phase 2.3's stopgap, unchanged).
- **`--keep` reruns**: the in-memory server forgets on teardown; `--keep` + a second run
  re-seeds fresh engagement ids rather than resuming (create-only `If-None-Match: *` writes make
  a collision loud, not silent).

### 6.3 Still stubbed / out of scope (unchanged from DESIGN/BUILD-PLAN)

- **G14** — the `.acl` still cannot reference the agreement; linkage lives in the decision
  record. Real fix = M5a server-side ODRL beside WAC (**CORE-PSS, maintainer-gated**, flagged
  separately as before).
- **G15** — countersigning stays the mirrored-credential pattern.
- **G9** — decision records remain on the provisional vocabulary pending the ODRL CG report
  namespace.
- **G12** — the purpose/period intent shape stays runtime-shipped PD content.
- **server-side enforcement of purpose** — unchanged honest boundary (DESIGN §5): the demo makes
  the breach *provable*, not preventable.

### 6.4 The "long-running agent endpoint" row — how far this narrows it

Honestly: **partially.** All inter-agent messages traverse the pod inboxes over real HTTP, so
the *carrier* is real and the two agent roles share no in-process state on the message path —
but both roles still run inside one orchestrating harness process, started and stopped by the
demo. There is still no independently-deployed service listening at a public agent IRI. A
`--split` mode (two OS processes, each polling only its own inbox, harness only sequencing) is a
cheap stretch that makes the decoupling inspectable; the *actual* closing of that vision row —
a persistent agent endpoint on live infrastructure — is a separate initiative
(`@jeswr/solid-agent`) and stays on the vision paper's tracked-gap list.

### 6.5 `needs:user` (genuinely human-gated; everything else proceeds)

1. **Live-live variant**: running the demo against the maintainer's real pod / WebID
   (`jeswr.org` / solid-test) — a live-deploy action + his identity; the `--base` +
   `solid-openid-client` interactive path is the designed entry point when he wants it.
2. **w3id redirects** for `w3id.org/jeswr/accountable-agent#` (G9 terms + the §5.3 schema IRI) —
   the standing w3id PR gate.
3. **npm publish** of the runtime (+ `bin`) — the standing deferred npm-OTP migration;
   GitHub-install (`npx` via git) works meanwhile.
4. **PSS docker stack on the dev box** — the known docker-socket issue makes T8 run-elsewhere
   until resolved.

---

## 7. Build sub-tasks (bead-ready)

All in `jeswr/accountable-agent-runtime` unless noted; each its own branch + worktree, gate +
roborev + adversarial verify per the shared contract; `securityCritical` where marked (auth,
ACL, SSRF surfaces ⇒ **not** auto-merge-eligible under the drive policy).

| Id | Task | Depends | Agent type | Model | Sec? |
|---|---|---|---|---|---|
| T0 | land the in-flight `refactor/consume-agent-authz-verifier` (@ `ad4d176`, worktree `aar-vqyk`) — verify + merge, do NOT redispatch | — | (orchestrator: verify-merge) | — | yes |
| T1 | `live/pod.ts` — `LivePod` (ResourceSink/Source over injected fetch; scope guard, redirect refusal, If-None-Match/If-Match discipline, Link-rel acl discovery, container creation) + `live/fetch.ts` (loopback-gated guarded fetch, §2.3) | T0 | suite-package-author | fable | yes |
| T2 | `live/seed.ts` + parameterised cast — CSS boot child-process mgmt, 4 accounts via account API, profiles/keys/inbox/records/protocol/status-list seeding, ALL ACLs via `@solid/object`; `buildCast(bases)`; ANP descriptions merged into the agent WebID documents per the resolved §1.4 hosting decision (no `solid-agent-card` change needed); assert the §1.4 cross-write 403s | T0 | suite-package-author | fable | yes (ACLs) |
| T3 | `live/auth.ts` — per-actor solid-dpop client-credentials sessions; no persistence, no logging of secrets | T0 | suite-package-author | sonnet | yes |
| T4 | step 6/7 live: WAC grant via typed accessors + the 403→200 assertion; engagement/activity/decision writes over `LivePod`; mirrored-trace write separation (§2.5) | T1,T2,T3 | suite-package-author | fable | yes |
| T5 | `live/ldn.ts` — the G11 carrier (§3): envelope codec, inbox post/poll, fail-closed receiver rules, handshake threading | T1,T3 | suite-package-author | fable | yes (SSRF rules) |
| T6 | the auditor CLI (§5): `src/cli.ts` + `bin` wiring, human renderer, JSON envelope + exit codes, `--at`/`--purpose`/`--engagement` | T1 | suite-package-author | sonnet | no (read-only; wraps existing reader) |
| T7 | the one-command harness (§4): `demo:live` script, phases 1–7, negative acts N1–N4 live, `AAR_IT=1` integration suite, README quickstart + transcript sample; flip the two `agentic-solid-vision` gap rows + add the runtime README pointer (small doc PR to that repo) | T4,T5,T6 | suite-package-author | fable | yes (it wires all of the above) |
| T8 *(optional, deferred)* | `--server=pss` target: PSS docker boot + provisioning-API seeding; run the identical demo | T7 + docker (`needs:user` 6.5.4) | platform-specialist | sonnet | yes |
| T9 *(stretch)* | `--split` two-process mode (§6.4) | T7 | suite-package-author | sonnet | no |

Suggested bead edges: `r8mz.T1/T2/T3` parallel after T0; T4,T5 after; T6 parallel with T4/T5;
T7 the integrator; T8/T9 unblocked-optional after T7.

---

## 8. Skeleton (pseudocode only — the shape T7 assembles)

```ts
// scripts/demo-live.mjs (via src/demo.ts)
const css   = await bootCss({ keep: flags.keep });                 // [1]
try {
  const actors = await seedAll(css.base);                          // [2] accounts+pods+
  const cast   = buildCast(actors);                                //     docs+ACLs+sessions
  const live   = liveAdapters(cast, actors);                       // pods, ldn, resolvers

  const run    = await runScenario({ cast, ...live });             // [3] the EXISTING
  assert(run.wacFlip === "403->200");                              //     scenario, live seams

  const neg    = await runNegativeActs({ cast, ...live });         // [4] N1..N4

  const audit  = await auditArtifact(run.derivedArtifact, {        // [5] zero-credential
    ...publicResolvers(css.base),                                  //     source + resolvers
    actualUsePurpose: MARKETING,
  });
  assert(audit.dispute?.breach === true);

  printTranscript({ run, neg, audit });                            // [6]
  if (flags.json) writeJson(flags.json, envelope(audit));
} finally {
  if (!flags.keep) await css.teardown();                           // [7]
}
```
