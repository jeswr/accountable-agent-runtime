// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The accountability-artifact WRITER — lays the engagement trace onto a pod
// (DESIGN §3.1). Everything RDF goes through the sanctioned serialisers: policies
// via the G10 seam's `policyToTurtle`, the chain overlay via `delegationProvenance`,
// the per-action bundle via G8's `actionProvenance`, the decision record via G9 —
// never a hand-built triple. The pod is an injectable {@link ResourceSink} (Phase 0
// an in-memory double; Phase 2 a DPoP-authed `fetch`).

import type { VerifiableCredential } from "@jeswr/solid-vc";
import type { Quad } from "@rdfjs/types";
import type { OdrlPolicy } from "../odrl.js";
import { delegationProvenance, policyToTurtle } from "../odrl.js";
import { canonicalize, parseTurtle, serializeTurtle } from "../rdf.js";
import { type ActionProvenanceInput, actionProvenance } from "./activity.js";
import { type DecisionRecordInput, decisionRecordQuads } from "./decision-record.js";

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

function join(base: string, path: string): string {
  return base.endsWith("/") ? `${base}${path}` : `${base}/${path}`;
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
export async function writeEngagement(
  sink: ResourceSink,
  trace: EngagementTrace,
): Promise<WrittenArtifact[]> {
  const written: WrittenArtifact[] = [];
  const putRdf = async (path: string, quads: readonly Quad[] | string): Promise<void> => {
    const url = join(trace.base, path);
    const turtle = typeof quads === "string" ? quads : await serializeTurtle(quads);
    await sink.put(url, turtle, "text/turtle");
  };

  const mandateTtl = await policyToTurtle(trace.mandate);
  await putRdf("mandate.ttl", mandateTtl);
  written.push({
    path: "mandate.ttl",
    contentType: "text/turtle",
    canonical: await canonicalize(await quadsOfPolicy(trace.mandate)),
  });

  const agreementTtl = await policyToTurtle(trace.agreement);
  await putRdf("agreement.ttl", agreementTtl);
  written.push({
    path: "agreement.ttl",
    contentType: "text/turtle",
    canonical: await canonicalize(await quadsOfPolicy(trace.agreement)),
  });

  const overlay = delegationProvenance([trace.mandate, trace.agreement]);
  await putRdf("chain.prov.ttl", overlay);
  written.push({
    path: "chain.prov.ttl",
    contentType: "text/turtle",
    canonical: await canonicalize(overlay),
  });

  for (const { name, vc } of trace.credentials) {
    const url = join(trace.base, `credentials/${name}.vc.jsonld`);
    await sink.put(url, JSON.stringify(vc), "application/ld+json");
  }

  if (trace.revocations !== undefined && trace.revocations.length > 0) {
    await putRdf("revocations.ttl", trace.revocations);
    written.push({
      path: "revocations.ttl",
      contentType: "text/turtle",
      canonical: await canonicalize(trace.revocations),
    });
  }

  return written;
}

/**
 * The policy's quads for golden pinning — obtained by parsing its serialised
 * Turtle (`policyToRdf` is not on the G10 seam's public export set, and
 * canonicalising the round-tripped form is equivalent + byte-stable).
 */
async function quadsOfPolicy(policy: OdrlPolicy): Promise<Quad[]> {
  const dataset = await parseTurtle(await policyToTurtle(policy));
  return [...dataset] as Quad[];
}

/** Write one per-action PROV bundle to `activities/<id>.ttl`. Returns its quads (for LDN mirroring). */
export async function writeActivity(
  sink: ResourceSink,
  base: string,
  activityId: string,
  input: ActionProvenanceInput,
): Promise<Quad[]> {
  const quads = actionProvenance(input);
  const url = join(base, `activities/${activityId}.ttl`);
  await sink.put(url, await serializeTurtle(quads), "text/turtle");
  return quads;
}

/** Write one decision record to `decisions/<id>.ttl`. Returns its quads. */
export async function writeDecision(
  sink: ResourceSink,
  base: string,
  recordId: string,
  input: DecisionRecordInput,
): Promise<Quad[]> {
  const quads = decisionRecordQuads(input);
  const url = join(base, `decisions/${recordId}.ttl`);
  await sink.put(url, await serializeTurtle(quads), "text/turtle");
  return quads;
}
