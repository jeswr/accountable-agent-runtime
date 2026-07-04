import { type ProtocolDocument } from "@jeswr/solid-a2a";
/** The IRI the runtime hosts its Protocol Document at (the institute's origin). */
export declare const RUNTIME_PROTOCOL_ID: "https://institute.example/protocols/data-sharing.ttl";
/**
 * Build the runtime's hash-pinned data-sharing Protocol Document — a `grant`
 * request shape (recipient + modes + target) the negotiated intent is
 * SHACL-validated against. Deterministic: the same logical document yields the
 * same `hash` across runs (content-addressed).
 */
export declare function buildRuntimeProtocolDocument(): Promise<ProtocolDocument>;
//# sourceMappingURL=protocol.d.ts.map