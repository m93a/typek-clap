import { type Arguments, parseArguments, type ParsedArgument } from "./args.ts";
import { validateCommandOptions } from "./validate.ts";
import {
  ClapSubcommandLongFlagValueError,
  ClapUnreachableError,
} from "./errors.ts";

export interface CommandDefinition {
  /** The name of this command. */
  name: string;

  /**
   * The callback to be called if this command is executed.
   * It will **not** be called if a subcommand of this command
   * is executed.
   */
  action?: () => void;

  /** The description of this command, will show up in the auto-generated help. */
  about?: string;

  /**
   * The arguments (positional values, long flags and short flags)
   * this command takes.
   */
  arguments?: ArgumentDefinition;

  /** Whether the command should fail if no subcommand is specified. */
  subcommandRequired?: boolean;

  /**
   * List of accepted subcommands. Subcommands have their own arguments,
   * options, subcommands, help, etc.
   */
  subcommands?: SubcommandDefinition[];
}

export interface ArgumentDefinition {
  /** Name of this argument. Used to get its value at runtime. */
  name: string;

  /**
   * If set to true, this argument will be parsed without specifying
   * the long or short flag, based on its position in the arguments
   * list.
   * @default false
   */
  positional?: boolean;

  /**
   * Whether the command should fail if this argument is not
   * specified.
   * @default false
   */
  required?: boolean;

  /**
   * The long flag that can be used to specify this argument.
   * (In the arguments list, it's a double dash followed by the
   * specified word.)
   *
   * If the argument takes values, they may be specified after
   * an equal sign or a space.
   */
  long?: string;

  /**
   * Aliases that can be used instead of the specified long flag.
   */
  longFlagAliases?: string[];

  /**
   * The short flag (single letter) that can be used to specify
   * this argument.
   */
  short?: string;

  /**
   * Aliases that can be used instead of the specified short flag.
   */
  shortFlagAliases?: string[];

  /**
   * Whether this argument takes positional values, and how many.
   * The command will fail if less than the minimum required number
   * of arguments is specified. If more than the maximum number of
   * arguments are specified, the superfluous arguments will be
   * treated as positional arguments of the parent command.
   *
   * - `0`, `false` (default) – none
   *
   * - `n: number` – exactly _n_ positional arguments
   *
   * - `[min: number, max: number]` – at least _min_ but not more
   * than _max_ arguments
   *
   * - `true`, `[0, Infinity]` – any number of positional arguments
   *
   * In Rust's clap, this is called `num_args`.
   */
  takesValues?: boolean | number | [number, number];

  /**
   * Value for the argument when not present.
   *
   * @see implicitValue
   */
  defaultValue?: unknown;

  /**
   * Value for the argument when the flag is present but no
   * value is specified.
   *
   * In Rust's clap, this is called `default_missing_value`.
   *
   * @see defaultValue
   */
  implicitValue?: unknown;

  /**
   * If set to true, this argument will require an equals sign
   * between its name and the value, in long flag form.
   *
   * @example
   * ```sh
   * command -f42      # okay
   * command --flag=42 # okay
   * command --flag 42 # fails
   * ```
   */
  requireEquals?: boolean;

  /**
   * Allow specifying multiple values separated by a delimiter.
   */
  valueDelimiter?: string;

  /**
   * If set to true, this argument's value will consist of all
   * the values specified after an _end of arguments mark_ `--`.
   */
  last?: boolean;
}

export interface SubcommandDefinition extends CommandDefinition {
  /**
   * Whether this subcommand should be implicitly assumed
   * if no subcommand is specified by the user.
   */
  isDefault?: boolean;

  /**
   * Aliases that can be used to call this subcommand.
   */
  alias?: string[];

  /**
   * Enable calling this subcommand by specifying a long
   * flag (double dash followed by the specified word).
   */
  longFlag?: string;

  /**
   * Aliases that can be used instead of the specified long flag.
   */
  longFlagAliases?: string[];

  /**
   * Enable calling this subcommand by specifying a short
   * flag (single letter after a single dash).
   */
  shortFlag?: string;

  /**
   * Aliases that can be used instead of the specified short flag.
   */
  shortFlagAliases?: string[];

  /**
   * Whether to fail if this subcommand is called by its
   * name, instead of calling it as a flag.
   */
  disallowWithoutFlag?: boolean;
}

export interface CommandOptions extends CommandDefinition {
  version?: string;
}

export interface Command<T extends CommandOptions> {
  options: CommandOptions;
  handle(rawArgs: string[]): void;
  handle(args: Arguments): void;
}

function createCommand(
  this: unknown,
  options: CommandOptions
): Command<CommandOptions> {
  validateCommandOptions(options);

  return {
    options,
    handle(args_: Arguments | string[]) {
      if (Array.isArray(args_)) args_ = parseArguments(args_);
      const args = [...args_.parsed];
      let command: CommandOptions = options;

      while (args.length > 0) {
        const arg = args.shift()!;

        //
        // Check for subcommand
        {
          const { sub, nextArg } = matchSubcommand(command, arg);
          if (sub) {
          }
        }

        throw new ClapUnreachableError(
          `Unexpected type of argument: ${JSON.stringify(arg)}`
        );
      }
    },
  };
}

const matchSubcommand = (
  command: CommandDefinition,
  argument: ParsedArgument
): { sub?: SubcommandDefinition; nextArg?: ParsedArgument } => {
  for (const sub of command.subcommands ?? []) {
    //
    // Ordinary subcommand as a text-type argument
    if (
      "text" in argument &&
      !sub.disallowWithoutFlag &&
      argument.text === sub.name
    )
      return { sub };

    //
    // Subcommand as a long flag
    if (
      "long" in argument &&
      sub.longFlag !== undefined &&
      [sub.longFlag, ...(sub.longFlagAliases ?? [])].includes(
        argument.long.substring(2)
      )
    ) {
      if (argument.argument !== undefined) {
        throw new ClapSubcommandLongFlagValueError(
          argument.long,
          argument.argument
        );
      }
      return { sub };
    }

    //
    // Subcommand as a short flag
    if (
      "short" in argument &&
      sub.shortFlag !== undefined &&
      [sub.shortFlag, ...(sub.shortFlagAliases ?? [])].some(
        (s) => s === argument.short[1] // matches first short flag in argument
      )
    ) {
      // argument only has one short flag
      if (argument.short.length === 2) return { sub };
      return {
        sub,
        nextArg: { short: `-${argument.short.substring(2)}` },
      };
    }
  }

  //
  // Default subcommand
  const sub = command.subcommands?.find((s) => s.isDefault);
  if (sub) return { sub, nextArg: argument };

  //
  // No subcommand found
  return { nextArg: argument };
};

/**
 * Creates a command definition from the supplied options.
 *
 * @throws ClapError
 */
export const Command = <
  {
    <T extends CommandOptions>(options: T): Command<T>;
    new <T extends CommandOptions>(options: T): Command<T>;
  }
>createCommand;
