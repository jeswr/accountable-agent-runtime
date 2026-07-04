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
export declare function buildAclDocument(aclUrl: string, rules: readonly AclRule[]): Promise<string>;
/**
 * The owner's full-control rule for a resource/container — `acl:Read`+`acl:Write`+
 * `acl:Control`, `acl:accessTo` the resource AND (for a container) `acl:default` so
 * descendants inherit owner control. The fail-closed floor every ACL starts from.
 */
export declare function ownerRule(owner: string, resource: string, isContainer: boolean): AclRule;
//# sourceMappingURL=acl.d.ts.map