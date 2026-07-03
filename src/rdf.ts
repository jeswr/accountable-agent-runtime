// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The runtime's RDF read/write seam — the house rule enforced in one place:
//   - WRITE through the typed {@link GraphBuilder} (an `@rdfjs/wrapper` term-factory
//     write path, mirrored from `@jeswr/solid-odrl`'s `wrappers.ts`) — NEVER a
//     hand-concatenated triple.
//   - SERIALISE via `n3.Writer` ({@link serializeTurtle}).
//   - CANONICALISE via `@jeswr/solid-vc`'s `canonicalNQuads` (URDNA2015) —
//     deterministic, blank-node-stable output the golden masters pin ({@link canonicalize}).
//   - PARSE via `@jeswr/fetch-rdf`'s `parseRdf` — the sanctioned parser; never bespoke.

import { parseRdf } from "@jeswr/fetch-rdf";
import { canonicalNQuads } from "@jeswr/solid-vc";
import type { DataFactory as DataFactoryType, DatasetCore, Quad, Term } from "@rdfjs/types";
import { BlankNodeFrom, LiteralFrom, NamedNodeFrom } from "@rdfjs/wrapper";
import { DataFactory, Store, Writer } from "n3";

const factory = DataFactory as unknown as DataFactoryType;

/** A subject reference: a named IRI or a minted blank node — never conflated. */
export type NodeRef =
  | { readonly kind: "iri"; readonly value: string }
  | { readonly kind: "blank"; readonly value: string };

/** A {@link NodeRef} for an IRI subject. */
export function iriRef(iri: string): NodeRef {
  return { kind: "iri", value: iri };
}

function normalize(subject: NodeRef | string): NodeRef {
  return typeof subject === "string" ? { kind: "iri", value: subject } : subject;
}

/**
 * A low-level typed quad builder over a fresh `n3.Store`. Every write goes through
 * the RDF/JS term factory (`@rdfjs/wrapper`'s `NamedNodeFrom`/`LiteralFrom`/
 * `BlankNodeFrom`) — never a hand-built triple (the house rule). Mirrored from
 * `@jeswr/solid-odrl`'s `GraphBuilder` so the trace writer shares its discipline.
 */
export class GraphBuilder {
  private readonly store = new Store();

  private subjectTerm(ref: NodeRef): Term {
    return ref.kind === "iri"
      ? (NamedNodeFrom.string(ref.value, factory) as unknown as Term)
      : (BlankNodeFrom.string(ref.value, factory) as unknown as Term);
  }

  /** Add `(subject, predicate, object-IRI)`. */
  addIri(subject: NodeRef | string, predicate: string, objectIri: string): void {
    const s = this.subjectTerm(normalize(subject));
    const p = NamedNodeFrom.string(predicate, factory);
    const o = NamedNodeFrom.string(objectIri, factory);
    this.store.add(factory.quad(s as never, p as never, o as never) as Quad);
  }

  /** Add `(subject, rdf:type, class-IRI)`. */
  addType(subject: NodeRef | string, classIri: string): void {
    this.addIri(subject, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", classIri);
  }

  /** Add `(subject, predicate, literal)` with an optional datatype IRI. */
  addLiteral(
    subject: NodeRef | string,
    predicate: string,
    value: string,
    datatypeIri?: string,
  ): void {
    const s = this.subjectTerm(normalize(subject));
    const p = NamedNodeFrom.string(predicate, factory);
    const o =
      datatypeIri === undefined
        ? (LiteralFrom.string(value, factory) as unknown as never)
        : (factory.literal(value, NamedNodeFrom.string(datatypeIri, factory) as never) as never);
    this.store.add(factory.quad(s as never, p as never, o as never) as Quad);
  }

  /** Mint a fresh blank node, link `(subject, predicate, _:b)`, return the blank's {@link NodeRef}. */
  linkBlankNode(subject: NodeRef | string, predicate: string): NodeRef {
    const s = this.subjectTerm(normalize(subject));
    const blank = BlankNodeFrom.string(undefined, factory) as unknown as Term;
    const p = NamedNodeFrom.string(predicate, factory);
    this.store.add(factory.quad(s as never, p as never, blank as never) as Quad);
    return { kind: "blank", value: (blank as { value: string }).value };
  }

  /** The accumulated quads. */
  quads(): Quad[] {
    return [...this.store] as Quad[];
  }
}

/** Serialise quads to Turtle (default) or another n3 format via `n3.Writer`. */
export function serializeTurtle(quads: readonly Quad[], format = "text/turtle"): Promise<string> {
  const writer = new Writer({ format });
  writer.addQuads(quads as Quad[]);
  return new Promise((resolve, reject) => {
    writer.end((error, result: string) => {
      if (error) {
        reject(error);
      } else {
        resolve(result);
      }
    });
  });
}

/**
 * The deterministic, blank-node-stable canonical form (URDNA2015 N-Quads) of a
 * quad set — the byte-stable representation the golden masters pin. Delegates to
 * `@jeswr/solid-vc`'s `canonicalNQuads` (rdf-canonize), so trace artifacts compare
 * equal across runs regardless of n3.Writer's pretty-print / blank-node labelling.
 */
export function canonicalize(quads: readonly Quad[]): Promise<string> {
  return canonicalNQuads(quads);
}

/**
 * Parse an RDF body (Turtle by default) to a `DatasetCore` via the sanctioned parser.
 * `baseIRI` (the resource's own URL, where known) resolves relative IRIs — valid and
 * common in Solid resources; pass it whenever the caller knows the document URL.
 */
export async function parseTurtle(
  body: string,
  contentType = "text/turtle",
  baseIRI?: string,
): Promise<DatasetCore> {
  const options = baseIRI !== undefined ? { baseIRI } : undefined;
  return (await parseRdf(body, contentType, options)) as unknown as DatasetCore;
}
