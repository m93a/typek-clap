import type {
  CommandDefinition,
  SubcommandDefinition,
  CommandOptions,
} from "./command.ts";
import type { IsSingleChar, Join } from "@typek/typek";
import { ClapConfigurationError } from "./errors.ts";

declare const ERROR: unique symbol;

//
// Command Definition

type ErrorSubcommandRequired<CommandName extends string> = {
  [ERROR]: `In command \`${CommandName}\`, a subcommand is required, yet no subcommands are specified.`;
};
type ValidateSubcommandRequired<
  T extends CommandDefinition,
  Success
> = T extends { subcommandRequired: true }
  ? T extends { subcommands: CommandDefinition[] }
    ? T extends { subcommands: [] | never[] }
      ? ErrorSubcommandRequired<T["name"]>
      : Success
    : ErrorSubcommandRequired<T["name"]>
  : Success;
const validateSubcommandRequired = (x: CommandDefinition): void => {
  if (x.subcommandRequired && !x.subcommands?.length) {
    throw new ClapConfigurationError(
      `In command \`${x.name}\`, a subcommand is required, yet no subcommands are specified.`
    );
  }
};

type ErrorMultipleDefault<
  CommandName extends string,
  SubcommandNames extends string[]
> = {
  [ERROR]: `In command \`${CommandName}\`, multiple subcommands are specified as default: ${Join<
    SubcommandNames,
    ", "
  >}`;
};
type GetDefaultSubcommands<
  T extends SubcommandDefinition[],
  DefaultSubcommandNames extends string[] = []
> = T extends [
  infer Head extends SubcommandDefinition,
  ...infer Tail extends SubcommandDefinition[]
]
  ? Head extends { isDefault: true }
    ? GetDefaultSubcommands<Tail, [...DefaultSubcommandNames, Head["name"]]>
    : GetDefaultSubcommands<Tail, DefaultSubcommandNames>
  : DefaultSubcommandNames;
type ValidateMultipleDefault<T extends CommandDefinition, Success> = T extends {
  subcommands: infer S extends SubcommandDefinition[];
}
  ? GetDefaultSubcommands<S> extends infer D extends [
      string,
      string,
      ...string[]
    ]
    ? ErrorMultipleDefault<T["name"], D>
    : Success
  : Success;
const validateMultipleDefault = (x: CommandDefinition): void => {
  const defaultNames = (x.subcommands ?? [])
    .filter((s) => s.isDefault)
    .map((s) => s.name);
  if (defaultNames.length > 1) {
    throw new ClapConfigurationError(
      `In command \`${
        x.name
      }\`, multiple subcommands are specified as default: ${defaultNames.join(
        ", "
      )}`
    );
  }
};

type ValidateSubcommands<
  T extends SubcommandDefinition[] | undefined,
  Success
> = T extends [
  infer Head extends SubcommandDefinition,
  ...infer Tail extends SubcommandDefinition[]
]
  ? ValidateSubcommandDefinition<Head, ValidateSubcommands<Tail, Success>>
  : T extends [infer Item extends SubcommandDefinition]
  ? ValidateSubcommandDefinition<Item, Success>
  : Success;
const validateSubcommands = (x: CommandDefinition): void => {
  for (const s of x.subcommands ?? []) {
    validateSubcommandDefinition(s);
  }
};

type ValidateCommandDefinition<
  T extends CommandDefinition,
  Success
> = ValidateSubcommandRequired<
  T,
  ValidateMultipleDefault<T, ValidateSubcommands<T["subcommands"], Success>>
>;
const validateCommandDefinition = (x: CommandDefinition): void => {
  validateSubcommandRequired(x);
  validateMultipleDefault(x);
  validateSubcommands(x);
};

//
// Subcommand Definition

type ErrorDisallowWithoutFlag<CommandName extends string> = {
  [ERROR]: `In subcommand \`${CommandName}\`, calling without flag is disallowed, yet neither \`longFlag\` nor \`shortFlag\` are specified.`;
};
type ValidateDisallowWithoutFlag<
  T extends SubcommandDefinition,
  Success
> = T extends { disallowWithoutFlag: true }
  ? T extends { longFlag: string } | { shortFlag: string }
    ? Success
    : ErrorDisallowWithoutFlag<T["name"]>
  : Success;
const validateDisallowWithoutFlag = (x: SubcommandDefinition): void => {
  if (x.disallowWithoutFlag && !(x.longFlag || x.shortFlag)) {
    throw new ClapConfigurationError(
      `In subcommand \`${x.name}\`, calling without flag is disallowed, yet neither \`longFlag\` nor \`shortFlag\` are specified.`
    );
  }
};

type ErrorShortFlagSingleChar<
  CommandName extends string,
  ShortFlag extends string
> = {
  [ERROR]: `In subcommand \`${CommandName}\`, a short flag \`${ShortFlag}\` was specified. Only short flags consisting of single letter are supported.`;
};
type ValidateShortFlagSingleChar<
  T extends SubcommandDefinition,
  Success
> = T extends {
  shortFlag: infer ShortFlag extends string;
}
  ? IsSingleChar<ShortFlag> extends false
    ? ErrorShortFlagSingleChar<T["name"], ShortFlag>
    : Success
  : Success;
const validateShortFlagSingleChar = (x: SubcommandDefinition): void => {
  if (x.shortFlag && x.shortFlag.length !== 1) {
    throw new ClapConfigurationError(
      `In subcommand \`${x.name}\`, a short flag \`${x.shortFlag}\` was specified. Only short flags consisting of single letter are supported.`
    );
  }
};

type ValidateShortFlagAliasesSingleChar<
  T extends SubcommandDefinition,
  Success
> = T extends {
  shortFlagAliases: [infer Head extends string, ...infer Tail extends string[]];
}
  ? IsSingleChar<Head> extends false
    ? ErrorShortFlagSingleChar<T["name"], Head>
    : ValidateShortFlagAliasesSingleChar<
        { name: T["name"]; shortFlagAliases: Tail },
        Success
      >
  : Success;
const validateShortFlagAliasesSingleChar = (x: SubcommandDefinition): void => {
  for (const s of x.shortFlagAliases ?? []) {
    validateShortFlagSingleChar({ name: x.name, shortFlag: s });
  }
};

type ErrorFlagAliasesWithoutFlag<
  CommandName extends string,
  Type extends "long" | "short"
> = {
  [ERROR]: `In subcommand \`${CommandName}\`, an alias for a ${Type} flag has been provided while \`${Type}Flag\` is not specified.`;
};
type ValidateFlagAliasesWithoutFlag<
  T extends SubcommandDefinition,
  Type extends "long" | "short",
  Success
> = T extends Record<`${Type}FlagAliases`, string[]>
  ? T extends Record<`${Type}FlagAliases`, never[]>
    ? Success
    : T extends Record<`${Type}Flag`, string>
    ? Success
    : ErrorFlagAliasesWithoutFlag<T["name"], Type>
  : Success;
const validateFlagAliasesWithoutFlag = (
  x: SubcommandDefinition,
  type: "long" | "short"
): void => {
  if (x[`${type}FlagAliases`]?.length && !x[`${type}Flag`]) {
    throw new ClapConfigurationError(
      `In subcommand \`${x.name}\`, an alias for a ${type} flag has been provided while \`${type}Flag\` is not specified.`
    );
  }
};

type ValidateSubcommandDefinition<
  T extends SubcommandDefinition,
  Success
> = ValidateCommandDefinition<
  T,
  ValidateDisallowWithoutFlag<
    T,
    ValidateShortFlagSingleChar<
      T,
      ValidateShortFlagAliasesSingleChar<
        T,
        ValidateFlagAliasesWithoutFlag<
          T,
          "long",
          ValidateFlagAliasesWithoutFlag<T, "short", Success>
        >
      >
    >
  >
>;
const validateSubcommandDefinition = (x: SubcommandDefinition): void => {
  validateCommandDefinition(x);
  validateDisallowWithoutFlag(x);
  validateShortFlagSingleChar(x);
  validateShortFlagAliasesSingleChar(x);
  validateFlagAliasesWithoutFlag(x, "long");
  validateFlagAliasesWithoutFlag(x, "short");
};

export type ValidateCommandOptions<
  T extends CommandOptions,
  Success
> = ValidateCommandDefinition<T, Success>;
export const validateCommandOptions = (x: CommandOptions): void => {
  validateCommandDefinition(x);
};
