// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T4 unit suite — the cast-parameterised live policy builders produce the SAME structure as
// the fixed-CAST originals but keyed off live IRIs, and the fixed builders are untouched.

import { describe, expect, it } from "vitest";
import { actorBasesFor, buildCast, VALID_UNTIL } from "../src/live/cast.js";
import {
  buildLiveAgreement,
  buildLiveInstituteInternal,
  buildLiveMandate,
} from "../src/live/policies.js";
import { buildAgreement, buildInstituteInternal, buildMandate } from "../src/scenario/cast.js";

const cast = buildCast(actorBasesFor("http://localhost:3000"));

describe("live policy builders", () => {
  it("mandate: Alice → agent A, read + depth-1 grantUse, distribute prohibited, live IRIs", () => {
    const m = buildLiveMandate(cast);
    expect(m.id).toBe(cast.mandateId);
    expect(m.assigner).toBe(cast.alice.webId);
    expect(m.permissions?.map((p) => p.action)).toEqual(["read", "grantUse"]);
    for (const p of m.permissions ?? []) {
      expect(p.assignee).toBe(cast.agentA.webId);
      expect(p.target).toBe(cast.alice.records);
    }
    expect(m.prohibitions?.[0]?.action).toBe("distribute");
    // Structural parity with the fixed builder (same #rules/#constraints/#duties).
    const fixed = buildMandate();
    expect(m.permissions?.length).toBe(fixed.permissions?.length);
    expect(m.permissions?.[1]?.duties?.length).toBe(fixed.permissions?.[1]?.duties?.length);
  });

  it("agreement: agent A → institute, read for the purpose, delegatedUnder the mandate", () => {
    const a = buildLiveAgreement(cast);
    expect(a.id).toBe(cast.agreementId);
    expect(a.delegatedUnder).toBe(cast.mandateId);
    expect(a.assigner).toBe(cast.agentA.webId);
    expect(a.assignee).toBe(cast.institute.webId);
    const purpose = a.permissions?.[0]?.constraints?.find((c) => c.leftOperand === "purpose");
    expect(purpose?.rightOperand).toBe(cast.purpose);
    const parity = buildAgreement();
    expect(a.permissions?.[0]?.duties?.length).toBe(parity.permissions?.[0]?.duties?.length);
  });

  it("institute-internal: institute → agent R (the D9 second chain root)", () => {
    const i = buildLiveInstituteInternal(cast);
    expect(i.id).toBe(cast.instituteInternalId);
    expect(i.assigner).toBe(cast.institute.webId);
    expect(i.delegatedUnder).toBeUndefined();
    expect(i.permissions?.[0]?.assignee).toBe(cast.agentR.webId);
    expect(buildInstituteInternal().permissions?.length).toBe(i.permissions?.length);
  });

  it("uses the shared grant window", () => {
    const m = buildLiveMandate(cast);
    const dt = m.permissions?.[0]?.constraints?.find((c) => c.leftOperand === "dateTime");
    expect(dt?.rightOperand).toBe(VALID_UNTIL);
  });
});
