import type { Quad } from "@rdfjs/types";
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
/**
 * Emit the per-action PROV activity bundle (delegation profile §8) as quads —
 * `prov:Activity` with `wasAssociatedWith` / `used` / `generated` / times and a
 * `qualifiedAssociation` naming the `hadPlan` (the leaf Agreement), plus the
 * `actedOnBehalfOf` edge and, per generated artifact, `wasDerivedFrom` the used
 * resources + `wasGeneratedBy` the activity. Built via the typed write path.
 */
export declare function actionProvenance(input: ActionProvenanceInput): Quad[];
//# sourceMappingURL=activity.d.ts.map