// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// ===========================================================================
//  G10 SEAM — the agent-delegation profile surface of `@jeswr/solid-odrl`.
// ===========================================================================
//
// The whole runtime depends on the ODRL AGENT-DELEGATION PROFILE (`evaluateDelegated`
// fail-closed chain walker, `delegationProvenance` PROV overlay, `actionProvenance`
// per-action bundle emitter [G8, Phase 1], delegation-aware `policyToTurtle`, the
// `odrld:`/`prov:` vocabulary). G10 is CLOSED: that surface is merged to
// `@jeswr/solid-odrl` `main` (package.json pins the merged commit by exact sha;
// committed `dist/`, so it installs under `ignore-scripts=true` with no build step).
//
// The runtime still routes EVERY delegation-profile call through THIS ONE module —
// no other runtime module imports `@jeswr/solid-odrl` directly — so any future
// dependency move is a single-file swap.

export type {
  ActionProvenanceInput,
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
  actionProvenance,
  actionProvenanceJsonLd,
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
