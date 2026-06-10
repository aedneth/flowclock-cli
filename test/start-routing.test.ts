/**
 * Unit tests for shouldUseDashboard — the routing predicate that decides
 * whether `flowclock start` opens the unified dashboard or falls back to
 * the legacy headless / standalone-HUD path.
 */

import { describe, it, expect } from "vitest";
import { shouldUseDashboard } from "../src/commands/start.js";

describe("shouldUseDashboard", () => {
  it("returns true for a plain TTY session (no special flags)", () => {
    expect(shouldUseDashboard({}, true, false)).toBe(true);
  });

  it("returns false when isTTY=false (non-TTY / agent / pipe)", () => {
    expect(shouldUseDashboard({}, false, false)).toBe(false);
  });

  it("returns false when json=true", () => {
    expect(shouldUseDashboard({}, true, true)).toBe(false);
  });

  it("returns false when --bare is set", () => {
    expect(shouldUseDashboard({ bare: true }, true, false)).toBe(false);
  });

  it("returns false when --zen is set", () => {
    expect(shouldUseDashboard({ zen: true }, true, false)).toBe(false);
  });

  it("returns false when --no-hud is set (noHud=true)", () => {
    expect(shouldUseDashboard({ noHud: true }, true, false)).toBe(false);
  });

  it("returns false when --duration is set", () => {
    expect(shouldUseDashboard({ duration: 60 }, true, false)).toBe(false);
  });

  it("returns false when --duration is 0 (timed/headless)", () => {
    expect(shouldUseDashboard({ duration: 0 }, true, false)).toBe(false);
  });

  it("returns true when bare=false explicitly (not set)", () => {
    expect(shouldUseDashboard({ bare: false }, true, false)).toBe(true);
  });

  it("returns true when zen=false explicitly", () => {
    expect(shouldUseDashboard({ zen: false }, true, false)).toBe(true);
  });

  it("returns false with bare+TTY+any-json combination", () => {
    expect(shouldUseDashboard({ bare: true }, true, true)).toBe(false);
  });

  it("returns false with duration+TTY (timed always headless)", () => {
    expect(shouldUseDashboard({ duration: 3600 }, true, false)).toBe(false);
  });
});
