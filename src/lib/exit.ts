/**
 * Stable, POSIX-friendly exit codes. Agents branch on these — do not renumber.
 */
export enum ExitCode {
  OK = 0,
  GENERIC = 1,
  /** Invalid arguments / usage (also Commander's default for parse errors). */
  USAGE = 2,
  CONFIG = 3,
  /** sessions.json unreadable/corrupt and unrecoverable. */
  DATA = 4,
  /** Interactive flow required but no TTY available (agent-mode misuse). */
  NO_TTY = 5,
  /** A `doctor` check failed. */
  DOCTOR = 6,
}

/** Machine-readable error code strings used in the --json envelope. */
export const EXIT_CODE_NAME: Record<ExitCode, string> = {
  [ExitCode.OK]: "OK",
  [ExitCode.GENERIC]: "GENERIC",
  [ExitCode.USAGE]: "USAGE",
  [ExitCode.CONFIG]: "CONFIG",
  [ExitCode.DATA]: "DATA",
  [ExitCode.NO_TTY]: "NO_TTY",
  [ExitCode.DOCTOR]: "DOCTOR",
};

/**
 * Error carrying an explicit exit code. Thrown by lib/commands and translated
 * into a clean stderr message + process exit by the top-level CLI handler.
 */
export class FlowclockError extends Error {
  readonly code: ExitCode;
  constructor(code: ExitCode, message: string) {
    super(message);
    this.name = "FlowclockError";
    this.code = code;
  }
}

/** Convenience throw helper. */
export function fail(code: ExitCode, message: string): never {
  throw new FlowclockError(code, message);
}
