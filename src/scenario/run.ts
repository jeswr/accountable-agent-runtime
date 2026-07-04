// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The scripted §4 scenario (SCENARIO steps 0–8) — the WHOLE flow as a pure,
// deterministic run over the in-memory pod double with REAL crypto (D7). Every
// package call is the real API; the only stubs are the labelled gaps (G1 policy
// binding trusted-by-location, G8 local activity emitter, G9 provisional decision
// shape, G10 the delegation seam, G11 the in-process carrier, G12 no stock
// purpose/period shape).

import {
  decodeUpgradeResponse,
  encodeUpgradeOffer,
  encodeUpgradeResponse,
  mayDowngradeToNl,
  parseIntent,
  validateIntent,
  verifyProtocolDocument,
} from "@jeswr/solid-a2a";
import type { AgentDiscovery } from "@jeswr/solid-agent-card";
import { buildAgentPointer, describeAgent, discoverAgent } from "@jeswr/solid-agent-card";
import type { VerifiableCredential } from "@jeswr/solid-vc";
import { issueAgentAuthorization } from "@jeswr/solid-vc";
import {
  type PresentedChain,
  type VerifyAuthorityResult,
  verifyAgentAuthority,
} from "../chain-verifier/index.js";
import { type OdrlPolicy, policyToTurtle, requestContextFromA2AIntent } from "../odrl.js";
import { serializeTurtle } from "../rdf.js";
import {
  type WrittenArtifact,
  writeActivity,
  writeDecision,
  writeEngagement,
} from "../trace/index.js";
import {
  buildAgreement,
  buildInstituteInternal,
  buildMandate,
  CAST,
  VALID_FROM,
  VALID_UNTIL,
} from "./cast.js";
import { generateActorKey, KeyRing, sameOriginController } from "./keys.js";
import { InMemoryPod } from "./pod.js";
import { buildRuntimeProtocolDocument, RUNTIME_PROTOCOL_ID } from "./protocol.js";

/** A refusal at a negotiation step (a fail-closed exit before authorization). */
export class ScenarioRefusal extends Error {}

/** The WAC grant the agreement materialised (step 6). */
export interface WacGrant {
  readonly target: string;
  readonly agent: string;
  readonly modes: readonly string[];
  /** The `.acl` resource the mutation lands on (G14 linkage lives in the decision record). */
  readonly aclResource: string;
}

/** The full result of a scenario run — everything the tests + auditor consume. */
export interface ScenarioResult {
  readonly pod: InMemoryPod;
  readonly keyRing: KeyRing;
  readonly now: Date;
  readonly discovery: AgentDiscovery;
  readonly protocolHash: string;
  readonly protocolPinned: boolean;
  readonly handshakeAccepted: boolean;
  readonly intentConforms: boolean;
  readonly verification: VerifyAuthorityResult;
  readonly mandate: OdrlPolicy;
  readonly agreement: OdrlPolicy;
  readonly instituteInternal: OdrlPolicy;
  readonly credentials: {
    readonly mandate: VerifiableCredential;
    readonly agreement: VerifiableCredential;
    readonly instituteAgent: VerifiableCredential;
  };
  readonly wacGrant: WacGrant;
  readonly writtenArtifacts: readonly WrittenArtifact[];
  readonly activityId: string;
  readonly requestId: string;
  readonly cast: typeof CAST;
}

/** Options for {@link runScenario}. */
export interface RunScenarioOptions {
  /** The single instant the run is evaluated at (default: within the grant window). */
  readonly now?: Date;
}

/** Run the deterministic §4 scenario end to end. Throws {@link ScenarioRefusal} on a fail-closed exit. */
export async function runScenario(options: RunScenarioOptions = {}): Promise<ScenarioResult> {
  const now = options.now ?? new Date("2026-08-01T00:00:00.000Z");
  const pod = new InMemoryPod();
  const keyRing = new KeyRing();

  // --- Step 0: identities, keys, pointers, self-description ----------------
  const aliceKey = await generateActorKey(CAST.aliceKeyVm);
  const agentAKey = await generateActorKey(CAST.agentAKeyVm);
  const instKey = await generateActorKey(CAST.instKeyVm);
  for (const k of [aliceKey, agentAKey, instKey]) {
    keyRing.register(k);
  }

  // Institute org profile → agent pointer to agentR (the "org links its agent").
  const pointer = buildAgentPointer(CAST.inst, CAST.agentR);
  pod.put(CAST.instProfileDoc, await pointer.toString(), "text/turtle");

  // The institute agent self-describes (Agent Description hosted at its WebID doc).
  const { agentDescription } = describeAgent({
    id: CAST.agentR,
    name: "Institute research agent",
    owner: CAST.inst,
    url: CAST.agentRDoc,
    securitySchemes: [{ type: "solid-oidc", issuer: "https://idp.institute.example" }],
    protocolSources: [RUNTIME_PROTOCOL_ID],
    skills: [{ id: "negotiate-data-sharing", name: "Negotiate data sharing" }],
  });
  pod.put(CAST.agentRDoc, await agentDescription.toTurtle(), "text/turtle");

  // The runtime's hash-pinned Protocol Document.
  const pd = await buildRuntimeProtocolDocument();
  pod.put(RUNTIME_PROTOCOL_ID, await pd.toTurtle(), "text/turtle");

  // --- Step 1: the mandate + the credentials -------------------------------
  const mandate = buildMandate();
  const agreement = buildAgreement();
  const instituteInternal = buildInstituteInternal();

  const mandateVc = await issueAgentAuthorization(
    {
      principal: CAST.alice,
      agent: CAST.agentA,
      action: ["read", "grantUse"],
      target: CAST.records,
      policy: CAST.mandateId,
      validFrom: VALID_FROM,
      validUntil: VALID_UNTIL,
    },
    aliceKey,
  );
  const agreementVc = await issueAgentAuthorization(
    {
      principal: CAST.agentA,
      agent: CAST.inst,
      action: "read",
      target: CAST.records,
      policy: CAST.agreementId,
      validFrom: VALID_FROM,
      validUntil: VALID_UNTIL,
    },
    agentAKey,
  );
  const instAgentVc = await issueAgentAuthorization(
    {
      principal: CAST.inst,
      agent: CAST.agentR,
      action: "read",
      target: CAST.records,
      policy: CAST.instituteInternalId,
      validFrom: VALID_FROM,
      validUntil: VALID_UNTIL,
    },
    instKey,
  );

  // --- Step 2: discovery ---------------------------------------------------
  const discovery = await discoverAgent(CAST.inst, { fetch: pod.fetch });
  if (discovery.verification?.valid !== true) {
    throw new ScenarioRefusal(
      `discovery failed: ${JSON.stringify(discovery.verification?.issues ?? [])}`,
    );
  }
  const pdSource = discovery.descriptor?.protocolSources?.[0];
  if (pdSource !== RUNTIME_PROTOCOL_ID) {
    throw new ScenarioRefusal(`unexpected protocol source ${String(pdSource)}`);
  }

  // --- Step 3: the A2A handshake (NL→RDF upgrade, hash-pinned protocol) -----
  const pdBody = await pod.fetch(pdSource).then((r) => r.text());
  // Verify the FETCHED body against the pin BEFORE trusting it (no blind trust).
  const protocolPinned = await verifyProtocolDocument(pdBody, pd.hash);
  if (!protocolPinned) {
    throw new ScenarioRefusal("protocol document does not match its pin");
  }

  const offer = encodeUpgradeOffer({
    protocolHash: pd.hash,
    protocolSource: pdSource,
    required: true,
    protocolName: "Data-sharing negotiation",
  });
  // G11: the carrier is in-process in Phase 0 — the institute side accepts the upgrade.
  const response = decodeUpgradeResponse(
    encodeUpgradeResponse({ protocolHash: offer.protocolHash, accept: true }),
  );
  const handshakeAccepted = response.accept;
  if (!handshakeAccepted && !mayDowngradeToNl(offer, response)) {
    throw new ScenarioRefusal("no downgrade for a required protocol");
  }

  // The negotiated intent — deterministic classify (grant, recipient, purpose, period).
  const nl =
    `share read access to ${CAST.records} with ${CAST.inst} ` +
    `purpose=${CAST.purpose} until=${VALID_UNTIL}`;
  const parsed = await parseIntent(nl, { baseIRI: "https://institute.example/intents/" });
  if (!parsed.resolved || parsed.intent === undefined) {
    throw new ScenarioRefusal(`intent not parsed: ${parsed.reason ?? "unknown"}`);
  }
  const report = await validateIntent(parsed.intent, pd);
  const intentConforms = report.conforms;
  if (!intentConforms) {
    throw new ScenarioRefusal(`intent does not conform: ${JSON.stringify(report.results)}`);
  }

  // --- Step 4: the four-phase verification (with the D9 identity composition) -
  const request = requestContextFromA2AIntent(
    { action: "read", target: CAST.records },
    { purpose: CAST.purpose, dateTime: now.toISOString() },
  );
  const primaryChain: PresentedChain = {
    credentials: [mandateVc, agreementVc],
    policies: [mandate, agreement],
  };
  const actorChain: PresentedChain = {
    credentials: [instAgentVc],
    policies: [instituteInternal],
  };
  const verification = await verifyAgentAuthority(primaryChain, {
    request,
    rootPrincipal: CAST.alice,
    now,
    resolveKey: keyRing.resolveKey,
    isControlledBy: sameOriginController,
    revoked: [],
    actor: CAST.agentR,
    actorChain,
  });
  if (!verification.authorized) {
    throw new ScenarioRefusal(
      `authorization denied (${verification.code}): ${verification.reason}`,
    );
  }

  // --- Step 6: scoped access materialises (WAC) ----------------------------
  // The grant names agentR (the AUTHENTICATED actor), justified by the agreement
  // (assignee inst) + instAgentVc (inst → agentR) — the identity-composition rule.
  // G14: the .acl cannot reference the agreement, so the decision record (step 7)
  // records the WAC mutation ← agreement linkage. Materialising the actual .acl via
  // @solid/object is Phase 2 (a live pod); Phase 0 records the intended mutation.
  const wacGrant: WacGrant = {
    target: CAST.records,
    agent: CAST.agentR,
    modes: ["Read"],
    aclResource: `${CAST.records}.acl`,
  };

  // --- Step 7: action + the trace it leaves --------------------------------
  const writtenArtifacts = await writeEngagement(pod, {
    base: CAST.engagementBase,
    mandate,
    agreement,
    credentials: [
      { name: "mandate", vc: mandateVc },
      { name: "agreement", vc: agreementVc },
      { name: "institute-agent", vc: instAgentVc },
    ],
  });
  // The institute-internal policy (the D9 second-chain root) is hosted at its IRI's
  // document URL (the institute's pod), so the auditor discovers it GENERICALLY from
  // the credential's svc:policy binding — no hard-coded trace filenames.
  pod.put(
    CAST.instituteInternalId.split("#")[0] as string,
    await policyToTurtle(instituteInternal),
    "text/turtle",
  );

  const activityId = "act-1";
  const activityIri = `${CAST.engagementBase}activities/${activityId}.ttl#act`;
  const started = now;
  const ended = new Date(now.getTime() + 60_000);
  const activityQuads = await writeActivity(pod, CAST.engagementBase, activityId, {
    activity: activityIri,
    agent: CAST.agentR,
    onBehalfOf: CAST.inst,
    used: [CAST.records],
    generated: [CAST.derivedArtifact],
    plan: CAST.agreementId,
    started,
    ended,
  });
  // LDN: the owner holds a copy she did not have to poll for (D3).
  pod.put(
    `${CAST.aliceInbox}${activityId}.ttl`,
    await serializeTurtle(activityQuads),
    "text/turtle",
  );

  const requestId = "req-1";
  await writeDecision(pod, CAST.engagementBase, requestId, {
    id: `${CAST.engagementBase}decisions/${requestId}.ttl#record`,
    request,
    evaluatedAt: now,
    rootPrincipal: CAST.alice,
    actor: CAST.agentR,
    leafAssignee: CAST.inst,
    revokedConsulted: [],
    result: verification,
    wacMutation: wacGrant.aclResource,
  });

  return {
    pod,
    keyRing,
    now,
    discovery,
    protocolHash: pd.hash,
    protocolPinned: true,
    handshakeAccepted,
    intentConforms,
    verification,
    mandate,
    agreement,
    instituteInternal,
    credentials: { mandate: mandateVc, agreement: agreementVc, instituteAgent: instAgentVc },
    wacGrant,
    writtenArtifacts,
    activityId,
    requestId,
    cast: CAST,
  };
}
