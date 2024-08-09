import { enumerate, startsWith, yeet } from "@typek/typek";

declare const process: undefined | typeof import("node:process");
const ARGS_AVAILABLE = typeof process === "object" || typeof Deno === "object";

export const rawArgs: string[] = (() => {
  if (typeof Deno === "object") return Deno.args;
  if (typeof process === "object") {
    const [_1, _2, ...args] = process.argv;
    return args;
  }
  return [];
})();

export interface Arguments {
  /**
   * `true` in Node, Bun and Deno, `false` in a browser environment.
   */
  available: boolean;

  /**
   * Returns the script arguments to the program. Like
   * [`Deno.args`](https://docs.deno.com/api/deno/~/Deno.args),
   * the array only contains the proper arguments passed to the
   * script. When compared to
   * [`Bun.argv`](https://bun.sh/guides/process/argv), the zeroth,
   * first and second arguments are stripped. When compared to Node's
   * [`process.argv`](https://nodejs.org/docs/latest/api/process.html#processargv),
   * the first two formal arguments are stripped.
   *
   * @example
   * ```bash
   * $ ./my_script.ts --opt=1 file -xyz --flag
   * ```
   *
   * ```ts
   * import { args } from "@typek/clap";
   * console.log(args.raw); // [ "--opt=1", "file", "-xyz", "--flag" ]
   * ```
   */
  raw: string[];

  /**
   * Arguments given to this script, parsed according to Unix
   * conventions without regard for any command-specific syntax.
   *
   * Rules:
   *  * `foo` → `{ text: 'foo' }`
   *  * `-f` → `{ short: '-f' }`
   *  * `--flag` → `{ long: '--flag' }`
   *  * `-abcd` → `{ short: '-abcd' }`
   *  * `--option=value` → `{ long: '--option', argument: 'value' }`
   *  * `--` → `{ endOfOptions: '--' }`, all subsequent options treated as text
   */
  parsed: ParsedArgument[];

  /**
   * Check whether a flag is present, assuming no short flag
   * takes an argument.
   */
  has(longOrShort: `--${string}` | `-${string}`): boolean;
  has(long: `--${string}`, short: `-${string}`): boolean;

  /**
   * Get the value of a flag, assuming it takes one positional
   * argument. Later occurences of a flag rewrite the value of
   * the preceding occurences.
   */
  get(longOrShort: `--${string}` | `-${string}`): string | undefined;
  get(long: `--${string}`, short: `-${string}`): string | undefined;
}

/**
 * A script argument parsed according to Unix conventions without
 * the knowledge of the particular command's syntax.
 *
 * Rules:
 *  * `foo` → `{ text: 'foo' }`
 *  * `-f` → `{ short: '-f' }`
 *  * `--flag` → `{ long: '--flag' }`
 *  * `-abcd` → `{ short: '-abcd' }`
 *  * `--option=value` → `{ long: '--option', argument: 'value' }`
 *  * `--` → `{ endOfOptions: '--' }`, all subsequent options treated as text
 */
export type ParsedArgument =
  | { text: string }
  | { long: `--${string}`; argument?: string }
  | { short: `-${string}` }
  | { endOfOptions: "--" };

/**
 * Given an array of unparsed arguments (for example from the platform's `argv`,
 * or from this module's `args.raw` export), produces an array of arguments
 * parsed according to Unix conventions, without regard for command-specific
 * syntax.
 */
export function parseArguments(rawArgs: string[]): Arguments {
  const parsedArgs: ParsedArgument[] = [];
  let eoo = false;

  const parse = (arg: string) => {
    if (eoo) return parsedArgs.push({ text: arg });

    // End of options
    if (arg === "--") {
      eoo = true;
      return parsedArgs.push({ endOfOptions: "--" });
    }

    // Long argument
    if (startsWith(arg, "--")) {
      const eq = arg.indexOf("=");
      if (eq === -1) return parsedArgs.push({ long: arg });

      const long = arg.substring(0, eq) as `--${string}`;
      const argument = arg.substring(eq + 1, arg.length);
      return parsedArgs.push({ long, argument });
    }

    // Short argument
    if (startsWith(arg, "-")) return parsedArgs.push({ short: arg });

    // Positional argument
    return parsedArgs.push({ text: arg });
  };

  // Parse all arguments
  for (const arg of rawArgs) parse(arg);

  // Utility functions

  const has = (a: string, b?: `-${string}`): boolean => {
    const [long, short] = startsWith(a, "--")
      ? [a, b]
      : startsWith(a, "-")
      ? [undefined, a]
      : yeet(TypeError, "A flag must start with a dash.");

    for (const arg of parsedArgs) {
      if ("long" in arg && arg.long === long) {
        return true;
      }
      if ("short" in arg && short && arg.short.includes(short[1])) {
        return true;
      }
    }

    return false;
  };

  const get = (a: string, b?: `-${string}`): string | undefined => {
    const [long, short] = startsWith(a, "--")
      ? [a, b]
      : startsWith(a, "-")
      ? [undefined, a]
      : yeet(TypeError, "A flag must start with a dash.");

    let value: string | undefined;
    for (const [i, arg] of enumerate(parsedArgs)) {
      if ("long" in arg && arg.long === long) {
        if (arg.argument !== undefined) {
          value = arg.argument;
          continue;
        }

        const next = parsedArgs[i + 1] ?? {};
        if ("text" in next) {
          value = next.text;
          continue;
        }

        value = "";
        continue;
      }

      if ("short" in arg && arg.short[1] === short?.[1]) {
        value = arg.short.substring(2, arg.short.length);
        continue;
      }
    }
    return value;
  };

  return {
    available: ARGS_AVAILABLE,
    raw: rawArgs,
    parsed: parsedArgs,
    has,
    get,
  };
}

export const args: Arguments = parseArguments(rawArgs);
