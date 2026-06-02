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
