// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T2 — the live substrate seeder (design §4.2 [2], §1.4). Boots (or targets) a Solid
// server, provisions the four accounts, opens per-actor DPoP sessions, and lays down every
// document + ACL the §4 scenario and the auditor need:
//   • profiles (name / oidcIssuer / storage / inbox) with each actor's assertion-method key
//     co-located in the WebID document (`publishVerificationMethod`);
//   • the institute→agent-r AGENT POINTER + agent-r's ANP self-description;
//   • Alice's records + her SIGNED Bitstring Status List (G2);
//   • the institute's hash-pinned Protocol Document;
//   • all four LDN inboxes and the two engagement trace containers;
//   • EVERY ACL, via `@solid/object` typed accessors (never a hand-built triple), owner-
//     control fail-closed, with the §1.4 DISJOINT write delegations — agent A may write ONLY
//     Alice's trace copy, agent R ONLY the institute's mirror; neither can touch the other's
//     (asserted by the cross-write 403 tests). That disjointness is what makes a mirrored-
//     trace divergence evidential.
//
// All RDF is produced through the sanctioned path (`GraphBuilder` / package serialisers /
// `n3.Writer`) and parsed through `@jeswr/fetch-rdf`; credentials never touch logs or disk.

import { buildAgentPointer, describeAgent } from "@jeswr/solid-agent-card";
import {
  buildBitstringStatusListCredential,
  generateKeyPairForSuite,
  issue,
  type KeyPair,
  publishVerificationMethod,
} from "@jeswr/solid-vc";
import type { Quad } from "@rdfjs/types";
import { GraphBuilder, parseTurtle, serializeTurtle } from "../rdf.js";
import { buildRuntimeProtocolDocument } from "../scenario/protocol.js";
import { type SeededAccount, seedAccount } from "./account.js";
import { type AclRule, buildAclDocument, ownerRule } from "./acl.js";
import { type ActorSession, createActorSessions } from "./auth.js";
import {
  actorBasesFor,
  buildCast,
  type LiveActor,
  type LiveActorId,
  type LiveCast,
  VALID_FROM,
  VALID_UNTIL,
} from "./cast.js";
import { type BootCssOptions, bootCss, type CssServer } from "./css.js";
import { createDiscoveryFetch } from "./fetch.js";
import { LivePod } from "./pod.js";

// --- vocabulary (predicate/class IRIs used in the profile documents) --------
const FOAF = "http://xmlns.com/foaf/0.1/";
const SOLID_OIDC_ISSUER = "http://www.w3.org/ns/solid/terms#oidcIssuer";
const PIM_STORAGE = "http://www.w3.org/ns/pim/space#storage";
const LDP_INBOX = "http://www.w3.org/ns/ldp#inbox";

/** The fully-seeded live substrate the tests / harness consume. */
export interface LiveSubstrate {
  /** The server root. */
  readonly base: string;
  /** The parameterised live cast. */
  readonly cast: LiveCast;
  /** The provisioned accounts (credentials in memory only). */
  readonly accounts: Readonly<Record<LiveActorId, SeededAccount>>;
  /** The per-actor DPoP sessions (redirect-refusing authed fetch each). */
  readonly sessions: Readonly<Record<LiveActorId, ActorSession>>;
  /** The generated signing keypairs (test material — lets variant tests re-sign). */
  readonly actorKeys: Readonly<Record<LiveActorId, KeyPair>>;
  /** The zero-credential loopback guarded fetch (discovery / auditor reads). */
  readonly discoveryFetch: typeof globalThis.fetch;
  /** The CSS child (absent when targeting an external `--base`). */
  readonly css?: CssServer;
  /** Tear down (kill CSS if we booted it). Idempotent. */
  stop(): Promise<void>;
}

/** Options for {@link seedDemo}. */
export interface SeedOptions {
  /** Target an already-running server instead of booting CSS. */
  readonly base?: string;
  /** Leave a booted CSS up after `stop()` (debugging). */
  readonly keep?: boolean;
  /** CSS boot options (ignored when `base` is given). */
  readonly bootOptions?: BootCssOptions;
}

/** Build a profile document (WebID triples + co-located key + any extra quads). */
async function profileTurtle(
  actor: LiveActor,
  name: string,
  serverBase: string,
  key: KeyPair,
  extra: readonly Quad[],
): Promise<string> {
  const graph = new GraphBuilder();
  graph.addType(actor.profileDoc, `${FOAF}PersonalProfileDocument`);
  graph.addIri(actor.profileDoc, `${FOAF}maker`, actor.webId);
  graph.addIri(actor.profileDoc, `${FOAF}primaryTopic`, actor.webId);
  graph.addType(actor.webId, `${FOAF}Person`);
  graph.addLiteral(actor.webId, `${FOAF}name`, name);
  graph.addIri(actor.webId, SOLID_OIDC_ISSUER, serverBase);
  graph.addIri(actor.webId, PIM_STORAGE, actor.podRoot);
  graph.addIri(actor.webId, LDP_INBOX, actor.inbox);
  // Co-locate the verification method in the WebID document (keyVm = <profileDoc>#key), so
  // the WebID-document key resolver reads controller-listing + key material from one doc.
  const published = await publishVerificationMethod({ controller: actor.webId, key });
  return serializeTurtle([...graph.quads(), ...published.quads, ...extra]);
}

/** Overwrite an actor's (bare CSS) profile card with the fully-seeded document. */
async function seedProfile(
  pod: LivePod,
  actor: LiveActor,
  name: string,
  serverBase: string,
  key: KeyPair,
  extra: readonly Quad[],
): Promise<void> {
  const body = await profileTurtle(actor, name, serverBase, key, extra);
  // GET first so LivePod tracks the ETag and overwrites the bare card with If-Match.
  await pod.get(actor.profileDoc);
  await pod.put(actor.profileDoc, body, "text/turtle");
}

/** Write a resource's ACL (discovered via `Link rel="acl"`) from typed rules. */
async function writeAcl(
  ownerPod: LivePod,
  resource: string,
  rules: readonly AclRule[],
): Promise<void> {
  const aclUrl = await ownerPod.aclFor(resource);
  const body = await buildAclDocument(aclUrl, rules);
  // CSS auto-provisions a DEFAULT ACL for some resources (notably the profile card), so the
  // ACL may pre-exist. GET first to record its ETag: LivePod then overwrites with If-Match
  // (existing) or creates with If-None-Match:* (absent). We REPLACE the default with our
  // owner-control-fail-closed rules — never merge.
  await ownerPod.get(aclUrl);
  await ownerPod.put(aclUrl, body, "text/turtle");
}

/** A public-read rule for a resource/container (owner keeps control via {@link ownerRule}). */
function publicReadRule(resource: string, isContainer: boolean): AclRule {
  return {
    name: "public-read",
    accessTo: resource,
    ...(isContainer ? { default: resource } : {}),
    publicAccess: true,
    modes: { read: true },
  };
}

/** A delegate rule granting `modes` to `agents` on a container (accessTo + default, no control). */
function delegateRule(
  name: string,
  agents: readonly string[],
  container: string,
  modes: AclRule["modes"],
): AclRule {
  return { name, accessTo: container, default: container, agents: [...agents], modes };
}

/**
 * Seed the full live substrate. Returns the substrate handle; on any failure it tears the
 * server down (unless `keep`) and rethrows.
 */
export async function seedDemo(options: SeedOptions = {}): Promise<LiveSubstrate> {
  let css: CssServer | undefined;
  let base = options.base;
  if (base === undefined) {
    css = await bootCss(options.bootOptions);
    base = css.base;
  }
  const serverBase = base.endsWith("/") ? base : `${base}/`;

  const stop = async (): Promise<void> => {
    if (css !== undefined && options.keep !== true) {
      await css.stop();
    }
  };

  try {
    const cast = buildCast(actorBasesFor(base));

    // --- accounts ---------------------------------------------------------
    const accounts: Record<LiveActorId, SeededAccount> = {
      alice: await seedAccount(base, "alice", { webId: cast.alice.webId }),
      agentA: await seedAccount(base, "agent-a", { webId: cast.agentA.webId }),
      institute: await seedAccount(base, "institute", { webId: cast.institute.webId }),
      agentR: await seedAccount(base, "agent-r", { webId: cast.agentR.webId }),
    };

    // --- sessions ---------------------------------------------------------
    const sessions = await createActorSessions<LiveActorId>({
      alice: { webId: accounts.alice.webId, credentials: accounts.alice.credentials },
      agentA: { webId: accounts.agentA.webId, credentials: accounts.agentA.credentials },
      institute: { webId: accounts.institute.webId, credentials: accounts.institute.credentials },
      agentR: { webId: accounts.agentR.webId, credentials: accounts.agentR.credentials },
    });

    // --- owner-scoped LivePods (for seeding each pod) ---------------------
    const alicePod = new LivePod({ fetch: sessions.alice.fetch, base: cast.alice.podRoot });
    const agentAPod = new LivePod({ fetch: sessions.agentA.fetch, base: cast.agentA.podRoot });
    const institutePod = new LivePod({
      fetch: sessions.institute.fetch,
      base: cast.institute.podRoot,
    });
    const agentRPod = new LivePod({ fetch: sessions.agentR.fetch, base: cast.agentR.podRoot });

    // --- keys -------------------------------------------------------------
    const actorKeys: Record<LiveActorId, KeyPair> = {
      alice: await generateKeyPairForSuite(cast.alice.keyVm, "Ed25519"),
      agentA: await generateKeyPairForSuite(cast.agentA.keyVm, "Ed25519"),
      institute: await generateKeyPairForSuite(cast.institute.keyVm, "Ed25519"),
      agentR: await generateKeyPairForSuite(cast.agentR.keyVm, "Ed25519"),
    };

    // --- profiles + keys (+ pointer / ANP) --------------------------------
    // institute → agent-r pointer, merged into the institute profile document.
    const pointer = buildAgentPointer(cast.institute.webId, cast.agentR.webId);
    const pointerQuads = [
      ...(await parseTurtle(await pointer.toString(), "text/turtle", cast.institute.profileDoc)),
    ] as Quad[];
    // agent-r ANP self-description, merged into the agent-r profile document.
    const { agentDescription } = describeAgent({
      id: cast.agentR.webId,
      name: "Institute research agent",
      owner: cast.institute.webId,
      url: cast.agentR.profileDoc,
      securitySchemes: [{ type: "solid-oidc", issuer: serverBase }],
      protocolSources: [cast.institute.protocolDocUrl],
      skills: [{ id: "negotiate-data-sharing", name: "Negotiate data sharing" }],
    });
    const anpQuads = [
      ...(await parseTurtle(
        await agentDescription.toTurtle(),
        "text/turtle",
        cast.agentR.profileDoc,
      )),
    ] as Quad[];

    await seedProfile(alicePod, cast.alice, "Alice", serverBase, actorKeys.alice, []);
    await seedProfile(agentAPod, cast.agentA, "Agent A", serverBase, actorKeys.agentA, []);
    await seedProfile(
      institutePod,
      cast.institute,
      "Institute",
      serverBase,
      actorKeys.institute,
      pointerQuads,
    );
    await seedProfile(
      agentRPod,
      cast.agentR,
      "Institute research agent",
      serverBase,
      actorKeys.agentR,
      anpQuads,
    );

    // Public-read + owner-control on every WebID document (a WebID must dereference).
    await writeAcl(alicePod, cast.alice.profileDoc, [
      ownerRule(cast.alice.webId, cast.alice.profileDoc, false),
      publicReadRule(cast.alice.profileDoc, false),
    ]);
    await writeAcl(agentAPod, cast.agentA.profileDoc, [
      ownerRule(cast.agentA.webId, cast.agentA.profileDoc, false),
      publicReadRule(cast.agentA.profileDoc, false),
    ]);
    await writeAcl(institutePod, cast.institute.profileDoc, [
      ownerRule(cast.institute.webId, cast.institute.profileDoc, false),
      publicReadRule(cast.institute.profileDoc, false),
    ]);
    await writeAcl(agentRPod, cast.agentR.profileDoc, [
      ownerRule(cast.agentR.webId, cast.agentR.profileDoc, false),
      publicReadRule(cast.agentR.profileDoc, false),
    ]);

    // --- Alice's records (owner-only until the WAC grant in T4) -----------
    const records = new GraphBuilder();
    records.addType(cast.alice.records, "http://schema.org/Dataset");
    records.addLiteral(cast.alice.records, "http://purl.org/dc/terms/title", "Selected records");
    await alicePod.ensureContainer(cast.alice.dataContainer);
    await alicePod.put(cast.alice.records, await serializeTurtle(records.quads()), "text/turtle");
    await writeAcl(alicePod, cast.alice.records, [
      ownerRule(cast.alice.webId, cast.alice.records, false),
    ]);

    // --- Alice's signed Bitstring Status List (public read) ---------------
    const statusList = await issue({
      credential: buildBitstringStatusListCredential({
        id: cast.alice.statusListUrl,
        issuer: cast.alice.webId,
        statusPurpose: "revocation",
        validFrom: VALID_FROM,
        validUntil: VALID_UNTIL,
      }),
      key: actorKeys.alice,
    });
    await alicePod.ensureContainer(`${cast.alice.podRoot}status/`);
    await alicePod.put(cast.alice.statusListUrl, JSON.stringify(statusList), "application/ld+json");
    await writeAcl(alicePod, cast.alice.statusListUrl, [
      ownerRule(cast.alice.webId, cast.alice.statusListUrl, false),
      publicReadRule(cast.alice.statusListUrl, false),
    ]);

    // --- the institute's hash-pinned Protocol Document (public read) ------
    const pd = await buildRuntimeProtocolDocument();
    await institutePod.ensureContainer(`${cast.institute.podRoot}protocols/`);
    await institutePod.put(cast.institute.protocolDocUrl, await pd.toTurtle(), "text/turtle");
    await writeAcl(institutePod, cast.institute.protocolDocUrl, [
      ownerRule(cast.institute.webId, cast.institute.protocolDocUrl, false),
      publicReadRule(cast.institute.protocolDocUrl, false),
    ]);

    // --- inboxes ----------------------------------------------------------
    await alicePod.ensureContainer(cast.alice.inbox);
    await writeAcl(alicePod, cast.alice.inbox, [
      ownerRule(cast.alice.webId, cast.alice.inbox, true),
      // Alice's delegated inbox processor reads (mirrors into the trace) but cannot edit it.
      delegateRule("processor", [cast.agentA.webId], cast.alice.inbox, { read: true }),
      // The one sender (agent R) may only append notifications.
      delegateRule("sender", [cast.agentR.webId], cast.alice.inbox, { append: true }),
    ]);
    await institutePod.ensureContainer(cast.institute.inbox);
    await writeAcl(institutePod, cast.institute.inbox, [
      ownerRule(cast.institute.webId, cast.institute.inbox, true),
      delegateRule("sender", [cast.agentA.webId], cast.institute.inbox, { append: true }),
    ]);
    await agentAPod.ensureContainer(cast.agentA.inbox);
    await writeAcl(agentAPod, cast.agentA.inbox, [
      ownerRule(cast.agentA.webId, cast.agentA.inbox, true),
      delegateRule("sender", [cast.agentR.webId], cast.agentA.inbox, { append: true }),
    ]);
    await agentRPod.ensureContainer(cast.agentR.inbox);
    await writeAcl(agentRPod, cast.agentR.inbox, [
      ownerRule(cast.agentR.webId, cast.agentR.inbox, true),
      delegateRule("sender", [cast.agentA.webId], cast.agentR.inbox, { append: true }),
    ]);

    // --- engagement trace containers with DISJOINT write delegations ------
    // Alice's copy: agent A writes (accessTo + default), never control; public read.
    await alicePod.ensureContainer(cast.alice.engagementBase);
    await writeAcl(alicePod, cast.alice.engagementBase, [
      ownerRule(cast.alice.webId, cast.alice.engagementBase, true),
      publicReadRule(cast.alice.engagementBase, true),
      delegateRule("delegate-writer", [cast.agentA.webId], cast.alice.engagementBase, {
        write: true,
      }),
    ]);
    // The institute's mirror: agent R writes (accessTo + default), never control; public read.
    await institutePod.ensureContainer(cast.institute.mirrorBase);
    await writeAcl(institutePod, cast.institute.mirrorBase, [
      ownerRule(cast.institute.webId, cast.institute.mirrorBase, true),
      publicReadRule(cast.institute.mirrorBase, true),
      delegateRule("delegate-writer", [cast.agentR.webId], cast.institute.mirrorBase, {
        write: true,
      }),
    ]);

    return {
      base,
      cast,
      accounts,
      sessions,
      actorKeys,
      discoveryFetch: createDiscoveryFetch(base),
      ...(css !== undefined ? { css } : {}),
      stop,
    } as LiveSubstrate;
  } catch (error) {
    await stop();
    throw error;
  }
}
