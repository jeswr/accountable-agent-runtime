// AUTHORED-BY Claude Opus 4.8 (Fable unavailable) — re-review/upgrade candidate
//
// T6 (part) — the CLI's PURE argument parsing + per-command flag validation, extracted so it
// is unit-testable without spawning the bin. `cli.ts` is a thin `process`-wired shell around
// these; the rules here are what the tests pin.
/** Parse `--flag value` / `--flag` (boolean) options + positional args from argv. */
export function parseArgs(argv) {
    const positionals = [];
    const flags = new Map();
    for (let i = 0; i < argv.length; i += 1) {
        const arg = argv[i];
        if (arg.startsWith("--")) {
            const name = arg.slice(2);
            const next = argv[i + 1];
            if (next !== undefined && !next.startsWith("--")) {
                flags.set(name, next);
                i += 1;
            }
            else {
                flags.set(name, true);
            }
        }
        else {
            positionals.push(arg);
        }
    }
    return { positionals, flags };
}
/** The `audit` subcommand's flags (`--json` is a bare toggle → JSON to stdout). */
export const AUDIT_FLAGS = {
    engagement: "value",
    purpose: "value",
    at: "value",
    base: "value",
    json: "boolean",
};
/** The `demo` subcommand's flags (`--json <file>` requires a path). */
export const DEMO_FLAGS = { keep: "boolean", base: "value", json: "value" };
/**
 * Validate parsed flags against a command's spec: reject any UNKNOWN flag, and require a value
 * for every `"value"` flag (a bare `--base` / `--json <file>` with no value is an error, not a
 * silent no-op — roborev Low). Returns an error message, or `undefined` when valid.
 */
export function validateFlags(command, flags, spec) {
    for (const [name, value] of flags) {
        const kind = spec[name];
        if (kind === undefined) {
            return `${command}: unknown flag --${name}`;
        }
        if (kind === "value" && value === true) {
            return `${command}: flag --${name} requires a value`;
        }
    }
    return undefined;
}
//# sourceMappingURL=cli-args.js.map