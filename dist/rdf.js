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
import { BlankNodeFrom, LiteralFrom, NamedNodeFrom } from "@rdfjs/wrapper";
import { DataFactory, Store, Writer } from "n3";
const factory = DataFactory;
/** A {@link NodeRef} for an IRI subject. */
export function iriRef(iri) {
    return { kind: "iri", value: iri };
}
function normalize(subject) {
    return typeof subject === "string" ? { kind: "iri", value: subject } : subject;
}
/**
 * A low-level typed quad builder over a fresh `n3.Store`. Every write goes through
 * the RDF/JS term factory (`@rdfjs/wrapper`'s `NamedNodeFrom`/`LiteralFrom`/
 * `BlankNodeFrom`) — never a hand-built triple (the house rule). Mirrored from
 * `@jeswr/solid-odrl`'s `GraphBuilder` so the trace writer shares its discipline.
 */
export class GraphBuilder {
    store = new Store();
    subjectTerm(ref) {
        return ref.kind === "iri"
            ? NamedNodeFrom.string(ref.value, factory)
            : BlankNodeFrom.string(ref.value, factory);
    }
    /** Add `(subject, predicate, object-IRI)`. */
    addIri(subject, predicate, objectIri) {
        const s = this.subjectTerm(normalize(subject));
        const p = NamedNodeFrom.string(predicate, factory);
        const o = NamedNodeFrom.string(objectIri, factory);
        this.store.add(factory.quad(s, p, o));
    }
    /** Add `(subject, rdf:type, class-IRI)`. */
    addType(subject, classIri) {
        this.addIri(subject, "http://www.w3.org/1999/02/22-rdf-syntax-ns#type", classIri);
    }
    /** Add `(subject, predicate, literal)` with an optional datatype IRI. */
    addLiteral(subject, predicate, value, datatypeIri) {
        const s = this.subjectTerm(normalize(subject));
        const p = NamedNodeFrom.string(predicate, factory);
        const o = datatypeIri === undefined
            ? LiteralFrom.string(value, factory)
            : factory.literal(value, NamedNodeFrom.string(datatypeIri, factory));
        this.store.add(factory.quad(s, p, o));
    }
    /** Mint a fresh blank node, link `(subject, predicate, _:b)`, return the blank's {@link NodeRef}. */
    linkBlankNode(subject, predicate) {
        const s = this.subjectTerm(normalize(subject));
        const blank = BlankNodeFrom.string(undefined, factory);
        const p = NamedNodeFrom.string(predicate, factory);
        this.store.add(factory.quad(s, p, blank));
        return { kind: "blank", value: blank.value };
    }
    /** The accumulated quads. */
    quads() {
        return [...this.store];
    }
}
/** Serialise quads to Turtle (default) or another n3 format via `n3.Writer`. */
export function serializeTurtle(quads, format = "text/turtle") {
    const writer = new Writer({ format });
    writer.addQuads(quads);
    return new Promise((resolve, reject) => {
        writer.end((error, result) => {
            if (error) {
                reject(error);
            }
            else {
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
export function canonicalize(quads) {
    return canonicalNQuads(quads);
}
/**
 * Parse an RDF body (Turtle by default) to a `DatasetCore` via the sanctioned parser.
 * `baseIRI` (the resource's own URL, where known) resolves relative IRIs — valid and
 * common in Solid resources; pass it whenever the caller knows the document URL.
 */
export async function parseTurtle(body, contentType = "text/turtle", baseIRI) {
    const options = baseIRI !== undefined ? { baseIRI } : undefined;
    return (await parseRdf(body, contentType, options));
}
//# sourceMappingURL=rdf.js.map