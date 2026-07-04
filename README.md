<!-- AUTHORED-BY Claude Fable 5 -->

# accountable-agent-runtime

A **reference accountable-agent runtime**: the small executable that composes the agentic-Solid
stack — [`@jeswr/solid-agent-card`](https://github.com/jeswr/solid-agent-card) (discovery),
[`@jeswr/solid-a2a`](https://github.com/jeswr/solid-a2a) (NL→RDF negotiation),
[`@jeswr/solid-odrl`](https://github.com/jeswr/solid-odrl) (policy + the agent-delegation
profile), [`@jeswr/solid-vc`](https://github.com/jeswr/solid-vc) (signed authorization
credentials) and the [Agent Authorization Credentials
note](https://github.com/jeswr/agent-authz-credential-spec) — into the [Accountable Web of
Agents](https://github.com/jeswr/agentic-solid-vision) vision paper's §4 worked scenario, made
executable: a principal delegates to an agent, the agent discovers a counterparty, negotiates,
receives scoped pod access, acts — and **every action leaves a standard, independently
verifiable accountability trace** an auditor can walk back to the delegating principal.

**Status: PHASE 2 SHIPPED** (BUILD-PLAN Phases 0–2) — the whole §4 flow runs both as a
deterministic, golden-master-tested script over test doubles (**real crypto**, doubled I/O) AND,
in Wave-2, **on a live Solid pod** via a one-command demo. The package exports the composed
four-phase chain verifier (G7, incl. the D9 identity-composition rule), the trace writer/reader
(the auditor's mechanical walk), the scripted scenario, and the live layer (`LivePod` + per-actor
DPoP auth + the LDN carrier + the live resolvers + the zero-credential auditor).

```ts
import { runScenario, loadTrace, auditArtifact } from "@jeswr/accountable-agent-runtime";

const r = await runScenario();                       // discover → upgrade → 4-phase verify → act
const trace = await loadTrace(r.pod, r.cast.engagementBase);
const audit = await auditArtifact(trace, r.cast.derivedArtifact, {
  resolveKey: r.keyResolver.resolveKey,
  isControlledBy: r.keyResolver.isControlledBy,
  actualUsePurpose: "https://w3id.org/dpv#DirectMarketing",  // the dispute → a breach finding
});
// audit.authorityChain → Alice → agent A → the institute; audit.dispute.breach === true
```

## The live demo — one command

```bash
npm run demo:live          # or: npx accountable-agent-runtime demo
```

This boots an in-memory [Community Solid Server](https://github.com/CommunitySolidServer/CommunitySolidServer)
on a free loopback port (zero prerequisites beyond Node), seeds four DPoP-authenticated pods
(Alice / agent&nbsp;A / the institute / agent&nbsp;R), and runs the §4 scenario **over real HTTP**:
discovery → an A2A upgrade handshake carried over live LDN inboxes → the four-phase verify with the
**production** resolvers over live documents → a **WAC 403→200 grant the server itself decides** →
the action → a mirrored, disjoint-writer accountability trace → an LDN announcement to the owner.
It then runs the four negative acts (forged hop, out-of-scope use, revoked subtree, PROV-omitting
actor) on the same live stack, and finally runs the **auditor with zero credentials** — printing
the transcript that answers *who authorized this action, under what policy, and was it in scope?*
from public RDF read off the live pod. The demo tears the server down and exits 0 iff every
assertion held. Flags: `--keep` (leave the server up), `--base <url>` (target a running local
server), `--json <file>` (also write the machine-readable audit envelope).

The auditor is also a standalone command over any live pod's public trace:

```bash
npx accountable-agent-runtime audit <artifact-iri> [--engagement <container-iri>] \
    [--purpose <iri>] [--at <instant>] [--base <url>] [--json]
# exit codes: 0 clean · 3 breach · 4 divergence · 5 provGap · 2 unwalkable
```

The live path ships as an **opt-in integration suite** (`AAR_IT=1 npm test`, drives the demo
against a booted CSS); the default `npm test` stays hermetic — the 58 golden masters plus the
pure-logic unit suites (the LDN receiver rules, the policy builders, the auditor rendering) run
with **no server**.

The design deliverables:

| Doc | What it is |
|---|---|
| [`docs/DESIGN.md`](./docs/DESIGN.md) | the runtime's shape, the on-pod accountability artifact + auditor procedure, the package-by-package composition seams, **the API gap list (G1–G15)**, and the honest enforced-vs-accountable boundary |
| [`docs/SCENARIO.md`](./docs/SCENARIO.md) | the §4 flow walked API-call-by-API-call against the verified current package APIs |
| [`BUILD-PLAN.md`](./BUILD-PLAN.md) | the phased plan: deterministic scripted scenario over test doubles → real packages (closing the gaps) → live pod demo |
| [`docs/DECISIONS.md`](./docs/DECISIONS.md) | design rationale per decision |

> ⚠️ Experimental, AI-agent-authored (design by Claude Fable 5; the Phase-0 implementation by
> Claude Opus 4.8 — see `docs/MODEL-PROVENANCE.md`). The composed packages are all explicitly
> experimental; this demonstrates **accountability, not prevention** — the boundary is stated
> honestly in `DESIGN.md` §5, and the negative acts (forged hop, out-of-scope use, revoked subtree,
> PROV-omitting actor) are exercised as first-class content, not narrated.

MIT © Jesse Wright
