import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  sessionsPathFor,
} from "../src/lib/config.js";
import { DEFAULT_CONFIG } from "../src/schemas/config.js";
import { FlowclockError, ExitCode } from "../src/lib/exit.js";
import type { FlowclockPaths } from "../src/lib/paths.js";

let dir: string;
let paths: FlowclockPaths;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fc-cfg-"));
  paths = {
    configDir: dir,
    dataDir: dir,
    configFile: join(dir, "config.json"),
    sessionsFile: join(dir, "sessions.json"),
  };
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

describe("config load/save", () => {
  it("returns defaults when no file exists", () => {
    expect(loadConfig(paths)).toEqual(DEFAULT_CONFIG);
  });

  it("round-trips a saved config", () => {
    const next = setConfigValue(DEFAULT_CONFIG, "theme", "blue");
    saveConfig(next, paths);
    expect(loadConfig(paths).theme).toBe("blue");
  });

  it("throws CONFIG on invalid JSON", () => {
    writeFileSync(paths.configFile, "{bad");
    try {
      loadConfig(paths);
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(FlowclockError);
      expect((err as FlowclockError).code).toBe(ExitCode.CONFIG);
    }
  });
});

describe("get/set values", () => {
  it("reads nested keybindings", () => {
    expect(getConfigValue(DEFAULT_CONFIG, "keybindings.pause")).toBe("p");
  });

  it("reads new keybinding defaults", () => {
    expect(getConfigValue(DEFAULT_CONFIG, "keybindings.break")).toBe("b");
    expect(getConfigValue(DEFAULT_CONFIG, "keybindings.category")).toBe("c");
  });

  it("rejects unsettable keys", () => {
    expect(() => setConfigValue(DEFAULT_CONFIG, "schemaVersion", "9")).toThrow(
      FlowclockError,
    );
  });

  it("coerces booleans for bigFont", () => {
    expect(setConfigValue(DEFAULT_CONFIG, "bigFont", "true").bigFont).toBe(
      true,
    );
    expect(setConfigValue(DEFAULT_CONFIG, "bigFont", "false").bigFont).toBe(
      false,
    );
  });

  it("treats empty/null string as null for sessionsPath", () => {
    expect(
      setConfigValue(DEFAULT_CONFIG, "sessionsPath", "null").sessionsPath,
    ).toBeNull();
  });

  it("validates enum values on set", () => {
    expect(() => setConfigValue(DEFAULT_CONFIG, "theme", "purple")).toThrow(
      FlowclockError,
    );
  });

  it("sets and gets displayStyle", () => {
    const cfg = setConfigValue(DEFAULT_CONFIG, "displayStyle", "block");
    expect(cfg.displayStyle).toBe("block");
    expect(getConfigValue(cfg, "displayStyle")).toBe("block");
  });

  it("rejects invalid displayStyle", () => {
    expect(() =>
      setConfigValue(DEFAULT_CONFIG, "displayStyle", "fancy"),
    ).toThrow(FlowclockError);
  });

  it("sets and gets showControls", () => {
    expect(
      setConfigValue(DEFAULT_CONFIG, "showControls", "true").showControls,
    ).toBe(true);
    expect(
      setConfigValue(DEFAULT_CONFIG, "showControls", "1").showControls,
    ).toBe(true);
    expect(
      setConfigValue(DEFAULT_CONFIG, "showControls", "false").showControls,
    ).toBe(false);
    expect(getConfigValue(DEFAULT_CONFIG, "showControls")).toBe(true);
  });

  it("sets and gets dailyFocusGoalS", () => {
    const cfg = setConfigValue(DEFAULT_CONFIG, "dailyFocusGoalS", "7200");
    expect(cfg.dailyFocusGoalS).toBe(7200);
    expect(getConfigValue(cfg, "dailyFocusGoalS")).toBe(7200);
  });

  it("rejects invalid dailyFocusGoalS (zero/negative)", () => {
    expect(() =>
      setConfigValue(DEFAULT_CONFIG, "dailyFocusGoalS", "0"),
    ).toThrow(FlowclockError);
    expect(() =>
      setConfigValue(DEFAULT_CONFIG, "dailyFocusGoalS", "-100"),
    ).toThrow(FlowclockError);
  });

  it("sets and gets keybindings.break", () => {
    const cfg = setConfigValue(DEFAULT_CONFIG, "keybindings.break", "k");
    expect(cfg.keybindings.break).toBe("k");
    expect(getConfigValue(cfg, "keybindings.break")).toBe("k");
  });

  it("sets and gets keybindings.category", () => {
    const cfg = setConfigValue(DEFAULT_CONFIG, "keybindings.category", "x");
    expect(cfg.keybindings.category).toBe("x");
    expect(getConfigValue(cfg, "keybindings.category")).toBe("x");
  });

  it("rejects multi-char keybinding values", () => {
    expect(() =>
      setConfigValue(DEFAULT_CONFIG, "keybindings.break", "bb"),
    ).toThrow(FlowclockError);
    expect(() =>
      setConfigValue(DEFAULT_CONFIG, "keybindings.category", "cc"),
    ).toThrow(FlowclockError);
  });
});

describe("sessionsPathFor", () => {
  it("uses the default data dir when unset", () => {
    expect(sessionsPathFor(DEFAULT_CONFIG, paths)).toBe(paths.sessionsFile);
  });
  it("honors an explicit override", () => {
    const cfg = setConfigValue(
      DEFAULT_CONFIG,
      "sessionsPath",
      "/custom/s.json",
    );
    expect(sessionsPathFor(cfg, paths)).toBe("/custom/s.json");
  });
});
