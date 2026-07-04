// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T5 unit suite — the LDN carrier's FAIL-CLOSED receiver rules + envelope codec + inbox
// discovery + post, exhaustively, with FAKE fetches (no server). This is the SSRF security
// core: a hostile envelope, a cross-origin object IRI, an out-of-origin inbox, a redirect on
// a credentialed post — every one must fail closed. The AAR_IT integration suite exercises
// the same code against a live CSS; these pin the rules deterministically.

import { describe, expect, it } from "vitest";
import {
  AS2_CONTEXT,
  buildEnvelope,
  dereferenceAnnouncedObject,
  discoverInbox,
  LdnError,
  parseNotification,
  postNotification,
  readInbox,
} from "../src/live/ldn.js";

const AGENT_A = "https://a.example/profile/card#me";
const AGENT_R = "https://r.example/profile/card#me";
const R_ORIGIN = "https://r.example";
const A_ORIGIN = "https://a.example";

/** A fake fetch backed by a `${METHOD} ${url}` → Response-spec map (404 on a miss). */
function fakeFetch(
  routes: Record<
    string,
    { status: number; body?: string; contentType?: string; location?: string }
  >,
): typeof globalThis.fetch {
  return (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url =
      typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method ?? "GET").toUpperCase();
    const route = routes[`${method} ${url}`] ?? routes[url];
    if (route === undefined) {
      return new Response("not found", { status: 404 });
    }
    const headers: Record<string, string> = {};
    if (route.contentType !== undefined) {
      headers["content-type"] = route.contentType;
    }
    if (route.location !== undefined) {
      headers.location = route.location;
    }
    return new Response(route.body ?? "", { status: route.status, headers });
  }) as typeof globalThis.fetch;
}

/** An AS2 notification body (JSON string). */
function envelope(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    "@context": AS2_CONTEXT,
    type: "Announce",
    actor: AGENT_R,
    target: "https://alice.example/e1/",
    object: { id: `${R_ORIGIN}/e1/activities/act-1.ttl`, type: "prov:Activity" },
    published: "2026-08-01T00:00:00Z",
    ...overrides,
  });
}

describe("buildEnvelope", () => {
  it("stamps the AS2 context + defaults published", () => {
    const env = buildEnvelope({
      type: "Offer",
      actor: AGENT_A,
      target: "https://x/",
      object: { kind: "o" },
    });
    expect(env["@context"]).toBe(AS2_CONTEXT);
    expect(env.type).toBe("Offer");
    expect(env.published).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(env.inReplyTo).toBeUndefined();
  });
  it("threads inReplyTo when given", () => {
    const env = buildEnvelope({
      type: "Accept",
      actor: AGENT_R,
      target: "https://x/",
      object: "https://x/o",
      inReplyTo: "https://a.example/inbox/1",
    });
    expect(env.inReplyTo).toBe("https://a.example/inbox/1");
  });
});

describe("parseNotification — fail-closed receiver rules", () => {
  const id = `${R_ORIGIN}/inbox/n1`;
  const originsOfA = [A_ORIGIN];
  const originsOfR = [R_ORIGIN];

  it("accepts a well-formed Announce with an in-origin object IRI", () => {
    const n = parseNotification(id, envelope(), originsOfR);
    expect(n).toBeDefined();
    expect(n?.type).toBe("Announce");
    expect(n?.objectIri).toBe(`${R_ORIGIN}/e1/activities/act-1.ttl`);
    expect(n?.actor).toBe(AGENT_R);
  });

  it("accepts a handshake payload (object with no id) as an opaque payload", () => {
    const n = parseNotification(
      id,
      envelope({ type: "Offer", object: { kind: "upgrade-offer", protocolHash: "h" } }),
      originsOfR,
    );
    expect(n?.payload).toEqual({ kind: "upgrade-offer", protocolHash: "h" });
    expect(n?.objectIri).toBeUndefined();
  });

  it("DROPS malformed JSON", () => {
    expect(parseNotification(id, "{not json", originsOfR)).toBeUndefined();
  });

  it("DROPS a missing / wrong @context", () => {
    expect(parseNotification(id, JSON.stringify({ type: "Announce" }), originsOfR)).toBeUndefined();
    expect(
      parseNotification(id, envelope({ "@context": "https://evil.example/ns" }), originsOfR),
    ).toBeUndefined();
  });

  it("DROPS an unknown type", () => {
    expect(parseNotification(id, envelope({ type: "Delete" }), originsOfR)).toBeUndefined();
    expect(parseNotification(id, envelope({ type: 42 }), originsOfR)).toBeUndefined();
  });

  it("DROPS an OUT-OF-ORIGIN object IRI (the whole notification, fail-closed)", () => {
    // The object claims r.example's origin, but only a.example is allowed here.
    expect(parseNotification(id, envelope(), originsOfA)).toBeUndefined();
    // A string object IRI pointing at a third origin is likewise dropped.
    expect(
      parseNotification(id, envelope({ object: "https://evil.example/x" }), originsOfR),
    ).toBeUndefined();
  });

  it("DROPS a malformed object IRI", () => {
    expect(
      parseNotification(id, envelope({ object: { id: "::not a url" } }), originsOfR),
    ).toBeUndefined();
  });

  it("treats actor as advisory (a non-string actor is simply ignored)", () => {
    const n = parseNotification(id, envelope({ actor: 12345 }), originsOfR);
    expect(n).toBeDefined();
    expect(n?.actor).toBeUndefined();
  });

  it("accepts an accepted @context array containing AS2", () => {
    const n = parseNotification(
      id,
      envelope({ "@context": ["https://x/", AS2_CONTEXT] }),
      originsOfR,
    );
    expect(n).toBeDefined();
  });
});

describe("discoverInbox — origin-bound WebID inbox", () => {
  const webIdDoc = (inbox: string): string =>
    `@prefix ldp: <http://www.w3.org/ns/ldp#> .\n<${AGENT_R}> ldp:inbox <${inbox}> .`;

  it("resolves an in-origin ldp:inbox", async () => {
    const fetch = fakeFetch({
      [`https://r.example/profile/card`]: {
        status: 200,
        body: webIdDoc(`${R_ORIGIN}/inbox/`),
        contentType: "text/turtle",
      },
    });
    expect(await discoverInbox(fetch, AGENT_R)).toBe(`${R_ORIGIN}/inbox/`);
  });

  it("REFUSES an out-of-origin ldp:inbox", async () => {
    const fetch = fakeFetch({
      [`https://r.example/profile/card`]: {
        status: 200,
        body: webIdDoc("https://evil.example/inbox/"),
        contentType: "text/turtle",
      },
    });
    await expect(discoverInbox(fetch, AGENT_R)).rejects.toBeInstanceOf(LdnError);
  });

  it("REFUSES a WebID document with no ldp:inbox", async () => {
    const fetch = fakeFetch({
      [`https://r.example/profile/card`]: {
        status: 200,
        body: `<${AGENT_R}> <http://xmlns.com/foaf/0.1/name> "R" .`,
        contentType: "text/turtle",
      },
    });
    await expect(discoverInbox(fetch, AGENT_R)).rejects.toBeInstanceOf(LdnError);
  });

  it("REFUSES a redirect on the WebID fetch", async () => {
    const fetch = fakeFetch({
      [`https://r.example/profile/card`]: { status: 302, location: "https://evil.example/" },
    });
    await expect(discoverInbox(fetch, AGENT_R)).rejects.toBeInstanceOf(LdnError);
  });
});

describe("postNotification", () => {
  const inbox = `${R_ORIGIN}/inbox/`;
  const env = buildEnvelope({
    type: "Offer",
    actor: AGENT_A,
    target: "https://x/",
    object: { kind: "o" },
  });

  it("posts + returns the in-inbox Location", async () => {
    const fetch = fakeFetch({
      [`POST ${inbox}`]: { status: 201, location: `${inbox}n-42` },
    });
    expect(await postNotification({ fetch, inbox, envelope: env })).toBe(`${inbox}n-42`);
  });

  it("REFUSES a redirect on the credentialed POST", async () => {
    const fetch = fakeFetch({ [`POST ${inbox}`]: { status: 307, location: "https://evil/" } });
    await expect(postNotification({ fetch, inbox, envelope: env })).rejects.toBeInstanceOf(
      LdnError,
    );
  });

  it("REFUSES an out-of-inbox Location", async () => {
    const fetch = fakeFetch({
      [`POST ${inbox}`]: { status: 201, location: "https://evil.example/x" },
    });
    await expect(postNotification({ fetch, inbox, envelope: env })).rejects.toBeInstanceOf(
      LdnError,
    );
  });

  it("throws on a non-2xx", async () => {
    const fetch = fakeFetch({ [`POST ${inbox}`]: { status: 403 } });
    await expect(postNotification({ fetch, inbox, envelope: env })).rejects.toBeInstanceOf(
      LdnError,
    );
  });
});

describe("readInbox", () => {
  const inbox = `${R_ORIGIN}/inbox/`;
  const listing = `@prefix ldp: <http://www.w3.org/ns/ldp#> .
<${inbox}> a ldp:Container ; ldp:contains <${inbox}n1>, <${inbox}n2>, <https://evil.example/x> .`;

  it("lists + filters: keeps the valid notification, drops the malformed one + the out-of-container child", async () => {
    const fetch = fakeFetch({
      [`GET ${inbox}`]: { status: 200, body: listing, contentType: "text/turtle" },
      [`GET ${inbox}n1`]: { status: 200, body: envelope(), contentType: "application/ld+json" },
      [`GET ${inbox}n2`]: { status: 200, body: "{bad json", contentType: "application/ld+json" },
    });
    const notes = await readInbox({ fetch, inbox, allowedObjectOrigins: [R_ORIGIN] });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.id).toBe(`${inbox}n1`);
  });

  it("returns [] when the inbox 404s", async () => {
    const fetch = fakeFetch({});
    expect(await readInbox({ fetch, inbox, allowedObjectOrigins: [R_ORIGIN] })).toEqual([]);
  });

  it("a child that REDIRECTS is skipped, not fatal — the valid notification still returns", async () => {
    const twoChildren = `@prefix ldp: <http://www.w3.org/ns/ldp#> .
<${inbox}> a ldp:Container ; ldp:contains <${inbox}n1>, <${inbox}bad> .`;
    const fetch = fakeFetch({
      [`GET ${inbox}`]: { status: 200, body: twoChildren, contentType: "text/turtle" },
      [`GET ${inbox}n1`]: { status: 200, body: envelope(), contentType: "application/ld+json" },
      [`GET ${inbox}bad`]: { status: 302, location: "https://evil.example/" },
    });
    const notes = await readInbox({ fetch, inbox, allowedObjectOrigins: [R_ORIGIN] });
    expect(notes).toHaveLength(1);
    expect(notes[0]?.id).toBe(`${inbox}n1`);
  });
});

describe("dereferenceAnnouncedObject", () => {
  it("fetches an in-origin object", async () => {
    const url = `${R_ORIGIN}/e1/activities/act-1.ttl`;
    const fetch = fakeFetch({
      [`GET ${url}`]: { status: 200, body: "<#a> <p> <o> .", contentType: "text/turtle" },
    });
    const got = await dereferenceAnnouncedObject(fetch, url, [R_ORIGIN]);
    expect(got?.body).toContain("<o>");
  });

  it("REFUSES (returns undefined for) an out-of-origin object without fetching", async () => {
    let called = false;
    const fetch = (async () => {
      called = true;
      return new Response("", { status: 200 });
    }) as typeof globalThis.fetch;
    const got = await dereferenceAnnouncedObject(fetch, "https://evil.example/x", [R_ORIGIN]);
    expect(got).toBeUndefined();
    expect(called).toBe(false);
  });
});
