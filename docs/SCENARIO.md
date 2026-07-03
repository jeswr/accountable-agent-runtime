<!-- AUTHORED-BY Claude Fable 5 -->

# The §4 scenario, API call by API call

The vision paper's §4 worked scenario — *"Alice's agent negotiates a data-sharing arrangement
with a research institute's agent: selected records from Alice's pod, for a stated purpose, for
one year"* — walked as the exact package calls the runtime makes. Signatures are the verified
current APIs (`solid-agent-card`/`solid-vc` per their `etc/*.api.md`; `solid-a2a` per its README
exports; `solid-odrl` per `feat/delegation-profile @ 18df183`). Steps marked **[G*n*]** hit a gap
from [`DESIGN.md`](./DESIGN.md) §4 and say what the runtime does meanwhile.

Cast (IRIs used throughout):

```
alice    = https://alice.solid.example/profile/card#me         (principal)
agentA   = https://agent-a.example/id#it                        (Alice's agent)
inst     = https://institute.example/org#id                     (the institute)
agentR   = https://institute.example/agents/research#it         (institute's agent)
records  = https://alice.solid.example/data/records.ttl         (the selected records)
purpose  = https://w3id.org/dpv#ResearchAndDevelopment          (the stated purpose)
```

---

## Step 0 — setup: identities, keys, pointers, self-description

**Alice's key** (signs the mandate credential):

```ts
import { generateKeyPairForSuite, exportPublicJwk } from "@jeswr/solid-vc";

const aliceKey = await generateKeyPairForSuite(
  "https://alice.solid.example/keys#k1",   // the verificationMethod IRI
  "Ed25519",                                // → eddsa-rdfc-2022
);
const publicJwk = await exportPublicJwk(aliceKey);
// [G5] publish publicJwk at the verificationMethod IRI, listed as assertionMethod
// in a controller document Alice's WebID controls — no library helper exists;
// Phase 0/1 the runtime writes this document itself (typed accessors + n3.Writer).
```

**Alice's profile links her agent** (the paper's "Alice's profile links the two"):

```ts
import { buildAgentPointer } from "@jeswr/solid-agent-card";

const pointer = buildAgentPointer(alice, agentA);  // interop:hasAuthorizationAgent default
await writeToProfile(await pointer.toString());   // runtime: PATCH into Alice's profile doc
```

**Each agent self-describes** (Agent Card + ANP RDF at its origin):

```ts
import { describeAgent } from "@jeswr/solid-agent-card";

const { agentCard, agentDescription } = describeAgent({
  id: agentR,
  name: "Institute research agent",
  owner: inst,
  url: "https://institute.example/agents/research",
  securitySchemes: [{ type: "solid-oidc", issuer: "https://idp.institute.example" }],
  protocolSources: ["https://institute.example/protocols/data-sharing.ttl"],  // → step 3
  skills: [{ id: "negotiate-data-sharing", name: "Negotiate data sharing" }],
});
// hosted at /.well-known/agent-card.json and /.well-known/agent-descriptions
```

## Step 1 — the mandate: Alice delegates to agent A

**The root ODRL Agreement** (mandate P) — read on the records, plus a depth-1, expiring,
mandated-next-policy `grantUse` so A may conclude exactly one downstream agreement:

```ts
import { policyToTurtle } from "@jeswr/solid-odrl";        // feat/delegation-profile

const mandate = {
  id: "https://alice.solid.example/agents/engagements/e1/mandate.ttl#policy",
  type: "Agreement",
  profile: "https://w3id.org/jeswr/odrl-delegation",
  assigner: alice,
  permissions: [
    { type: "permission", action: "read", target: records, assignee: agentA,
      constraints: [{ leftOperand: "dateTime", operator: "lteq", rightOperand: "2027-07-03T00:00:00Z" }] },
    { type: "permission", action: "grantUse", target: records, assignee: agentA,
      constraints: [
        { leftOperand: "delegationDepth", operator: "lteq", rightOperand: 1 },
        { leftOperand: "dateTime", operator: "lteq", rightOperand: "2027-07-03T00:00:00Z" },
      ],
      duties: [
        { action: "nextPolicy",
          target: "https://alice.solid.example/agents/engagements/e1/agreement.ttl#policy" },
        { action: "inform", target: alice },   // duty: tell Alice when the delegation happens
      ] },
  ],
  prohibitions: [
    { type: "prohibition", action: "distribute", target: records },
  ],
};
await pod.put("…/e1/mandate.ttl", await policyToTurtle(mandate));
```

*(The `nextPolicy` duty means the chain evaluator later requires the delegated hop to be exactly
the agreement IRI Alice mandated — profile §5.2.6. In a live negotiation the mandated IRI is
minted before the counterparty is known; its content is what gets negotiated.)*

**The AgentAuthorizationCredential** binding the mandate:

```ts
import { issueAgentAuthorization } from "@jeswr/solid-vc";

const mandateVc = await issueAgentAuthorization(
  {
    principal: alice,            // issuer = subject = the delegating principal
    agent: agentA,               // svc:authorizes
    action: ["read", "grantUse"],
    target: records,
    policy: mandate.id,          // [G1] bare-IRI binding — the credential note REJECTS
                                 // this form; until solid-vc gains the embedded-Agreement /
                                 // relatedResource-digest path, the runtime treats the
                                 // pod-fetched mandate.ttl content as trusted-by-location
                                 // (Phase 0/1 stub) and marks the verification result
                                 // POLICY_INTEGRITY-provisional.
    validFrom: "2026-07-03T00:00:00Z",
    validUntil: "2027-07-03T00:00:00Z",
  },
  aliceKey,
);
await pod.put("…/e1/credentials/mandate.vc.jsonld", JSON.stringify(mandateVc));
```

## Step 2 — discovery: A finds R via its Agent Card

```ts
import { discoverAgent } from "@jeswr/solid-agent-card";

const discovery = await discoverAgent(agentR, { fetch: guardedFetch });
// walks: agentR's WebID doc → agent pointers → /.well-known/agent-card.json
// → /.well-known/agent-descriptions (ANP RDF), and VERIFIES the descriptor
if (!discovery.verification?.valid) throw refuse(discovery.verification?.issues);
const pdSource = discovery.descriptor!.protocolSources![0];  // → step 3
```

`discovery.descriptor.owner === inst` closes descriptor→principal; the runtime cross-checks it
against the credential chain R presents in step 4 (Phase B).

## Step 3 — the A2A handshake: NL → RDF upgrade, hash-pinned protocol

```ts
import {
  verifyProtocolDocument, encodeUpgradeOffer, decodeUpgradeResponse,
  mayDowngradeToNl, parseIntent, validateIntent,
} from "@jeswr/solid-a2a";

// R published the PD; A fetches and verifies against the pin BEFORE trusting it
const pdTurtle = await guardedFetch(pdSource).then(r => r.text());
const pinned = await verifyProtocolDocument(pdTurtle, expectedHash);  // sha256:…
if (!pinned) throw refuse("protocol document does not match its pin");

// the upgrade offer — REQUIRED: a security-bearing negotiation must not fall back to NL
const offer = encodeUpgradeOffer({
  protocolHash: expectedHash, protocolSource: pdSource, required: true,
  protocolName: "Data-sharing negotiation",
});
// [G11] transport: Phase 0–1 in-process; Phase 2 LDN-POST to agentR's ldp:inbox
const response = decodeUpgradeResponse(await carrier.send(agentR, offer));
if (!response.accept && !mayDowngradeToNl(offer, response)) throw refuse("no downgrade");

// the intent — deterministic path first, SHACL-validated against the pinned PD
const parsed = await parseIntent(
  `share read access to ${records} with ${inst}`,
);
// parsed.intent.parameters carries purpose + period; [G12] the PD the runtime ships
// constrains them (purpose ∈ dpv:, period ≤ P1Y) — no stock shape exists yet
const report = await validateIntent(parsed.intent, pdTurtle);
if (!report.conforms) throw refuse(report.results);
```

## Step 4 — verification: each side runs the FOUR-PHASE check

Before treating any intent as authorized, each side verifies the other's presented chain
(credential note §Verification; this composed verifier is **[G7]**, the runtime's
`chain-verifier/` component):

```ts
import { verifyCredential } from "@jeswr/solid-vc";
import { evaluateDelegated, requestContextFromA2AIntent } from "@jeswr/solid-odrl";

async function verifyAgentAuthority(presented: VerifiableCredential[], request, now) {
  // 1–2. extract each credential's bound policy + assemble root-first by
  //      odrld:delegatedUnder — single linear chain, no cycles/branches/gaps  [G7]
  const chain = assembleChain(presented);            // CHAIN_MALFORMED on any anomaly

  // Phase A — every credential, same instant
  for (const vc of presented) {
    const res = await verifyCredential(vc, {
      resolveKey,                                    // [G5] runtime-supplied WebID key resolver
      isControlledBy,                                // [G4] document-resolved, not the default heuristic
      trustedIssuers: undefined,                     // root-anchoring done in Phase B instead
      expectedProofPurpose: "assertionMethod",
      now,
    });
    if (!res.verified) return deny(res.errors);      // INVALID_SIGNATURE, EXPIRED, …
  }

  // Phase B — cross-binding  [G7]
  //   issuer === credentialSubject.id === hop.assigner
  //   svc:authorizes === hop.assignee
  //   hop_i declares odrld:delegatedUnder <hop_{i-1}>
  //   the ROOT credential's issuer is the trusted root principal for the target
  //   (for records: Alice — the resource owner)
  if (!crossBind(presented, chain, { rootPrincipal: alice })) return deny("BINDING_MISMATCH");

  // Phase C — status ∪ revocation, fail-closed
  const revoked = new Set<string>();
  // [G2] Bitstring status gate not yet in solid-vc — Phase 0/1 carries
  // odrld:Revocation statements only:
  for (const r of await fetchRevocations(chain, guardedFetch))  // unreachable → deny
    revoked.add(r.revokedPolicy);

  // Phase D — the delegation-profile chain walk
  const decision = evaluateDelegated(chain, request, { now, revoked, requireDuties: true });
  return decision;                                   // two-valued: permit | deny
}

// the request comes straight from the SHACL-validated intent:
const request = requestContextFromA2AIntent(parsed.intent);
const decision = await verifyAgentAuthority(chainFromA, request, new Date());
if (decision.decision !== "permit") throw refuse(decision.reason, decision.hops);
```

**The identity-composition rule (institute side).** The leaf agreement (step 5) names the
**institute** (`inst`) as assignee — legal accountability attaches to the organisation — but the
*authenticated actor* on the wire is `agentR`. Phase D requires the requesting agent to be the
leaf assignee, so `agentR` is **not** covered by the Alice-chain alone. The paper's own setup
closes this: *"The institute's agent carries its own authorization credential."* Concretely, the
verifier accepts an acting WebID `w` for a leaf assignee `p` only when `w === p`, **or** when a
**second four-phase-verified chain, whose trusted root principal is `p`**, permits `w` to perform
the requested action (here: `inst` issues its own AgentAuthorizationCredential — principal =
`inst`, `svc:authorizes` = `agentR`, action/target within the agreement — verified with the same
`verifyAgentAuthority`, with `rootPrincipal: inst`). Composition rule: **chain₂'s trusted root
must equal chain₁'s leaf assignee.** Both decisions are recorded (step 7). R's
federation-membership credential is verified alongside via `@jeswr/federation-trust`; that path
reuses this verifier unchanged.

## Step 5 — the Agreement

The negotiated outcome, a delegated hop under the mandate (`odrld:delegatedUnder`), at exactly
the IRI the mandate's `nextPolicy` duty pinned:

```ts
const agreement = {
  id: "https://alice.solid.example/agents/engagements/e1/agreement.ttl#policy",
  type: "Agreement",
  profile: "https://w3id.org/jeswr/odrl-delegation",
  delegatedUnder: mandate.id,
  assigner: agentA,                 // the delegator (within mandate P)
  assignee: inst,                   // the institute
  permissions: [
    { type: "permission", action: "read", target: records, assignee: inst,
      constraints: [
        { leftOperand: "purpose",  operator: "eq",   rightOperand: purpose },
        { leftOperand: "dateTime", operator: "lteq", rightOperand: "2027-07-03T00:00:00Z" },
      ],
      duties: [{ action: "delete" /* at expiry */ }] },
  ],
};
await bothPods.put("…/e1/agreement.ttl", await policyToTurtle(agreement));

// signed by both sides: [G15] solid-vc is single-issuer, so Phase 1 uses the
// mirrored-credentials pattern — A issues a credential binding the agreement, and
// R (for the institute) issues its own binding the SAME content; a verifier
// requires both. (Digest-equality of the two bound copies needs G1.)
const agreementVcFromA = await issueAgentAuthorization(
  { principal: agentA, agent: inst, action: "read", target: records, policy: agreement.id,
    validUntil: "2027-07-03T00:00:00Z" },
  agentAKey,
);
```

The chain the institute will present from now on is `[mandate, agreement]`, credentials
`[mandateVc, agreementVcFromA]` — **plus** the institute's own internal authorization
credential covering its acting agent (the identity-composition rule, step 4):

```ts
// inst → agentR: "our research agent may exercise this agreement for us"
const instAgentVc = await issueAgentAuthorization(
  { principal: inst, agent: agentR, action: "read", target: records,
    policy: agreement.id, validUntil: "2027-07-03T00:00:00Z" },
  instKey,
);
```

## Step 6 — scoped access materialises

Per the access-management design, agreements compile down to the target-based core the server
actually enforces — here, WAC on the concrete resource:

```ts
// via @solid/object typed .acl accessors (house rule: never hand-built triples):
// add an acl:Authorization granting acl:Read on <records> to agent <inst-agents>
// (the institute's authenticated WebIDs), acl:accessTo <records>.
await writeAclGrant({ target: records, agent: agentR, modes: ["Read"] });
// the grant names agentR (the AUTHENTICATED actor), justified by the agreement
// (assignee inst) PLUS instAgentVc (inst → agentR) — the identity-composition
// rule of step 4; the decision record captures both chains.
// [G14] the .acl cannot reference the agreement; the decision record (step 7)
// records "this WAC mutation ← this agreement" so the linkage survives in the trace.
```

Client-side pre-flight on every use stays available: `requestContextFromWac()` maps the incoming
WAC-mode request to an ODRL request context, so R (or a conforming server later, under M5a)
re-checks the agreement before acting.

## Step 7 — action, and the trace it must leave

R reads the records (DPoP-authed fetch — the runtime's injected auth seam), derives its dataset,
and records:

```ts
import { delegationProvenance } from "@jeswr/solid-odrl";

// (a) the chain overlay — once per engagement:
//     <agreement> prov:wasAttributedTo <agentA>; odrld:delegatedUnder <mandate>;
//     prov:wasDerivedFrom <mandate>. <inst> prov:actedOnBehalfOf <agentA> . …
const overlay = delegationProvenance([mandate, agreement]);
await pod.put("…/e1/chain.prov.ttl", await serialize(overlay));

// (b) one PROV bundle per ACTION  [G8 — no actionProvenance() emitter yet;
//     the runtime authors the §8 bundle via typed accessors + n3.Writer]:
//     <#act> a prov:Activity ; prov:wasAssociatedWith <agentR> ;
//       prov:used <records> ; prov:generated <derived> ;
//       prov:qualifiedAssociation [ prov:agent <agentR> ; prov:hadPlan <agreement> ] .
//     <derived> prov:wasDerivedFrom <records> ; prov:wasGeneratedBy <#act> .
await pod.put(`…/e1/activities/${actId}.ttl`, activityBundle);
await ldnPost(aliceInbox, activityBundle);        // the owner's unpollable copy

// (c) the decision record for the authorization check that gated this action
//     [G9 — provisional w3id.org/jeswr/accountable-agent# shape until the ODRL CG
//      report vocabulary stabilises]: request, instant, chain IRIs, revoked set,
//      decision, reason, per-hop trace, and (per G14) the WAC mutation it justified.
await pod.put(`…/e1/decisions/${reqId}.ttl`, decisionRecord);
```

## Step 8 — a year later: the dispute, walked

Alice finds her data used outside the stated purpose. The auditor:

1. `offendingArtifact prov:wasGeneratedBy ?act` → the activity; `prov:wasAssociatedWith` →
   `agentR`; `prov:actedOnBehalfOf` → the institute.
2. `?act prov:qualifiedAssociation/prov:hadPlan` → the agreement;
   `odrld:delegatedUnder*` → the mandate; each `prov:wasAttributedTo` → agentA, Alice. **Who
   authorized: Alice → agent A → the institute, every link a signed artifact.**
3. Re-runs step 4's four phases over the trace with `now` = the activity's
   `prov:startedAtTime` — **both chains**: the Alice-chain `[mandate, agreement]` for the
   request with agent = `inst`, and the institute chain (`instAgentVc`, root principal =
   `inst` = the leaf assignee) covering the associated agent `agentR` — the *read* was
   authorized then. Re-runs Phase D with the **actual use**
   (`purpose` = the one evident in the offending artifact): **deny** — outside the agreement's
   `purpose` constraint. **In scope? No — and the breach is now a mechanical, signed finding**,
   with the unfulfilled `delete` duty aggregated in the decision for good measure.
4. Alice publishes `[] a odrld:Revocation ; odrld:revokedPolicy <agreement>` beside the mandate
   (profile §7 — the owner cuts off the subtree); every future evaluation of the chain denies.

Enforcement from here is legal — the chain is the evidence, not the handcuffs
([`DESIGN.md`](./DESIGN.md) §5).
