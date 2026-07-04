// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T2 (part) — WAC `.acl` authoring through `@solid/object`'s typed `Authorization`
// accessors (design §1.4; the house rule: NEVER a hand-built ACL triple). Every rule's
// subjects/predicates/objects are written through the wrapper's setters
// (`accessTo`/`default`/`agent`/`agentClass`/mode) over an `n3.Store`, then serialised via
// `n3.Writer` ({@link serializeTurtle}). The ONLY literal vocabulary IRI passed by hand is
// the `rdf:type acl:Authorization` class (set through the typed `type` set), which the
// wrapper needs to mark the node an authorization — not RDF content, but the node's kind.
//
// OWNER-CONTROL, FAIL-CLOSED. Callers build every container's ACL explicitly before any
// non-owner touches it. The owner rule always carries `acl:Control`; delegate rules NEVER
// do (Alice/the institute delegate trace AUTHORING, not ACL authority — §1.4), and the
// disjoint write grants are what make a mirrored-trace divergence evidential.
import { Authorization } from "@solid/object";
import { DataFactory, Store } from "n3";
import { serializeTurtle } from "../rdf.js";
const factory = DataFactory;
/** `rdf:type acl:Authorization` — the class every authorization node must carry. */
const ACL_AUTHORIZATION = "http://www.w3.org/ns/auth/acl#Authorization";
/**
 * Serialise a set of {@link AclRule}s into an ACL Turtle document rooted at `aclUrl` (each
 * rule's node is `<aclUrl#name>`), through the typed `@solid/object` `Authorization`
 * accessors. Returns the Turtle body to PUT at the ACL resource.
 */
export async function buildAclDocument(aclUrl, rules) {
    const store = new Store();
    const dataset = store;
    const seen = new Set();
    for (const rule of rules) {
        if (seen.has(rule.name)) {
            throw new Error(`duplicate ACL rule name ${JSON.stringify(rule.name)}`);
        }
        seen.add(rule.name);
        const subject = `${aclUrl}#${rule.name}`;
        const auth = new Authorization(subject, dataset, factory);
        auth.type.add(ACL_AUTHORIZATION);
        if (rule.accessTo !== undefined) {
            auth.accessTo = rule.accessTo;
        }
        if (rule.default !== undefined) {
            auth.default = rule.default;
        }
        for (const agent of rule.agents ?? []) {
            auth.agent.add(agent);
        }
        if (rule.publicAccess === true) {
            auth.accessibleToAny = true;
        }
        if (rule.authenticatedAccess === true) {
            auth.accessibleToAuthenticated = true;
        }
        if (rule.modes.read === true) {
            auth.canRead = true;
        }
        if (rule.modes.write === true) {
            auth.canWrite = true;
        }
        if (rule.modes.append === true) {
            auth.canAppend = true;
        }
        if (rule.modes.control === true) {
            auth.canReadWriteAcl = true;
        }
    }
    return await serializeTurtle([...store]);
}
/**
 * The owner's full-control rule for a resource/container — `acl:Read`+`acl:Write`+
 * `acl:Control`, `acl:accessTo` the resource AND (for a container) `acl:default` so
 * descendants inherit owner control. The fail-closed floor every ACL starts from.
 */
export function ownerRule(owner, resource, isContainer) {
    return {
        name: "owner",
        accessTo: resource,
        ...(isContainer ? { default: resource } : {}),
        agents: [owner],
        modes: { read: true, write: true, control: true },
    };
}
//# sourceMappingURL=acl.js.map