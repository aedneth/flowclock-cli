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
