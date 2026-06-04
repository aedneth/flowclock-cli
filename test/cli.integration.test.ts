import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { VERSION } from "../src/version.js";

const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
let home: string;

beforeAll(() => {
  if (!existsSync(CLI)) {
    throw new Error(
      "dist/cli.js not found — run `npm run build` before integration tests.",
    );
  }
});

beforeEach(() => {
  home = mkdtempSync(join(tmpdir(), "fc-cli-"));
});
afterEach(() => rmSync(home, { recursive: true, force: true }));

interface Run {
  status: number;
  stdout: string;
  stderr: string;
}

function run(args: string[], input?: string): Run {
  const opts: ExecFileSyncOptions = {
    env: {
      ...process.env,
      FLOWCLOCK_CONFIG_DIR: join(home, "config"),
      FLOWCLOCK_DATA_DIR: join(home, "data"),
      NO_COLOR: "1",
    },
    encoding: "utf8",
    input,
  };
  try {
    const stdout = execFileSync(
      "node",
      [CLI, ...args],
      opts,
    ) as unknown as string;
    return { status: 0, stdout, stderr: "" };
  } catch (err) {
    const e = err as { status?: number; stdout?: string; stderr?: string };
    return {
      status: e.status ?? 1,
      stdout: String(e.stdout ?? ""),
      stderr: String(e.stderr ?? ""),
    };
  }
}

describe("flowclock CLI", () => {
  it("prints version", () => {
    expect(run(["--version"]).stdout.trim()).toBe(VERSION);
  });

  it("emits a manifest with all commands", () => {
    const out = JSON.parse(run(["manifest", "--json"]).stdout);
    expect(out.ok).toBe(true);
    expect(out.data.commands.map((c: { name: string }) => c.name)).toContain(
      "start",
    );
  });

  it("logs a session then reports it in stats and history", () => {
    expect(
      run(["log", "--duration", "600", "--label", "x", "--json"]).status,
    ).toBe(0);
    const stats = JSON.parse(run(["stats", "--json"]).stdout);
    expect(stats.data.allTimeCount).toBe(1);
    const hist = JSON.parse(run(["history", "--json"]).stdout);
    expect(hist.data.count).toBe(1);
    expect(hist.data.sessions[0].label).toBe("x");
  });

  it("accepts a session on stdin", () => {
    const payload = JSON.stringify({
      start: "2026-05-30T10:00:00.000Z",
      end: "2026-05-30T10:30:00.000Z",
      durationS: 1800,
      source: "log",
    });
    expect(run(["log", "--json"], payload).status).toBe(0);
    expect(JSON.parse(run(["stats", "--json"]).stdout).data.allTimeTotalS).toBe(
      1800,
    );
  });

  it("exits NO_TTY (5) when start has no TTY and no --duration", () => {
    expect(run(["start", "--json"]).status).toBe(5);
  });

  it("exits USAGE (2) on invalid config value", () => {
    expect(run(["config", "set", "theme", "purple"]).status).toBe(2);
  });

  it("doctor passes in a fresh environment", () => {
    const r = run(["doctor", "--json"]);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).data.ok).toBe(true);
  });

  it("runs a short headless timed session", () => {
    const r = run(["start", "--duration", "0", "--no-hud", "--json"]);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).data.source).toBe("timed");
  });

  it("logs a goal and rolls it up in goals", () => {
    expect(
      run(["log", "--duration", "1500", "--goal", "Ship v1", "--json"]).status,
    ).toBe(0);
    const goals = JSON.parse(run(["goals", "--json"]).stdout);
    expect(goals.data.count).toBe(1);
    expect(goals.data.goals[0].goal).toBe("Ship v1");
    expect(goals.data.goals[0].totalS).toBe(1500);
  });

  it("reports streak fields in stats", () => {
    run(["log", "--duration", "600", "--json"]);
    const stats = JSON.parse(run(["stats", "--json"]).stdout);
    expect(stats.data.currentStreak).toBe(1);
    expect(stats.data).toHaveProperty("longestStreak");
    expect(stats.data).toHaveProperty("lastSessionDate");
  });

  it("emits a markdown week summary and rejects a bad week", () => {
    const md = run(["summary", "--week", "2026-23"]);
    expect(md.status).toBe(0);
    expect(md.stdout).toContain("| Date | Sessions | Total | Best | Goal |");
    expect(run(["summary", "--week", "garbage"]).status).toBe(2);
  });

  it("prints completion scripts and rejects an unknown shell", () => {
    for (const shell of ["bash", "zsh", "fish"]) {
      const r = run(["completion", shell]);
      expect(r.status).toBe(0);
      expect(r.stdout).toContain("flowclock");
    }
    expect(run(["completion", "powershell"]).status).toBe(2);
  });

  it("rejects an unknown --theme on start (USAGE)", () => {
    expect(run(["start", "--theme", "purple", "--duration", "0"]).status).toBe(
      2,
    );
  });
});
