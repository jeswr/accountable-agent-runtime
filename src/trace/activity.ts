// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// G8 — the per-ACTION PROV activity bundle emitter (delegation profile §8). The
// profile ships `delegationProvenance` (the chain overlay) but has NO per-action
// `actionProvenance()` emitter yet; the runtime authors the §8 bundle here, through
// the typed {@link GraphBuilder} (never a hand-built triple). Phase 1 (BUILD-PLAN)
// moves this into `@jeswr/solid-odrl` as `actionProvenance()` beside
// `delegationProvenance`, and the runtime deletes this file. Same shape, same
// discipline — a runtime-local stand-in for a package function that doesn't exist yet.

import type { Quad } from "@rdfjs/types";
import { GraphBuilder, iriRef } from "../rdf.js";
import {
  PROV_ACTED_ON_BEHALF_OF,
  PROV_ACTIVITY,
  PROV_AGENT,
  PROV_ASSOCIATION,
  PROV_ENDED_AT_TIME,
  PROV_GENERATED,
  PROV_HAD_PLAN,
  PROV_QUALIFIED_ASSOCIATION,
  PROV_STARTED_AT_TIME,
  PROV_USED,
  PROV_WAS_ASSOCIATED_WITH,
  PROV_WAS_DERIVED_FROM,
  PROV_WAS_GENERATED_BY,
  XSD_DATETIME,
} from "../vocab.js";

/** The inputs to a per-action PROV bundle (delegation profile §8). */
export interface ActionProvenanceInput {
  /** The activity IRI (`<#act>`). */
  readonly activity: string;
  /** The acting software agent WebID (`prov:wasAssociatedWith`). */
  readonly agent: string;
  /** The organisation the agent acted on behalf of (`prov:actedOnBehalfOf`). Optional. */
  readonly onBehalfOf?: string;
  /** The resource(s) the activity used (`prov:used`). */
  readonly used: string | readonly string[];
  /** The artifact(s) the activity generated (`prov:generated`). Optional. */
  readonly generated?: string | readonly string[];
  /** The plan the activity was carried out under — the leaf Agreement IRI (`prov:hadPlan`). */
  readonly plan: string;
  /** The activity start instant. */
  readonly started: Date;
  /** The activity end instant. Optional. */
  readonly ended?: Date;
}

function asArray(v: string | readonly string[] | undefined): readonly string[] {
  if (v === undefined) {
    return [];
  }
  return typeof v === "string" ? [v] : v;
}

/**
 * Emit the per-action PROV activity bundle (delegation profile §8) as quads —
 * `prov:Activity` with `wasAssociatedWith` / `used` / `generated` / times and a
 * `qualifiedAssociation` naming the `hadPlan` (the leaf Agreement), plus the
 * `actedOnBehalfOf` edge and, per generated artifact, `wasDerivedFrom` the used
 * resources + `wasGeneratedBy` the activity. Built via the typed write path.
 */
export function actionProvenance(input: ActionProvenanceInput): Quad[] {
  const b = new GraphBuilder();
  const act = iriRef(input.activity);
  b.addType(act, PROV_ACTIVITY);
  b.addIri(act, PROV_WAS_ASSOCIATED_WITH, input.agent);
  const used = asArray(input.used);
  for (const u of used) {
    b.addIri(act, PROV_USED, u);
  }
  const generated = asArray(input.generated);
  for (const g of generated) {
    b.addIri(act, PROV_GENERATED, g);
  }
  b.addLiteral(act, PROV_STARTED_AT_TIME, input.started.toISOString(), XSD_DATETIME);
  if (input.ended !== undefined) {
    b.addLiteral(act, PROV_ENDED_AT_TIME, input.ended.toISOString(), XSD_DATETIME);
  }
  const assoc = b.linkBlankNode(act, PROV_QUALIFIED_ASSOCIATION);
  b.addType(assoc, PROV_ASSOCIATION);
  b.addIri(assoc, PROV_AGENT, input.agent);
  b.addIri(assoc, PROV_HAD_PLAN, input.plan);
  if (input.onBehalfOf !== undefined) {
    b.addIri(iriRef(input.agent), PROV_ACTED_ON_BEHALF_OF, input.onBehalfOf);
  }
  for (const g of generated) {
    const artifact = iriRef(g);
    for (const u of used) {
      b.addIri(artifact, PROV_WAS_DERIVED_FROM, u);
    }
    b.addIri(artifact, PROV_WAS_GENERATED_BY, input.activity);
  }
  return b.quads();
}
