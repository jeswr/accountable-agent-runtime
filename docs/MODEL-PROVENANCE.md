<!-- AUTHORED-BY Claude Opus 4.8 -->

# Model provenance ledger

While Fable is unavailable, everything authored by **Claude Opus 4.8** is tagged so it can be
targeted for re-review / upgrade when Fable returns (suite standing rule).

| Artifact | Author | Notes |
|---|---|---|
| `docs/DESIGN.md`, `docs/SCENARIO.md`, `docs/DECISIONS.md`, `BUILD-PLAN.md`, `README.md` (design) | Claude Fable 5 | the design-only phase (pre-existing) |
| `src/**` — the Phase-0 implementation (chain verifier G7, trace writer/reader G8/G9, the scripted scenario, the G10 seam, the RDF helpers, vocab) | Claude Opus 4.8 | re-review/upgrade candidate |
| `test/**` — the golden-master decision matrix + scenario + assembly unit tests | Claude Opus 4.8 | re-review/upgrade candidate |
| `scripts/**`, config (`package.json`, `tsconfig*`, `biome.json`, `vitest.config.ts`) | Claude Opus 4.8 | re-review/upgrade candidate |

Every source file carries an `AUTHORED-BY Claude Opus 4.8` top-of-file marker; every commit carries
the `Model: claude-opus-4-8` + `Provenance:` trailers.
