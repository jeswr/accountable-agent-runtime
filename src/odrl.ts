// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// ===========================================================================
//  G10 SEAM — the agent-delegation profile surface of `@jeswr/solid-odrl`.
// ===========================================================================
//
// The whole runtime depends on the ODRL AGENT-DELEGATION PROFILE (`evaluateDelegated`
// fail-closed chain walker, `delegationProvenance` PROV overlay, delegation-aware
// `policyToTurtle`, the `odrld:`/`prov:` vocabulary). That surface lives on
// `@jeswr/solid-odrl`'s `feat/delegation-profile` branch (@18df183) and is NOT yet
// merged to `main` — gap **G10** in `docs/DESIGN.md` §4.
//
// So the runtime routes EVERY delegation-profile call through THIS ONE module,
// currently backed by that unmerged branch (pinned by exact sha in package.json —
// `git+https://github.com/jeswr/solid-odrl.git#18df1835…`, committed `dist/`, so it
// installs under `ignore-scripts=true` with no build step). The evaluator, its
// fail-closed semantics and the decision-matrix teeth are the REAL package code —
// nothing is faked; only the delivery channel (an unmerged branch behind a seam) is
// provisional.
//
// PHASE 1 (BUILD-PLAN): once G10 merges `feat/delegation-profile` → `main` and cuts
// the committed `dist/`, repoint package.json's `@jeswr/solid-odrl` to the merged
// commit — this file is UNCHANGED (same import specifier). No other runtime module
// imports `@jeswr/solid-odrl` directly, so the swap is a single dependency bump.

export type {
  ActiveDuty,
  Decision,
  DecisionRule,
  DelegatedEvaluationResult,
  DelegationEvaluateOptions,
  DelegationHopTrace,
  EvaluationResult,
  OdrlConstraint,
  OdrlDuty,
  OdrlPolicy,
  OdrlRule,
  PolicyType,
  RequestContext,
  RuleType,
} from "@jeswr/solid-odrl";
export {
  constraintSatisfied,
  DEFAULT_MAX_CHAIN_LENGTH,
  delegationProvenance,
  evaluate,
  evaluateDelegated,
  matchingPermissions,
  ODRL,
  ODRL_GRANT_USE,
  ODRL_NEXT_POLICY,
  ODRLD,
  ODRLD_DELEGATED_UNDER,
  ODRLD_PROFILE_IRI,
  ODRLD_REVOCATION_CLASS,
  ODRLD_REVOKED_POLICY,
  PROV_ACTED_ON_BEHALF_OF,
  PROV_WAS_ATTRIBUTED_TO,
  PROV_WAS_DERIVED_FROM,
  parsePolicy,
  policyFromRdf,
  policyToTurtle,
  requestContextFromA2AIntent,
  requestContextFromWac,
} from "@jeswr/solid-odrl";
