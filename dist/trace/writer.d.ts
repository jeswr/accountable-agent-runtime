import type { VerifiableCredential } from "@jeswr/solid-vc";
import type { Quad } from "@rdfjs/types";
import type { ActionProvenanceInput, OdrlPolicy } from "../odrl.js";
import { type DecisionRecordInput } from "./decision-record.js";
/** A minimal write sink — one resource `put`. Injectable (pod double / authed fetch). */
export interface ResourceSink {
    put(url: string, body: string, contentType: string): Promise<void> | void;
}
/** A named credential to store under `credentials/`. */
export interface NamedCredential {
    /** The file slug (e.g. `mandate`, `agreement`, `institute-agent`). */
    readonly name: string;
    /** The credential to serialise. */
    readonly vc: VerifiableCredential;
}
/** The static (once-per-engagement) trace inputs. */
export interface EngagementTrace {
    /** The engagement container IRI (a trailing-slash container base). */
    readonly base: string;
    /** The root ODRL Agreement (mandate P). */
    readonly mandate: OdrlPolicy;
    /** The leaf ODRL Agreement. */
    readonly agreement: OdrlPolicy;
    /** The binding credentials (mandate / agreement / institute-agent …). */
    readonly credentials: readonly NamedCredential[];
    /** Any `odrld:Revocation` statements the owner has published. */
    readonly revocations?: readonly Quad[];
}
/** A record of one written artifact (path + canonical form) for golden pinning. */
export interface WrittenArtifact {
    readonly path: string;
    readonly contentType: string;
    readonly canonical: string;
}
/**
 * Write the once-per-engagement trace: `mandate.ttl`, `agreement.ttl`,
 * `chain.prov.ttl` (the `delegationProvenance` overlay), the binding credentials,
 * and `revocations.ttl` (when present). Returns the canonical form of each RDF
 * artifact so a golden master can pin the byte-stable trace.
 */
export declare function writeEngagement(sink: ResourceSink, trace: EngagementTrace): Promise<WrittenArtifact[]>;
/** Write one per-action PROV bundle to `activities/<id>.ttl`. Returns its quads (for LDN mirroring). */
export declare function writeActivity(sink: ResourceSink, base: string, activityId: string, input: ActionProvenanceInput): Promise<Quad[]>;
/** Write one decision record to `decisions/<id>.ttl`. Returns its quads. */
export declare function writeDecision(sink: ResourceSink, base: string, recordId: string, input: DecisionRecordInput): Promise<Quad[]>;
//# sourceMappingURL=writer.d.ts.map