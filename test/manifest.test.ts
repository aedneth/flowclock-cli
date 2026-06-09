import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { buildManifest } from "../src/lib/manifest.js";
import { VERSION } from "../src/version.js";

describe("manifest", () => {
  const m = buildManifest();

  it("lists every public command", () => {
    const names = m.commands.map((c) => c.name).sort();
    expect(names).toEqual(
      [
        "completion",
        "config",
        "dashboard",
        "doctor",
        "goals",
        "history",
        "log",
        "manifest",
        "mcp",
        "start",
        "stats",
        "summary",
      ].sort(),
    );
  });

  it("dashboard command is present with --json example", () => {
    const dashboard = m.commands.find((c) => c.name === "dashboard");
    expect(dashboard).toBeDefined();
    expect(dashboard!.examples).toContain("flowclock dashboard --json");
    expect(dashboard!.jsonData).toContain("DashboardSnapshot");
  });

  it("start command exposes --target, --break-budget, and --zen flags", () => {
    const start = m.commands.find((c) => c.name === "start")!;
    const flagNames = (start.flags ?? []).map((f) => f.name);
    expect(flagNames).toContain("--target");
    expect(flagNames).toContain("--break-budget");
    expect(flagNames).toContain("--zen");
  });

  it("start jsonData mentions v3 session fields", () => {
    const start = m.commands.find((c) => c.name === "start")!;
    expect(start.jsonData).toContain("breaks[]");
    expect(start.jsonData).toContain("breakS");
    expect(start.jsonData).toContain("focusTargetS");
    expect(start.jsonData).toContain("breakBudgetS");
  });

  it("log command exposes --target and --break-budget flags", () => {
    const log = m.commands.find((c) => c.name === "log")!;
    const flagNames = (log.flags ?? []).map((f) => f.name);
    expect(flagNames).toContain("--target");
    expect(flagNames).toContain("--break-budget");
  });

  it("documents all exit codes", () => {
    const codes = m.exitCodes.map((e) => e.code);
    expect(codes).toEqual(expect.arrayContaining([0, 1, 2, 3, 4, 5, 6]));
  });

  it("declares the global flags agents rely on", () => {
    const flags = m.globalFlags.map((f) => f.name);
    expect(flags).toEqual(
      expect.arrayContaining(["--json", "--yes", "--no-color"]),
    );
  });

  it("version matches package.json", () => {
    const pkgUrl = new URL("../package.json", import.meta.url);
    const pkg = JSON.parse(readFileSync(fileURLToPath(pkgUrl), "utf8"));
    expect(m.version).toBe(VERSION);
    expect(pkg.version).toBe(VERSION);
  });
});
