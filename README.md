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

**Status: DESIGN-ONLY.** No code yet. The deliverables here are:

| Doc | What it is |
|---|---|
| [`docs/DESIGN.md`](./docs/DESIGN.md) | the runtime's shape, the on-pod accountability artifact + auditor procedure, the package-by-package composition seams, **the API gap list (G1–G15)**, and the honest enforced-vs-accountable boundary |
| [`docs/SCENARIO.md`](./docs/SCENARIO.md) | the §4 flow walked API-call-by-API-call against the verified current package APIs |
| [`BUILD-PLAN.md`](./BUILD-PLAN.md) | the phased plan: deterministic scripted scenario over test doubles → real packages (closing the gaps) → live pod demo |
| [`docs/DECISIONS.md`](./docs/DECISIONS.md) | design rationale per decision |

> ⚠️ Experimental, AI-agent-authored (Claude Fable 5). The composed packages are all explicitly
> experimental; this design demonstrates **accountability, not prevention** — the boundary is
> stated honestly in `DESIGN.md` §5.

MIT © Jesse Wright
