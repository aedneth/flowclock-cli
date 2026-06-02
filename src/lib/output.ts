import { EXIT_CODE_NAME, ExitCode } from "./exit.js";

/** Stable schema version for the --json envelope. Frozen at v1.0.0. */
export const JSON_ENVELOPE_SCHEMA = 1;

export interface JsonSuccess<T> {
  ok: true;
  command: string;
  schema: number;
  data: T;
}

export interface JsonError {
  ok: false;
  command: string;
  schema: number;
  error: { code: string; message: string };
}

export type JsonEnvelope<T> = JsonSuccess<T> | JsonError;

export function jsonSuccess<T>(command: string, data: T): JsonSuccess<T> {
  return { ok: true, command, schema: JSON_ENVELOPE_SCHEMA, data };
}

export function jsonError(
  command: string,
  code: ExitCode,
  message: string,
): JsonError {
  return {
    ok: false,
    command,
    schema: JSON_ENVELOPE_SCHEMA,
    error: { code: EXIT_CODE_NAME[code] ?? "GENERIC", message },
  };
}

/** Print a value as a single JSON object on stdout (data only — pipe-safe). */
export function printJson(value: unknown): void {
  process.stdout.write(JSON.stringify(value) + "\n");
}

/**
 * Resolve whether JSON output is requested from the flag or env. Used so agents
 * can force JSON globally with FLOWCLOCK_JSON=1.
 */
export function jsonRequested(
  flag: boolean | undefined,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (flag) return true;
  return env.FLOWCLOCK_JSON === "1" || env.FLOWCLOCK_JSON === "true";
}
