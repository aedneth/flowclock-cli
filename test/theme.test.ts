import { describe, it, expect } from "vitest";
import { colorEnabled, paint, colorDepth } from "../src/lib/theme.js";
import { humanDuration } from "../src/lib/format.js";

describe("colorEnabled", () => {
  it("is off when not a TTY", () => {
    expect(colorEnabled({ isTTY: false, env: {} as NodeJS.ProcessEnv })).toBe(
      false,
    );
  });
  it("is on for a TTY with no overrides", () => {
    expect(colorEnabled({ isTTY: true, env: {} as NodeJS.ProcessEnv })).toBe(
      true,
    );
  });
  it("honors NO_COLOR", () => {
    expect(
      colorEnabled({
        isTTY: true,
        env: { NO_COLOR: "1" } as NodeJS.ProcessEnv,
      }),
    ).toBe(false);
  });
  it("honors explicit --no-color flag", () => {
    expect(
      colorEnabled({
        isTTY: true,
        noColor: true,
        env: {} as NodeJS.ProcessEnv,
      }),
    ).toBe(false);
  });
});

describe("colorDepth", () => {
  const env = (o: Record<string, string>) => o as NodeJS.ProcessEnv;
  it("reports truecolor from COLORTERM", () => {
    expect(colorDepth(env({ COLORTERM: "truecolor", TERM: "xterm" }))).toBe(
      "truecolor",
    );
  });
  it("reports 256 from TERM", () => {
    expect(colorDepth(env({ TERM: "xterm-256color" }))).toBe("256");
  });
  it("reports basic for a plain TERM", () => {
    expect(colorDepth(env({ TERM: "xterm" }))).toBe("basic");
  });
  it("reports none for NO_COLOR", () => {
    expect(colorDepth(env({ NO_COLOR: "1", TERM: "xterm-256color" }))).toBe(
      "none",
    );
  });
  it("reports none for a dumb/empty terminal", () => {
    expect(colorDepth(env({ TERM: "dumb" }))).toBe("none");
    expect(colorDepth(env({}))).toBe("none");
  });
});

describe("paint", () => {
  it("returns plain text when disabled", () => {
    expect(paint("x", "neon", false)).toBe("x");
  });
  it("wraps with SGR codes when enabled", () => {
    expect(paint("x", "neon", true)).toContain("x");
    expect(paint("x", "neon", true)).toContain("\x1b[");
  });
});

describe("humanDuration", () => {
  it("formats hours/minutes/seconds", () => {
    expect(humanDuration(9)).toBe("9s");
    expect(humanDuration(125)).toBe("2m 05s");
    expect(humanDuration(3725)).toBe("1h 02m 05s");
  });
});
