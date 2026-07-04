// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// Hermetic unit tests for the Wave-1 live-substrate PURE logic — the security-critical
// bits that need no server: the loopback transport gate, the ACL builder (typed accessors),
// the `Link rel="acl"` parser, and the ancestor-container derivation. The live round-trips
// + the cross-write 403 assertions live in the AAR_IT-gated integration suite.

import { SsrfError } from "@jeswr/guarded-fetch";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  actorBasesFor,
  ancestorContainers,
  assertBaseTransport,
  buildAclDocument,
  buildCast,
  createActorSession,
  createDiscoveryFetch,
  createInteractiveActorSession,
  isLoopbackBase,
  isLoopbackHost,
  ownerRule,
  parentContainer,
  parseAclLink,
  seedAccount,
} from "../src/live/index.js";

describe("loopback transport gate", () => {
  it("classifies loopback names and literals", () => {
    for (const host of ["localhost", "LOCALHOST", "sub.localhost", "127.0.0.1", "127.1", "::1"]) {
      expect(isLoopbackHost(host)).toBe(true);
    }
    for (const host of ["example.com", "10.0.0.1", "169.254.169.254", "8.8.8.8", "solid.example"]) {
      expect(isLoopbackHost(host)).toBe(false);
    }
  });

  it("isLoopbackBase is fail-closed on garbage", () => {
    expect(isLoopbackBase("http://localhost:3000")).toBe(true);
    expect(isLoopbackBase("http://127.0.0.1:41234/")).toBe(true);
    expect(isLoopbackBase("https://pod.example.com")).toBe(false);
    expect(isLoopbackBase("not a url")).toBe(false);
    expect(isLoopbackBase("")).toBe(false);
  });

  it("assertBaseTransport permits https-public and http-loopback, refuses the dangerous cases", () => {
    expect(assertBaseTransport("http://localhost:3000")).toEqual({ loopback: true });
    expect(assertBaseTransport("https://pod.example.com")).toEqual({ loopback: false });
    // plaintext to a public host — the hatch is loopback-only.
    expect(() => assertBaseTransport("http://pod.example.com")).toThrow(SsrfError);
    // non-http(s) scheme.
    expect(() => assertBaseTransport("ftp://localhost")).toThrow(SsrfError);
    // malformed.
    expect(() => assertBaseTransport("://nope")).toThrow(SsrfError);
  });

  it("createDiscoveryFetch enables the hatch only for a loopback base", () => {
    expect(typeof createDiscoveryFetch("http://localhost:3000")).toBe("function");
    expect(typeof createDiscoveryFetch("https://pod.example.com")).toBe("function");
    // a non-loopback http base is refused up front (never a silently-widened hatch).
    expect(() => createDiscoveryFetch("http://pod.example.com")).toThrow(SsrfError);
  });

  it("createDiscoveryFetch is DNS-PINNED: a rebinding resolution to a private address is refused", async () => {
    // Opus review: the discovery fetch must reject with SsrfError BEFORE connecting when the
    // (injected) DNS resolution yields a private/metadata address — proving it uses the node
    // DNS-pinning guard's validating lookup, not a classify-then-fetch-by-hostname path that
    // a rebinding attacker could slip. `resolveAll` is the node guard's sole resolver seam.
    const discovery = createDiscoveryFetch("https://pod.example.com", {
      resolveAll: async () => [{ address: "169.254.169.254", family: 4 }],
    });
    await expect(discovery("https://pod.example.com/agent-card.json")).rejects.toBeInstanceOf(
      SsrfError,
    );
  });
});

describe("parseAclLink", () => {
  it("extracts the acl relation target (quoted, bare, multi-rel, multi-link)", () => {
    expect(parseAclLink('<records.ttl.acl>; rel="acl"')).toBe("records.ttl.acl");
    expect(parseAclLink("<x.acl>; rel=acl")).toBe("x.acl");
    expect(parseAclLink('<a>; rel="type", <records.ttl.acl>; rel="acl"')).toBe("records.ttl.acl");
    expect(parseAclLink('<abs.acl>; rel="acl describedby"')).toBe("abs.acl");
  });

  it("returns undefined when there is no acl relation", () => {
    expect(parseAclLink('<x>; rel="type"')).toBeUndefined();
    expect(parseAclLink("garbage")).toBeUndefined();
    expect(parseAclLink("")).toBeUndefined();
  });
});

describe("credentialed setup paths fail closed on a plaintext-public base (roborev High)", () => {
  it("seedAccount refuses http-to-public BEFORE any account/password POST", async () => {
    // Throws synchronously from the transport gate — no network request is ever issued.
    await expect(seedAccount("http://pod.example.com", "alice")).rejects.toBeInstanceOf(SsrfError);
  });

  it("createActorSession refuses a non-loopback http: issuer BEFORE the token exchange", async () => {
    await expect(
      createActorSession({
        webId: "http://pod.example.com/alice/profile/card#me",
        credentials: { issuer: "http://pod.example.com/", id: "id", secret: "sh" },
      }),
    ).rejects.toBeInstanceOf(SsrfError);
  });

  it("permits an https-public base/issuer at the transport gate (network then handles it)", () => {
    // The gate itself must NOT reject https — only the (absent) server would.
    expect(assertBaseTransport("https://pod.example.com")).toEqual({ loopback: false });
  });
});

describe("seedAccount origin-pins server-supplied control URLs (Opus review, credential exfil)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("refuses to POST the generated password to a FOREIGN-origin control URL", async () => {
    // A hostile/misconfigured target answers /.account/ with control URLs pointing at a THIRD
    // origin. seedAccount must refuse BEFORE POSTing the password/credential-minting request
    // there — otherwise the freshly-generated secret is exfiltrated to the attacker.
    const passwordPosts: string[] = [];
    vi.spyOn(globalThis, "fetch").mockImplementation((async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/.account/account/")) {
        return new Response("{}", { status: 200, headers: { "set-cookie": "css=abc; Path=/" } });
      }
      if (url.endsWith("/.account/")) {
        return new Response(
          JSON.stringify({
            controls: {
              password: { create: "https://evil.example/steal-password" },
              account: {
                pod: "https://pod.example.com/.account/pod/",
                clientCredentials: "https://pod.example.com/.account/cc/",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      passwordPosts.push(url);
      return new Response("{}", { status: 200 });
    }) as typeof globalThis.fetch);

    await expect(seedAccount("https://pod.example.com", "alice")).rejects.toBeInstanceOf(SsrfError);
    // The password/credential POST to the foreign origin must NEVER have been issued.
    expect(passwordPosts).not.toContain("https://evil.example/steal-password");
  });

  it("permits same-origin control URLs through the origin pin", async () => {
    // Same-origin controls pass the pin; a downstream stub then completes the flow.
    vi.spyOn(globalThis, "fetch").mockImplementation((async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url.endsWith("/.account/account/")) {
        return new Response("{}", { status: 200, headers: { "set-cookie": "css=abc; Path=/" } });
      }
      if (url.endsWith("/.account/")) {
        return new Response(
          JSON.stringify({
            controls: {
              password: { create: "https://pod.example.com/.account/password/" },
              account: {
                pod: "https://pod.example.com/.account/pod/",
                clientCredentials: "https://pod.example.com/.account/cc/",
              },
            },
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (url.endsWith("/cc/")) {
        return new Response(JSON.stringify({ id: "the-id", secret: "the-secret" }), {
          status: 200,
        });
      }
      return new Response("{}", { status: 200 });
    }) as typeof globalThis.fetch);

    const account = await seedAccount("https://pod.example.com", "alice");
    expect(account.credentials.id).toBe("the-id");
    expect(account.credentials.issuer).toBe("https://pod.example.com/");
  });
});

describe("parentContainer", () => {
  it("returns the holding container of a resource or a container", () => {
    expect(parentContainer("https://p.example/a/b/x.ttl")).toBe("https://p.example/a/b/");
    expect(parentContainer("https://p.example/a/b/c/")).toBe("https://p.example/a/b/");
    expect(parentContainer("https://p.example/a/")).toBe("https://p.example/");
    // query/fragment are dropped.
    expect(parentContainer("https://p.example/a/x.ttl?q=1#f")).toBe("https://p.example/a/");
  });
});

describe("ancestorContainers", () => {
  it("returns the containers strictly under base, shallowest first", () => {
    expect(
      ancestorContainers("https://p.example/alice/", "https://p.example/alice/a/b/x.ttl"),
    ).toEqual(["https://p.example/alice/a/", "https://p.example/alice/a/b/"]);
  });
  it("a direct child has no intermediate ancestors", () => {
    expect(ancestorContainers("https://p.example/alice/", "https://p.example/alice/x.ttl")).toEqual(
      [],
    );
  });
  it("a target outside base yields nothing", () => {
    expect(ancestorContainers("https://p.example/alice/", "https://other.example/x.ttl")).toEqual(
      [],
    );
  });
});

describe("buildAclDocument (typed accessors)", () => {
  const acl = "https://p.example/alice/data/records.ttl.acl";

  it("writes owner control + public read + delegate write with the right modes", async () => {
    const ttl = await buildAclDocument(acl, [
      ownerRule("https://p.example/alice/profile/card#me", "https://p.example/alice/data/", true),
      {
        name: "public-read",
        accessTo: "https://p.example/alice/data/",
        default: "https://p.example/alice/data/",
        publicAccess: true,
        modes: { read: true },
      },
      {
        name: "delegate-writer",
        accessTo: "https://p.example/alice/data/",
        default: "https://p.example/alice/data/",
        agents: ["https://p.example/agent-a/profile/card#me"],
        modes: { write: true },
      },
    ]);
    // Every rule is a typed acl:Authorization.
    expect(ttl).toContain("http://www.w3.org/ns/auth/acl#Authorization");
    // Owner has Control; the delegate does NOT (the mirrored-trace integrity invariant).
    expect(ttl).toContain("#owner");
    expect(ttl).toContain("http://www.w3.org/ns/auth/acl#Control");
    expect(ttl).toContain("http://xmlns.com/foaf/0.1/Agent"); // public
    expect(ttl).toContain("https://p.example/agent-a/profile/card#me"); // delegate agent
  });

  it("owner rule carries Read+Write+Control; a delegate write rule never carries Control", async () => {
    const ownerOnly = await buildAclDocument(acl, [
      ownerRule("https://p.example/alice/profile/card#me", "https://p.example/x.ttl", false),
    ]);
    expect(ownerOnly).toContain("http://www.w3.org/ns/auth/acl#Control");

    const delegateOnly = await buildAclDocument(acl, [
      {
        name: "delegate-writer",
        accessTo: "https://p.example/e1/",
        default: "https://p.example/e1/",
        agents: ["https://p.example/agent-r/profile/card#me"],
        modes: { write: true },
      },
    ]);
    expect(delegateOnly).not.toContain("http://www.w3.org/ns/auth/acl#Control");
    expect(delegateOnly).toContain("http://www.w3.org/ns/auth/acl#Write");
  });

  it("rejects duplicate rule names (a seeding bug)", async () => {
    await expect(
      buildAclDocument(acl, [
        { name: "dup", accessTo: "https://p.example/x", modes: { read: true } },
        { name: "dup", accessTo: "https://p.example/y", modes: { read: true } },
      ]),
    ).rejects.toThrow(/duplicate/);
  });
});

describe("buildCast (parameterised)", () => {
  it("derives the live cast from a server base with disjoint pods", () => {
    const cast = buildCast(actorBasesFor("http://localhost:3000"));
    expect(cast.alice.webId).toBe("http://localhost:3000/alice/profile/card#me");
    expect(cast.agentR.webId).toBe("http://localhost:3000/agent-r/profile/card#me");
    expect(cast.alice.engagementBase).toBe("http://localhost:3000/alice/agents/engagements/e1/");
    expect(cast.institute.mirrorBase).toBe(
      "http://localhost:3000/institute/agents/engagements/e1/",
    );
    // the two engagement copies live under DIFFERENT pods (the disjoint-write premise).
    expect(new URL(cast.alice.engagementBase).pathname.startsWith("/alice/")).toBe(true);
    expect(new URL(cast.institute.mirrorBase).pathname.startsWith("/institute/")).toBe(true);
  });
});

describe("interactive auth seam", () => {
  it("is a labelled stub, not a silent no-op", () => {
    expect(() => createInteractiveActorSession()).toThrow(/not implemented/);
  });
});
