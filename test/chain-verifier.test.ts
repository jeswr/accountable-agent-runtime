// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// Focused unit tests for the composed verifier's assembly (root-first ordering,
// fail-closed on cycles / branches / gaps / multi-root / duplicate ids) and the
// AgentAuthorizationCredential reader.

import { describe, expect, it } from "vitest";
import {
  type PresentedChain,
  readBoundAuthorization,
  verifyAgentAuthority,
} from "../src/chain-verifier/index.js";
import type { OdrlPolicy } from "../src/odrl.js";
import { runScenario } from "../src/scenario/index.js";

/** Assembly runs BEFORE any credential check, so these need no real credentials. */
async function assemble(
  policies: readonly OdrlPolicy[],
): Promise<{ phase: string; code?: string }> {
  const chain: PresentedChain = { credentials: [], policies };
  const r = await verifyAgentAuthority(chain, {
    request: { action: "read", target: "urn:t" },
    rootPrincipal: "urn:root",
    now: new Date("2026-08-01T00:00:00Z"),
    resolveKey: () => undefined,
  });
  return { phase: r.phase, ...(r.code !== undefined && { code: r.code }) };
}

const P = (id: string, delegatedUnder?: string): OdrlPolicy => ({
  id,
  type: "Agreement",
  assigner: "urn:a",
  ...(delegatedUnder !== undefined && { delegatedUnder }),
});

describe("chain assembly — fail-closed on structural anomalies", () => {
  it("empty policy set → CHAIN_MALFORMED", async () => {
    expect(await assemble([])).toEqual({ phase: "assembly", code: "CHAIN_MALFORMED" });
  });

  it("duplicate policy id → CHAIN_MALFORMED", async () => {
    expect(await assemble([P("urn:x"), P("urn:x")])).toEqual({
      phase: "assembly",
      code: "CHAIN_MALFORMED",
    });
  });

  it("two roots (no delegatedUnder) → CHAIN_MALFORMED", async () => {
    expect(await assemble([P("urn:a"), P("urn:b")])).toEqual({
      phase: "assembly",
      code: "CHAIN_MALFORMED",
    });
  });

  it("a branch (two children under one parent) → CHAIN_MALFORMED", async () => {
    expect(
      await assemble([P("urn:root"), P("urn:c1", "urn:root"), P("urn:c2", "urn:root")]),
    ).toEqual({ phase: "assembly", code: "CHAIN_MALFORMED" });
  });

  it("a gap (delegatedUnder points outside the set) → CHAIN_MALFORMED", async () => {
    expect(await assemble([P("urn:root"), P("urn:c1", "urn:missing")])).toEqual({
      phase: "assembly",
      code: "CHAIN_MALFORMED",
    });
  });

  it("a cycle (no root) → CHAIN_MALFORMED", async () => {
    expect(await assemble([P("urn:a", "urn:b"), P("urn:b", "urn:a")])).toEqual({
      phase: "assembly",
      code: "CHAIN_MALFORMED",
    });
  });
});

describe("readBoundAuthorization", () => {
  it("reads the bound claim from a real AgentAuthorizationCredential", async () => {
    const r = await runScenario();
    const auth = readBoundAuthorization(r.credentials.mandate);
    expect(auth).toBeDefined();
    expect(auth?.principal).toBe(r.cast.alice);
    expect(auth?.authorizes).toBe(r.cast.agentA);
    expect(auth?.policy).toBe(r.cast.mandateId);
    expect(auth?.action).toContain("read");
    expect(auth?.action).toContain("grantUse");
  });

  it("returns undefined for a non-AgentAuthorizationCredential", () => {
    expect(
      readBoundAuthorization({
        issuer: "urn:i",
        type: ["VerifiableCredential"],
        credentialSubject: { id: "urn:s" },
        proof: {
          type: "DataIntegrityProof",
          cryptosuite: "eddsa-rdfc-2022",
          proofPurpose: "assertionMethod",
          proofValue: "z1",
          verificationMethod: "urn:vm",
        },
      }),
    ).toBeUndefined();
  });
});
