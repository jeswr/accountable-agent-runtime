// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// AAR_IT-gated integration suite (design §4.3): boots an in-memory CSS, seeds the full
// substrate, and exercises the Wave-1 T1–T3 surface against a LIVE Solid server —
// per-actor DPoP auth, LivePod round-trips + conditional-write + list + ACL discovery,
// the zero-credential discovery read, and — the security core — the §1.4 DISJOINT write
// delegations with their cross-write 403 assertions.
//
// Opt-in: `AAR_IT=1 npm test`. The default `npm test` stays hermetic (the 58 golden
// masters + the pure-logic unit suite) — this file self-skips when AAR_IT is unset.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { LivePod, LivePodError, type LiveSubstrate, seedDemo } from "../../src/live/index.js";

const RUN = process.env.AAR_IT ? describe : describe.skip;

/** Assert a LivePod op rejects with a specific HTTP status. */
async function expectStatus(op: Promise<unknown>, status: number): Promise<void> {
  await expect(op).rejects.toBeInstanceOf(LivePodError);
  await op.catch((error: unknown) => {
    expect((error as LivePodError).status).toBe(status);
  });
}

RUN("live substrate (AAR_IT)", () => {
  let s: LiveSubstrate;

  beforeAll(async () => {
    s = await seedDemo({ bootOptions: { readyTimeoutMs: 120_000 } });
  }, 240_000);

  afterAll(async () => {
    await s?.stop();
  });

  it("provisions four accounts + DPoP sessions with the right WebIDs", () => {
    for (const id of ["alice", "agentA", "institute", "agentR"] as const) {
      expect(s.sessions[id].webId).toBe(s.accounts[id].webId);
      expect(s.accounts[id].credentials.id).toBeTruthy();
    }
    expect(s.sessions.alice.webId).toBe(s.cast.alice.webId);
    expect(s.sessions.agentR.webId).toBe(s.cast.agentR.webId);
  });

  it("LivePod round-trips a write in the actor's own pod", async () => {
    const pod = new LivePod({ fetch: s.sessions.agentR.fetch, base: s.cast.agentR.podRoot });
    const url = `${s.cast.agentR.podRoot}scratch/note.ttl`;
    const body = `<${url}#it> <http://purl.org/dc/terms/title> "round trip" .`;
    await pod.put(url, body, "text/turtle");
    const got = await pod.get(url);
    expect(got).toBeDefined();
    expect(got?.body).toContain("round trip");
    expect(got?.contentType).toContain("turtle");
  });

  it("create-only guard: a second create (fresh adapter, If-None-Match:*) is a 412", async () => {
    const url = `${s.cast.agentR.podRoot}scratch/once.ttl`;
    const pod1 = new LivePod({ fetch: s.sessions.agentR.fetch, base: s.cast.agentR.podRoot });
    await pod1.put(url, `<${url}#a> <http://x/p> "1" .`, "text/turtle");
    // A fresh adapter has no tracked ETag → It sends If-None-Match:* → the existing resource 412s.
    const pod2 = new LivePod({ fetch: s.sessions.agentR.fetch, base: s.cast.agentR.podRoot });
    await expectStatus(pod2.put(url, `<${url}#a> <http://x/p> "2" .`, "text/turtle"), 412);
  });

  it("lists a container's children via ContainerDataset", async () => {
    const pod = new LivePod({ fetch: s.sessions.agentR.fetch, base: s.cast.agentR.podRoot });
    const container = `${s.cast.agentR.podRoot}listing/`;
    await pod.put(`${container}a.ttl`, `<#a> <http://x/p> "a" .`, "text/turtle");
    await pod.put(`${container}b.ttl`, `<#b> <http://x/p> "b" .`, "text/turtle");
    const children = await pod.list(container);
    expect(children).toContain(`${container}a.ttl`);
    expect(children).toContain(`${container}b.ttl`);
  });

  it("aclFor discovers the ACL location from the Link header (in scope)", async () => {
    const pod = new LivePod({ fetch: s.sessions.alice.fetch, base: s.cast.alice.podRoot });
    const aclUrl = await pod.aclFor(s.cast.alice.records);
    expect(aclUrl.startsWith(s.cast.alice.podRoot)).toBe(true);
    expect(aclUrl.toLowerCase()).toContain("acl");
  });

  it("discovery fetch reads a public WebID document with ZERO credentials", async () => {
    const response = await s.discoveryFetch(s.cast.alice.profileDoc);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body).toContain("Alice");
  });

  it("private records are 403 to agent R BEFORE the WAC grant (T4 flips this)", async () => {
    const pod = new LivePod({ fetch: s.sessions.agentR.fetch, base: s.cast.alice.podRoot });
    await expectStatus(pod.get(s.cast.alice.records), 403);
  });

  it("DISJOINT write grants: A writes Alice's copy, R writes the institute mirror", async () => {
    const aliceCopyByA = new LivePod({
      fetch: s.sessions.agentA.fetch,
      base: s.cast.alice.engagementBase,
    });
    await expect(
      aliceCopyByA.put(
        `${s.cast.alice.engagementBase}credentials/agreement.ttl`,
        `<#c> <http://x/p> "by A" .`,
        "text/turtle",
      ),
    ).resolves.toBeUndefined();

    const mirrorByR = new LivePod({
      fetch: s.sessions.agentR.fetch,
      base: s.cast.institute.mirrorBase,
    });
    await expect(
      mirrorByR.put(
        `${s.cast.institute.mirrorBase}activities/act-1.ttl`,
        `<#a> <http://x/p> "by R" .`,
        "text/turtle",
      ),
    ).resolves.toBeUndefined();
  });

  it("CROSS-WRITES are forbidden (403): R→Alice's copy and A→institute mirror", async () => {
    const aliceCopyByR = new LivePod({
      fetch: s.sessions.agentR.fetch,
      base: s.cast.alice.engagementBase,
    });
    await expectStatus(
      aliceCopyByR.put(
        `${s.cast.alice.engagementBase}forged.ttl`,
        `<#x> <http://x/p> "R should not write here" .`,
        "text/turtle",
      ),
      403,
    );

    const mirrorByA = new LivePod({
      fetch: s.sessions.agentA.fetch,
      base: s.cast.institute.mirrorBase,
    });
    await expectStatus(
      mirrorByA.put(
        `${s.cast.institute.mirrorBase}forged.ttl`,
        `<#x> <http://x/p> "A should not write here" .`,
        "text/turtle",
      ),
      403,
    );
  });
});
