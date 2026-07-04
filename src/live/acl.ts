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

import type { DataFactory as DataFactoryType, DatasetCore } from "@rdfjs/types";
import { Authorization } from "@solid/object";
import { DataFactory, Store } from "n3";
import { serializeTurtle } from "../rdf.js";

const factory = DataFactory as unknown as DataFactoryType;
/** `rdf:type acl:Authorization` — the class every authorization node must carry. */
const ACL_AUTHORIZATION = "http://www.w3.org/ns/auth/acl#Authorization";

/** The four WAC access modes an authorization may grant. */
export interface AclModes {
  readonly read?: boolean;
  readonly write?: boolean;
  readonly append?: boolean;
  /** `acl:Control` — read/write the ACL itself. Owner-only; never on a delegate rule. */
  readonly control?: boolean;
}

/** One authorization rule to write into an ACL document. */
export interface AclRule {
  /** A short, unique fragment id for the rule node (`<aclUrl#name>`). */
  readonly name: string;
  /** `acl:accessTo` — the exact resource this rule governs. */
  readonly accessTo?: string;
  /** `acl:default` — inherited by descendants of this container. */
  readonly default?: string;
  /** `acl:agent` WebIDs this rule grants to. */
  readonly agents?: readonly string[];
  /** `acl:agentClass foaf:Agent` — public (unauthenticated) access. */
  readonly publicAccess?: boolean;
  /** `acl:agentClass acl:AuthenticatedAgent` — any logged-in agent. */
  readonly authenticatedAccess?: boolean;
  /** The access modes granted. */
  readonly modes: AclModes;
}

/**
 * Serialise a set of {@link AclRule}s into an ACL Turtle document rooted at `aclUrl` (each
 * rule's node is `<aclUrl#name>`), through the typed `@solid/object` `Authorization`
 * accessors. Returns the Turtle body to PUT at the ACL resource.
 */
export async function buildAclDocument(aclUrl: string, rules: readonly AclRule[]): Promise<string> {
  const store = new Store();
  const dataset = store as unknown as DatasetCore;
  const seen = new Set<string>();
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
export function ownerRule(owner: string, resource: string, isContainer: boolean): AclRule {
  return {
    name: "owner",
    accessTo: resource,
    ...(isContainer ? { default: resource } : {}),
    agents: [owner],
    modes: { read: true, write: true, control: true },
  };
}
