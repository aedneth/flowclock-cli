import { describe, it, expect } from "vitest";
import {
  jsonSuccess,
  jsonError,
  jsonRequested,
  JSON_ENVELOPE_SCHEMA,
} from "../src/lib/output.js";
import { ExitCode } from "../src/lib/exit.js";

describe("json envelope", () => {
  it("wraps success with a stable schema version", () => {
    const e = jsonSuccess("stats", { a: 1 });
    expect(e).toEqual({
      ok: true,
      command: "stats",
      schema: JSON_ENVELOPE_SCHEMA,
      data: { a: 1 },
    });
  });

  it("maps exit codes to error code names", () => {
    const e = jsonError("log", ExitCode.DATA, "boom");
    expect(e.ok).toBe(false);
    expect(e.error).toEqual({ code: "DATA", message: "boom" });
  });
});

describe("jsonRequested", () => {
  it("respects the flag", () => {
    expect(jsonRequested(true, {} as NodeJS.ProcessEnv)).toBe(true);
  });
  it("respects FLOWCLOCK_JSON env", () => {
    expect(
      jsonRequested(undefined, { FLOWCLOCK_JSON: "1" } as NodeJS.ProcessEnv),
    ).toBe(true);
    expect(
      jsonRequested(undefined, { FLOWCLOCK_JSON: "0" } as NodeJS.ProcessEnv),
    ).toBe(false);
    expect(jsonRequested(undefined, {} as NodeJS.ProcessEnv)).toBe(false);
  });
});
