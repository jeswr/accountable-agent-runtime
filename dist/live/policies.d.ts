import type { OdrlPolicy } from "../odrl.js";
import { type LiveCast } from "./cast.js";
/** The root mandate P (Alice → agent A: read + a depth-1 grantUse, distribute prohibited). */
export declare function buildLiveMandate(cast: LiveCast): OdrlPolicy;
/** The leaf Agreement (Alice-via-A → the institute: read for a stated purpose). */
export declare function buildLiveAgreement(cast: LiveCast): OdrlPolicy;
/**
 * The institute's INTERNAL authorization (institute → agent R: "our research agent may
 * exercise this for us"). A single-policy chain rooted at the LEAF ASSIGNEE — the D9
 * identity-composition second chain. `assigner` = the institute so the chain's trusted root
 * is the institute (chain₂.root ≡ chain₁.leaf assignee).
 */
export declare function buildLiveInstituteInternal(cast: LiveCast): OdrlPolicy;
//# sourceMappingURL=policies.d.ts.map