export enum ClapErrorKind {
  /** If you see this type of error, open an issue. */
  LibraryBug = "library-bug",
  /** You, the developer, caused this error. */
  DeveloperInduced = "developer-induced",
  /** Error caused by the CLI user entering incorrect commands/arguments */
  InvalidUserInput = "invalid-user-input",
}

export enum ClapErrorReason {
  Unreachable = "unreachable",
  BadConfiguration = "bad-configuration",
  SubcommandLongFlagValue = "subcommand-long-flag-value",
}

export abstract class ClapError extends Error {
  abstract kind: ClapErrorKind;
  abstract reason: ClapErrorReason;
  constructor(public message: string) {
    super(message);
  }
}

export class ClapUnreachableError extends ClapError {
  kind = ClapErrorKind.LibraryBug;
  reason = ClapErrorReason.Unreachable;
}

export class ClapConfigurationError extends ClapError {
  kind = ClapErrorKind.DeveloperInduced;
  reason = ClapErrorReason.BadConfiguration;
}

export class ClapSubcommandLongFlagValueError extends ClapError {
  kind = ClapErrorKind.InvalidUserInput;
  reason = ClapErrorReason.SubcommandLongFlagValue;
  constructor(public flag: `--${string}`, public value: string) {
    super(
      `The flag ${flag} cannot take a value, because it is a subcommand. Value provided: ${value}`
    );
  }
}
