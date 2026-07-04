// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// The runtime's shipped A2A Protocol Document (SCENARIO step 3). It is built from
// `@jeswr/solid-a2a`'s prebuilt `grant` request shape and hash-pinned (sha256) so
// the upgrading peer verifies the fetched body against the pin before trusting it.
//
// G12 (MINOR) — no STOCK SHACL shape yet constrains purpose ∈ dpv: / period ≤ P1Y
// on a grant intent. The runtime carries purpose+period as validated intent
// PARAMETERS (present-and-well-formed), and this per-deployment PD is exactly the
// intended extension point where a bespoke purpose/period property shape lands.
// Upstreamed as a stock shape only if it recurs.
import { buildProtocolDocument, buildShapeForIntent, } from "@jeswr/solid-a2a";
/** The IRI the runtime hosts its Protocol Document at (the institute's origin). */
export const RUNTIME_PROTOCOL_ID = "https://institute.example/protocols/data-sharing.ttl";
/**
 * Build the runtime's hash-pinned data-sharing Protocol Document — a `grant`
 * request shape (recipient + modes + target) the negotiated intent is
 * SHACL-validated against. Deterministic: the same logical document yields the
 * same `hash` across runs (content-addressed).
 */
export async function buildRuntimeProtocolDocument() {
    return buildProtocolDocument({
        requestShape: buildShapeForIntent("grant"),
        meta: {
            id: RUNTIME_PROTOCOL_ID,
            name: "Data-sharing negotiation",
            description: "Negotiate read access to selected pod records for a stated purpose and bounded period.",
            version: "1",
        },
    });
}
//# sourceMappingURL=protocol.js.map