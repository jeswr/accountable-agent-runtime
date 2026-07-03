// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// Regression for the roborev finding that parseTurtle dropped baseIRI: relative IRIs
// in a Solid resource must resolve against the resource's own URL.

import type { Quad } from "@rdfjs/types";
import { describe, expect, it } from "vitest";
import { parseTurtle } from "../src/rdf.js";

describe("parseTurtle baseIRI", () => {
  it("resolves relative IRIs against the supplied resource URL", async () => {
    const body = '<> <http://schema.org/name> "local" .\n<#it> a <http://schema.org/Thing> .';
    const dataset = await parseTurtle(body, "text/turtle", "https://pod.example/doc.ttl");
    const subjects = new Set([...(dataset as Iterable<Quad>)].map((q) => q.subject.value));
    expect(subjects).toContain("https://pod.example/doc.ttl");
    expect(subjects).toContain("https://pod.example/doc.ttl#it");
  });
});
