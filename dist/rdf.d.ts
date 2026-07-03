import type { DatasetCore, Quad } from "@rdfjs/types";
/** A subject reference: a named IRI or a minted blank node — never conflated. */
export type NodeRef = {
    readonly kind: "iri";
    readonly value: string;
} | {
    readonly kind: "blank";
    readonly value: string;
};
/** A {@link NodeRef} for an IRI subject. */
export declare function iriRef(iri: string): NodeRef;
/**
 * A low-level typed quad builder over a fresh `n3.Store`. Every write goes through
 * the RDF/JS term factory (`@rdfjs/wrapper`'s `NamedNodeFrom`/`LiteralFrom`/
 * `BlankNodeFrom`) — never a hand-built triple (the house rule). Mirrored from
 * `@jeswr/solid-odrl`'s `GraphBuilder` so the trace writer shares its discipline.
 */
export declare class GraphBuilder {
    private readonly store;
    private subjectTerm;
    /** Add `(subject, predicate, object-IRI)`. */
    addIri(subject: NodeRef | string, predicate: string, objectIri: string): void;
    /** Add `(subject, rdf:type, class-IRI)`. */
    addType(subject: NodeRef | string, classIri: string): void;
    /** Add `(subject, predicate, literal)` with an optional datatype IRI. */
    addLiteral(subject: NodeRef | string, predicate: string, value: string, datatypeIri?: string): void;
    /** Mint a fresh blank node, link `(subject, predicate, _:b)`, return the blank's {@link NodeRef}. */
    linkBlankNode(subject: NodeRef | string, predicate: string): NodeRef;
    /** The accumulated quads. */
    quads(): Quad[];
}
/** Serialise quads to Turtle (default) or another n3 format via `n3.Writer`. */
export declare function serializeTurtle(quads: readonly Quad[], format?: string): Promise<string>;
/**
 * The deterministic, blank-node-stable canonical form (URDNA2015 N-Quads) of a
 * quad set — the byte-stable representation the golden masters pin. Delegates to
 * `@jeswr/solid-vc`'s `canonicalNQuads` (rdf-canonize), so trace artifacts compare
 * equal across runs regardless of n3.Writer's pretty-print / blank-node labelling.
 */
export declare function canonicalize(quads: readonly Quad[]): Promise<string>;
/**
 * Parse an RDF body (Turtle by default) to a `DatasetCore` via the sanctioned parser.
 * `baseIRI` (the resource's own URL, where known) resolves relative IRIs — valid and
 * common in Solid resources; pass it whenever the caller knows the document URL.
 */
export declare function parseTurtle(body: string, contentType?: string, baseIRI?: string): Promise<DatasetCore>;
//# sourceMappingURL=rdf.d.ts.map