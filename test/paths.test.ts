import { describe, it, expect } from "vitest";
import { resolvePaths } from "../src/lib/paths.js";
import { join } from "node:path";

describe("resolvePaths", () => {
  it("honors explicit env overrides", () => {
    const p = resolvePaths({
      FLOWCLOCK_CONFIG_DIR: "/x/cfg",
      FLOWCLOCK_DATA_DIR: "/x/data",
    } as NodeJS.ProcessEnv);
    expect(p.configDir).toBe("/x/cfg");
    expect(p.dataDir).toBe("/x/data");
    expect(p.configFile).toBe(join("/x/cfg", "config.json"));
    expect(p.sessionsFile).toBe(join("/x/data", "sessions.json"));
  });

  it("falls back to platform defaults without overrides", () => {
    const p = resolvePaths({
      HOME: "/home/u",
      XDG_CONFIG_HOME: "/home/u/.config",
    } as NodeJS.ProcessEnv);
    expect(p.configFile.endsWith("config.json")).toBe(true);
    expect(p.sessionsFile.endsWith("sessions.json")).toBe(true);
    expect(p.configDir).toContain("flowclock");
  });
});
