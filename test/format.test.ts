import { describe, it, expect } from "vitest";
import { parseDurationToS, humanDuration } from "../src/lib/format.js";

describe("parseDurationToS", () => {
  it("parses 1h30m", () => {
    expect(parseDurationToS("1h30m")).toBe(5400);
  });

  it("parses 90m", () => {
    expect(parseDurationToS("90m")).toBe(5400);
  });

  it("parses 45s", () => {
    expect(parseDurationToS("45s")).toBe(45);
  });

  it("parses 1h", () => {
    expect(parseDurationToS("1h")).toBe(3600);
  });

  it("parses 1h30m15s", () => {
    expect(parseDurationToS("1h30m15s")).toBe(5415);
  });

  it("parses bare integer as seconds", () => {
    expect(parseDurationToS("3600")).toBe(3600);
    expect(parseDurationToS("0")).toBe(0);
    expect(parseDurationToS("60")).toBe(60);
  });

  it("throws on 'abc'", () => {
    expect(() => parseDurationToS("abc")).toThrow(/invalid duration/);
  });

  it("throws on empty string", () => {
    expect(() => parseDurationToS("")).toThrow(/invalid duration/);
  });

  it("throws on '1x' (unknown unit)", () => {
    expect(() => parseDurationToS("1x")).toThrow(/invalid duration/);
  });

  it("throws on '1h30m garbage'", () => {
    // Has extra text after valid portion — should fail
    expect(() => parseDurationToS("1h30m garbage")).toThrow(/invalid duration/);
  });

  it("parses with surrounding whitespace", () => {
    // trim() is applied, so this should work
    expect(parseDurationToS("  30m  ")).toBe(1800);
  });
});

describe("humanDuration (existing, unchanged)", () => {
  it("formats hours correctly", () => {
    expect(humanDuration(3661)).toBe("1h 01m 01s");
  });

  it("formats minutes correctly", () => {
    expect(humanDuration(125)).toBe("2m 05s");
  });

  it("formats seconds correctly", () => {
    expect(humanDuration(9)).toBe("9s");
  });

  it("clamps negatives to 0", () => {
    expect(humanDuration(-5)).toBe("0s");
  });
});
