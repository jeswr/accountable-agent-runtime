/** Parsed argv: positionals + a flag map (`--flag value` → string, bare `--flag` → `true`). */
export interface ParsedArgs {
    readonly positionals: string[];
    readonly flags: Map<string, string | true>;
}
/** Parse `--flag value` / `--flag` (boolean) options + positional args from argv. */
export declare function parseArgs(argv: readonly string[]): ParsedArgs;
/** A per-command flag spec: `"value"` requires a following value, `"boolean"` is a bare toggle. */
export type FlagSpec = Record<string, "value" | "boolean">;
/** The `audit` subcommand's flags (`--json` is a bare toggle → JSON to stdout). */
export declare const AUDIT_FLAGS: FlagSpec;
/** The `demo` subcommand's flags (`--json <file>` requires a path). */
export declare const DEMO_FLAGS: FlagSpec;
/**
 * Validate parsed flags against a command's spec: reject any UNKNOWN flag, and require a value
 * for every `"value"` flag (a bare `--base` / `--json <file>` with no value is an error, not a
 * silent no-op — roborev Low). Returns an error message, or `undefined` when valid.
 */
export declare function validateFlags(command: string, flags: Map<string, string | true>, spec: FlagSpec): string | undefined;
//# sourceMappingURL=cli-args.d.ts.map