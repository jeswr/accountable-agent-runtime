// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T4 — the §4 scenario, LIVE (design §2, §4.2 [3]). The deterministic `scenario/run.ts` is
// UNCHANGED (its 58 golden masters still pin the byte-stable in-memory run); THIS is the
// additive live variant that runs the SAME flow — discover → LDN upgrade handshake →
// four-phase verify (live resolvers) → WAC grant → act → trace → announce — over the Wave-1
// live substrate (`LivePod` + per-actor DPoP sessions + the loopback guarded fetch).
//
// The security core made real here:
//   • WAC 403→200 — agent R's authed GET of Alice's records is asserted 403 BEFORE the grant
//     and 200 AFTER Alice materialises the `acl:Read` authorization (typed `@solid/object`
//     accessors, never a hand-built triple). The SERVER's own enforcement is the evidence.
//   • Disjoint mirrored traces (§2.5) — Alice's copy is written by agent A's delegated
//     session, the institute's mirror by agent R's; neither credential can write the other's
//     copy (the seeding's §1.4 grants + cross-write 403 tests guarantee it). That disjointness
//     is what makes a mirrored-trace divergence evidential.
//   • D9 identity composition — the acting agent R ≠ the leaf assignee (the institute), so the
//     verifier requires a SECOND verified chain (instAgentVc, institute → agent R).
//
// The auditor reads the INSTITUTE MIRROR (public-read); the canonical policy documents +
// credentials it dereferences are public on the pods their IRIs name. Every unauthenticated
// read (discovery, protocol pin, status list) is the loopback SSRF-guarded fetch.

import {
  type PresentedChain,
  type VerifyAuthorityResult,
  verifyAgentAuthority,
} from "@jeswr/agent-authz-verifier";
import {
  decodeUpgradeOffer,
  decodeUpgradeResponse,
  encodeUpgradeOffer,
  encodeUpgradeResponse,
  mayDowngradeToNl,
  parseIntent,
  validateIntent,
  verifyProtocolDocument,
} from "@jeswr/solid-a2a";
import { discoverAgent } from "@jeswr/solid-agent-card";
import type { VerifiableCredential } from "@jeswr/solid-vc";
import { bitstringStatusListEntry, issueAgentAuthorization } from "@jeswr/solid-vc";
import { type OdrlPolicy, policyToTurtle, requestContextFromA2AIntent } from "../odrl.js";
import { GraphBuilder, serializeTurtle } from "../rdf.js";
import { buildRuntimeProtocolDocument } from "../scenario/protocol.js";
import { writeActivity, writeDecision, writeEngagement } from "../trace/index.js";
import { PROV_WAS_GENERATED_BY } from "../vocab.js";
import { type AclRule, buildAclDocument, ownerRule } from "./acl.js";
import { VALID_FROM, VALID_UNTIL } from "./cast.js";
import { createDiscoveryFetch } from "./fetch.js";
import {
  buildEnvelope,
  dereferenceAnnouncedObject,
  discoverInbox,
  postNotification,
  readInbox,
} from "./ldn.js";
import { LivePod, LivePodError } from "./pod.js";
import { buildLiveAgreement, buildLiveInstituteInternal, buildLiveMandate } from "./policies.js";
import { liveKeyResolver, liveStatusResolver } from "./resolvers.js";
import type { LiveSubstrate } from "./seed.js";

/** A refusal at a live-scenario step (a fail-closed exit before authorization). */
export class LiveScenarioRefusal extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LiveScenarioRefusal";
  }
}

/** The notification IRIs the LDN carrier minted (transcript + assertions). */
export interface LdnTrace {
  /** Agent A's upgrade Offer in agent R's inbox. */
  readonly offer: string;
  /** Agent R's Accept in agent A's inbox. */
  readonly accept: string;
  /** Agent R's activity Announce in Alice's inbox. */
  readonly announce: string;
}

/** The full result of a live scenario run — everything the harness + auditor consume. */
export interface LiveRunResult {
  readonly now: Date;
  readonly cast: LiveSubstrate["cast"];
  /** The proven WAC transition — always `"403->200"` on the happy path (asserted). */
  readonly wacFlip: "403->200";
  /** The `.acl` resource Alice's grant landed on. */
  readonly aclResource: string;
  readonly protocolPinned: boolean;
  readonly handshakeAccepted: boolean;
  readonly intentConforms: boolean;
  readonly verification: VerifyAuthorityResult;
  readonly credentials: {
    readonly mandate: VerifiableCredential;
    readonly agreement: VerifiableCredential;
    readonly instituteAgent: VerifiableCredential;
  };
  /** The trace container the auditor reads (the institute's public-read mirror). */
  readonly auditTraceBase: string;
  /** Alice's own copy of the trace (the owner mirror, for divergence detection). */
  readonly aliceTraceBase: string;
  /** The derived artifact the auditor is handed. */
  readonly derivedArtifact: string;
  /** The action's PROV activity IRI (in the audited mirror). */
  readonly activityIri: string;
  /** The LDN notification IRIs minted along the way. */
  readonly ldn: LdnTrace;
}

/** Options for {@link runLiveScenario}. */
export interface RunLiveScenarioOptions {
  /** The single instant the run is evaluated at (default: within the grant window). */
  readonly now?: Date;
}

/** A read-only grant of `read` to `agent` on `resource` (never control — a scoped delegation). */
function readGrantRule(name: string, agent: string, resource: string): AclRule {
  return { name, accessTo: resource, agents: [agent], modes: { read: true } };
}

/** A public-read rule (owner keeps control via {@link ownerRule}). */
function publicReadRule(resource: string, isContainer: boolean): AclRule {
  return {
    name: "public-read",
    accessTo: resource,
    ...(isContainer ? { default: resource } : {}),
    publicAccess: true,
    modes: { read: true },
  };
}

/** GET a resource with an actor's LivePod, returning the HTTP status of a rejection. */
async function statusOfGet(pod: LivePod, url: string): Promise<number | "ok" | "missing"> {
  try {
    const got = await pod.get(url);
    return got === undefined ? "missing" : "ok";
  } catch (error) {
    if (error instanceof LivePodError && error.status !== undefined) {
      return error.status;
    }
    throw error;
  }
}

/**
 * Run the §4 scenario against a live seeded substrate. Throws {@link LiveScenarioRefusal} on
 * any fail-closed exit (discovery failure, protocol-pin mismatch, a denied verification, or a
 * WAC transition that does not flip 403→200).
 */
export async function runLiveScenario(
  substrate: LiveSubstrate,
  options: RunLiveScenarioOptions = {},
): Promise<LiveRunResult> {
  const now = options.now ?? new Date("2026-08-01T00:00:00.000Z");
  const { cast, sessions, actorKeys, base } = substrate;

  // Fresh zero-config discovery fetch + live resolvers (the exact production resolvers).
  const discoveryFetch = createDiscoveryFetch(base);
  const keyResolver = liveKeyResolver(discoveryFetch);
  const resolveStatus = liveStatusResolver(discoveryFetch, { now });

  // Actor pods (each bound to exactly the session acting AS that actor; §2.1).
  // Alice's copy is written by agent A (her delegated trace author); the institute mirror by
  // agent R. Neither credential can write the other's copy (§1.4 / §2.5).
  const aliceCopyPod = new LivePod({
    fetch: sessions.agentA.fetch,
    base: cast.alice.engagementBase,
  });
  const mirrorPod = new LivePod({ fetch: sessions.agentR.fetch, base: cast.institute.mirrorBase });
  const aliceOwnerPod = new LivePod({ fetch: sessions.alice.fetch, base: cast.alice.podRoot });
  const institutePod = new LivePod({
    fetch: sessions.institute.fetch,
    base: cast.institute.podRoot,
  });

  // --- Step 1: policies + credentials -------------------------------------
  const mandate: OdrlPolicy = buildLiveMandate(cast);
  const agreement: OdrlPolicy = buildLiveAgreement(cast);
  const instituteInternal: OdrlPolicy = buildLiveInstituteInternal(cast);
  const mandateTtl = await policyToTurtle(mandate);
  const agreementTtl = await policyToTurtle(agreement);
  const instituteInternalTtl = await policyToTurtle(instituteInternal);

  const mandateVc = await issueAgentAuthorization(
    {
      principal: cast.alice.webId,
      agent: cast.agentA.webId,
      action: ["read", "grantUse"],
      target: cast.alice.records,
      policy: cast.mandateId,
      policyContent: mandateTtl,
      validFrom: VALID_FROM,
      validUntil: VALID_UNTIL,
      credentialStatus: bitstringStatusListEntry({
        statusPurpose: "revocation",
        statusListIndex: cast.mandateStatusIndex,
        statusListCredential: cast.alice.statusListUrl,
      }),
    },
    actorKeys.alice,
  );
  const agreementVc = await issueAgentAuthorization(
    {
      principal: cast.agentA.webId,
      agent: cast.institute.webId,
      action: "read",
      target: cast.alice.records,
      policy: cast.agreementId,
      policyContent: agreementTtl,
      validFrom: VALID_FROM,
      validUntil: VALID_UNTIL,
    },
    actorKeys.agentA,
  );
  const instAgentVc = await issueAgentAuthorization(
    {
      principal: cast.institute.webId,
      agent: cast.agentR.webId,
      action: "read",
      target: cast.alice.records,
      policy: cast.instituteInternalId,
      policyContent: instituteInternalTtl,
      validFrom: VALID_FROM,
      validUntil: VALID_UNTIL,
    },
    actorKeys.institute,
  );

  // --- Step 2: discovery (guarded fetch, zero credentials) ----------------
  const discovery = await discoverAgent(cast.institute.webId, { fetch: discoveryFetch });
  if (discovery.verification?.valid !== true) {
    throw new LiveScenarioRefusal(
      `discovery failed: ${JSON.stringify(discovery.verification?.issues ?? [])}`,
    );
  }
  const pdSource = discovery.descriptor?.protocolSources?.[0];
  if (pdSource !== cast.institute.protocolDocUrl) {
    throw new LiveScenarioRefusal(`unexpected protocol source ${String(pdSource)}`);
  }

  // --- Step 3: the A2A upgrade handshake over LDN + the protocol pin -------
  // The runtime PD is deterministic; the seeded hosted body is exactly `pd.toTurtle()`, so
  // `pd.hash` is the pin R verifies the FETCHED body against (no blind trust).
  const pd = await buildRuntimeProtocolDocument();
  const offer = encodeUpgradeOffer({
    protocolHash: pd.hash,
    protocolSource: pdSource,
    required: true,
    protocolName: "Data-sharing negotiation",
  });

  const agentAOrigin = new URL(cast.agentA.webId).origin;
  const agentROrigin = new URL(cast.agentR.webId).origin;

  // A → R's inbox: Offer.
  const rInbox = await discoverInbox(discoveryFetch, cast.agentR.webId);
  const offerIri = await postNotification({
    fetch: sessions.agentA.fetch,
    inbox: rInbox,
    envelope: buildEnvelope({
      type: "Offer",
      actor: cast.agentA.webId,
      target: cast.alice.engagementBase,
      object: offer as unknown as Record<string, unknown>,
    }),
  });

  // R polls its inbox, decodes + verifies the protocol pin BEFORE trusting anything.
  const rNotes = await readInbox({
    fetch: sessions.agentR.fetch,
    inbox: rInbox,
    allowedObjectOrigins: [agentAOrigin],
  });
  const offerNote = rNotes.find((n) => n.type === "Offer" && n.payload !== undefined);
  if (offerNote?.payload === undefined) {
    throw new LiveScenarioRefusal("agent R received no decodable upgrade Offer");
  }
  const decodedOffer = decodeUpgradeOffer(offerNote.payload);
  const pdBody = await fetchText(discoveryFetch, decodedOffer.protocolSource);
  const protocolPinned = await verifyProtocolDocument(pdBody, decodedOffer.protocolHash);
  if (!protocolPinned) {
    throw new LiveScenarioRefusal("protocol document does not match its pin");
  }

  // R → A's inbox: Accept (threaded to the Offer).
  const aInbox = await discoverInbox(discoveryFetch, cast.agentA.webId);
  const response = encodeUpgradeResponse({ protocolHash: decodedOffer.protocolHash, accept: true });
  const acceptIri = await postNotification({
    fetch: sessions.agentR.fetch,
    inbox: aInbox,
    envelope: buildEnvelope({
      type: "Accept",
      actor: cast.agentR.webId,
      target: cast.alice.engagementBase,
      object: response as unknown as Record<string, unknown>,
      inReplyTo: offerIri,
    }),
  });

  // A polls its inbox, decodes the Accept, applies the no-silent-downgrade rule.
  const aNotes = await readInbox({
    fetch: sessions.agentA.fetch,
    inbox: aInbox,
    allowedObjectOrigins: [agentROrigin],
  });
  const acceptNote = aNotes.find((n) => n.type === "Accept" && n.payload !== undefined);
  if (acceptNote?.payload === undefined) {
    throw new LiveScenarioRefusal("agent A received no decodable upgrade Accept");
  }
  const decodedResponse = decodeUpgradeResponse(acceptNote.payload);
  const handshakeAccepted = decodedResponse.accept;
  if (!handshakeAccepted && !mayDowngradeToNl(offer, decodedResponse)) {
    throw new LiveScenarioRefusal("no downgrade for a required protocol");
  }

  // The negotiated intent — deterministic classify (grant, recipient, purpose, period).
  const nl =
    `share read access to ${cast.alice.records} with ${cast.institute.webId} ` +
    `purpose=${cast.purpose} until=${VALID_UNTIL}`;
  const parsed = await parseIntent(nl, { baseIRI: `${cast.institute.podRoot}intents/` });
  if (!parsed.resolved || parsed.intent === undefined) {
    throw new LiveScenarioRefusal(`intent not parsed: ${parsed.reason ?? "unknown"}`);
  }
  const report = await validateIntent(parsed.intent, pd);
  const intentConforms = report.conforms;
  if (!intentConforms) {
    throw new LiveScenarioRefusal(`intent does not conform: ${JSON.stringify(report.results)}`);
  }

  // --- Step 4: the four-phase verification (live resolvers) ---------------
  const request = requestContextFromA2AIntent(
    { action: "read", target: cast.alice.records },
    { purpose: cast.purpose, dateTime: now.toISOString() },
  );
  const primaryChain: PresentedChain = {
    credentials: [mandateVc, agreementVc],
    policies: [mandate, agreement],
    policyContents: {
      [cast.mandateId]: { content: mandateTtl },
      [cast.agreementId]: { content: agreementTtl },
    },
  };
  const actorChain: PresentedChain = {
    credentials: [instAgentVc],
    policies: [instituteInternal],
    policyContents: {
      [cast.instituteInternalId]: { content: instituteInternalTtl },
    },
  };
  const verification = await verifyAgentAuthority(primaryChain, {
    request,
    rootPrincipal: cast.alice.webId,
    now,
    resolveKey: keyResolver.resolveKey,
    isControlledBy: keyResolver.isControlledBy,
    resolveStatus,
    revoked: [],
    actor: cast.agentR.webId,
    actorChain,
  });
  if (!verification.authorized) {
    throw new LiveScenarioRefusal(
      `authorization denied (${verification.code}): ${verification.reason}`,
    );
  }

  // --- Step 6: WAC materialises (403 → 200) -------------------------------
  // BEFORE: agent R's authed GET of Alice's records is refused by the server.
  const agentRBefore = new LivePod({ fetch: sessions.agentR.fetch, base: cast.alice.podRoot });
  const before = await statusOfGet(agentRBefore, cast.alice.records);
  if (before !== 403) {
    throw new LiveScenarioRefusal(
      `expected agent R's pre-grant read of the records to be 403, got ${String(before)}`,
    );
  }
  // Alice (owner, holds acl:Control) materialises the grant through typed accessors.
  const aclResource = await aliceOwnerPod.aclFor(cast.alice.records);
  const grantBody = await buildAclDocument(aclResource, [
    ownerRule(cast.alice.webId, cast.alice.records, false),
    readGrantRule("grant-agent-r", cast.agentR.webId, cast.alice.records),
  ]);
  await aliceOwnerPod.get(aclResource); // track the ETag → If-Match overwrite
  await aliceOwnerPod.put(aclResource, grantBody, "text/turtle");
  // AFTER: a FRESH agent-R pod (no stale 403) now reads the records — the server permits it.
  const agentRAfter = new LivePod({ fetch: sessions.agentR.fetch, base: cast.alice.podRoot });
  const after = await statusOfGet(agentRAfter, cast.alice.records);
  if (after !== "ok") {
    throw new LiveScenarioRefusal(
      `expected agent R's post-grant read of the records to be 200, got ${String(after)}`,
    );
  }

  // --- Step 7: the action + its trace (mirrored, disjoint writers) --------
  // Host the institute-internal policy document (public read) at its canonical IRI so the
  // auditor dereferences the D9 second chain's policy generically.
  const internalDocUrl = cast.instituteInternalId.split("#")[0] as string;
  await institutePod.ensureContainer(`${cast.institute.podRoot}policies/`);
  await institutePod.put(internalDocUrl, instituteInternalTtl, "text/turtle");
  await writeResourceAcl(institutePod, internalDocUrl, [
    ownerRule(cast.institute.webId, internalDocUrl, false),
    publicReadRule(internalDocUrl, false),
  ]);

  const credentials = [
    { name: "mandate", vc: mandateVc },
    { name: "agreement", vc: agreementVc },
    { name: "institute-agent", vc: instAgentVc },
  ] as const;

  // The audited trace = the institute's mirror (agent R's disjoint session).
  await writeEngagement(mirrorPod, {
    base: cast.institute.mirrorBase,
    mandate,
    agreement,
    credentials: [...credentials],
  });
  // Alice's own copy (agent A's disjoint session) — the divergence mirror.
  await writeEngagement(aliceCopyPod, {
    base: cast.alice.engagementBase,
    mandate,
    agreement,
    credentials: [...credentials],
  });

  const activityId = "act-1";
  const activityIri = `${cast.institute.mirrorBase}activities/${activityId}.ttl#act`;
  await writeActivity(mirrorPod, cast.institute.mirrorBase, activityId, {
    activity: activityIri,
    agent: cast.agentR.webId,
    onBehalfOf: cast.institute.webId,
    used: [cast.alice.records],
    generated: [cast.derivedArtifact],
    plan: cast.agreementId,
    started: now,
    ended: new Date(now.getTime() + 60_000),
  });

  await writeDecision(mirrorPod, cast.institute.mirrorBase, "req-1", {
    id: `${cast.institute.mirrorBase}decisions/req-1.ttl#record`,
    request,
    evaluatedAt: now,
    rootPrincipal: cast.alice.webId,
    actor: cast.agentR.webId,
    leafAssignee: cast.institute.webId,
    revokedConsulted: [],
    result: verification,
    wacMutation: aclResource,
  });

  // Publish the derived summary (public read) so `audit <artifact>` can discover the trace.
  await publishDerivedSummary(
    institutePod,
    cast.institute.webId,
    cast.derivedArtifact,
    activityIri,
  );

  // --- Step 7b: LDN announce (R → Alice) + Alice-side mirror --------------
  const aliceInbox = await discoverInbox(discoveryFetch, cast.alice.webId);
  const announceIri = await postNotification({
    fetch: sessions.agentR.fetch,
    inbox: aliceInbox,
    envelope: buildEnvelope({
      type: "Announce",
      actor: cast.agentR.webId,
      target: cast.institute.mirrorBase,
      object: {
        id: `${cast.institute.mirrorBase}activities/${activityId}.ttl`,
        type: "prov:Activity",
      },
    }),
  });
  // Agent A (Alice's delegated processor) polls Alice's inbox, dereferences the announced
  // bundle (guarded, origin-bound to the institute), and mirrors it into Alice's copy.
  const inboxNotes = await readInbox({
    fetch: sessions.agentA.fetch,
    inbox: aliceInbox,
    allowedObjectOrigins: [new URL(cast.institute.webId).origin],
  });
  const announceNote = inboxNotes.find((n) => n.type === "Announce" && n.objectIri !== undefined);
  if (announceNote?.objectIri !== undefined) {
    const bundle = await dereferenceAnnouncedObject(discoveryFetch, announceNote.objectIri, [
      new URL(cast.institute.webId).origin,
    ]);
    if (bundle !== undefined) {
      // Mirror the ORIGIN-VERIFIED fetched bytes into Alice's copy (agent A's delegated write) —
      // the announced bundle came from the institute origin through the guarded fetch, so this is
      // the faithful "the owner holds a copy she did not have to poll for" (D3 / §3.4).
      await aliceCopyPod.put(
        `${cast.alice.engagementBase}activities/${activityId}.ttl`,
        bundle.body,
        bundle.contentType || "text/turtle",
      );
    }
  }

  return {
    now,
    cast,
    wacFlip: "403->200",
    aclResource,
    protocolPinned,
    handshakeAccepted,
    intentConforms,
    verification,
    credentials: { mandate: mandateVc, agreement: agreementVc, instituteAgent: instAgentVc },
    auditTraceBase: cast.institute.mirrorBase,
    aliceTraceBase: cast.alice.engagementBase,
    derivedArtifact: cast.derivedArtifact,
    activityIri,
    ldn: { offer: offerIri, accept: acceptIri, announce: announceIri },
  };
}

/** Fetch a text body through the (guarded) fetch; throws on a non-2xx / redirect. */
async function fetchText(fetch: typeof globalThis.fetch, url: string): Promise<string> {
  const response = await fetch(url, { redirect: "manual" });
  if (!response.ok) {
    throw new LiveScenarioRefusal(`GET ${url} → ${response.status}`);
  }
  return response.text();
}

/** Write a resource's ACL from typed rules (GET for the ETag, then overwrite/create). */
async function writeResourceAcl(
  ownerPod: LivePod,
  resource: string,
  rules: readonly AclRule[],
): Promise<void> {
  const aclUrl = await ownerPod.aclFor(resource);
  const body = await buildAclDocument(aclUrl, rules);
  await ownerPod.get(aclUrl);
  await ownerPod.put(aclUrl, body, "text/turtle");
}

/** Publish a minimal derived-summary resource (public read) pointing at the activity. */
async function publishDerivedSummary(
  institutePod: LivePod,
  ownerWebId: string,
  artifact: string,
  activityIri: string,
): Promise<void> {
  const graph = new GraphBuilder();
  graph.addType(artifact, "http://schema.org/Dataset");
  graph.addIri(artifact, PROV_WAS_GENERATED_BY, activityIri);
  const parsed = new URL(artifact);
  const container = `${parsed.origin}${parsed.pathname.replace(/[^/]+$/, "")}`;
  await institutePod.ensureContainer(container);
  await institutePod.put(artifact, await serializeTurtle(graph.quads()), "text/turtle");
  await writeResourceAcl(institutePod, artifact, [
    ownerRule(ownerWebId, artifact, false),
    publicReadRule(artifact, false),
  ]);
}
