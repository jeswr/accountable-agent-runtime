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

**Status: PHASE 0 SHIPPED** (BUILD-PLAN Phase 0) — the whole §4 flow runs as a deterministic,
golden-master-tested script over test doubles, with **real crypto** and doubled I/O only. The
package exports the composed four-phase chain verifier (G7, incl. the D9 identity-composition
rule), the trace writer/reader (the auditor's mechanical walk), and the scripted scenario. Phases
1–2 (real merged packages end-to-end, then a live pod) remain per the build plan.

```ts
import { runScenario, loadTrace, auditArtifact } from "@jeswr/accountable-agent-runtime";

const r = await runScenario();                       // discover → upgrade → 4-phase verify → act
const trace = await loadTrace(r.pod, r.cast.engagementBase);
const audit = await auditArtifact(trace, r.cast.derivedArtifact, {
  resolveKey: r.keyRing.resolveKey,
  actualUsePurpose: "https://w3id.org/dpv#DirectMarketing",  // the dispute → a breach finding
});
// audit.authorityChain → Alice → agent A → the institute; audit.dispute.breach === true
```

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
