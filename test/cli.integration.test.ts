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

  it("edits a logged session's focus and recomputes the end", () => {
    // Log a 6h "runaway" session, then correct focus down to 90m.
    const logged = JSON.parse(
      run(["log", "--duration", "21600", "--goal", "Sleepy", "--json"]).stdout,
    );
    const id = logged.data.id as string;
    const edited = run(["edit", id, "--focus", "90m", "--json"]);
    expect(edited.status).toBe(0);
    const rec = JSON.parse(edited.stdout);
    expect(rec.ok).toBe(true);
    expect(rec.command).toBe("edit");
    expect(rec.data.durationS).toBe(5400);
    // history reflects the corrected duration
    const hist = JSON.parse(run(["history", "--json"]).stdout);
    expect(hist.data.sessions[0].durationS).toBe(5400);
  });

  it("edit accepts a unique id prefix and edits the goal/name", () => {
    const logged = JSON.parse(run(["log", "--duration", "600", "--json"]).stdout);
    const id = logged.data.id as string;
    const r = run(["edit", id.slice(0, 10), "--goal", "Renamed", "--name", "Tag", "--json"]);
    expect(r.status).toBe(0);
    const rec = JSON.parse(r.stdout);
    expect(rec.data.goal).toBe("Renamed");
    expect(rec.data.label).toBe("Tag");
  });

  it("edit with no fields exits USAGE (2)", () => {
    const logged = JSON.parse(run(["log", "--duration", "600", "--json"]).stdout);
    expect(run(["edit", logged.data.id, "--json"]).status).toBe(2);
  });

  it("edit with an unknown id exits USAGE (2)", () => {
    run(["log", "--duration", "600", "--json"]);
    expect(run(["edit", "no-such-id", "--focus", "10m", "--json"]).status).toBe(2);
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
    expect(md.stdout).toContain("| Date | Sessions | Total | Best | Break | Ratio | Goal |");
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

  // WS5 — dashboard is now the default command
  it("default command (no subcommand, non-TTY) emits dashboard snapshot", () => {
    const r = run(["--json"]);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as { ok: boolean; command: string; data: unknown };
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe("dashboard");
  });

  it("--help mentions dashboard", () => {
    const r = run(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("dashboard");
  });

  it("start --bare is an accepted flag (no parse error, still needs TTY/duration)", () => {
    // Non-TTY + --bare + --json + no --duration → NO_TTY (5), not a parse error (2)
    const r = run(["start", "--bare", "--json"]);
    expect(r.status).toBe(5);
  });

  it("headless start --duration 0 --json still logs a session (not the dashboard)", () => {
    const r = run(["start", "--duration", "0", "--json"]);
    expect(r.status).toBe(0);
    const parsed = JSON.parse(r.stdout) as { ok: boolean; command: string; data: { source: string } };
    expect(parsed.ok).toBe(true);
    expect(parsed.command).toBe("start");
    expect(parsed.data.source).toBe("timed");
  });

  it("dashboard --view <invalid> exits USAGE (2), never enters the TUI", () => {
    // Validated before the alt-screen, so a typo can't crash/corrupt the terminal.
    const r = run(["dashboard", "--view", "bogus"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("unknown view");
  });
});
