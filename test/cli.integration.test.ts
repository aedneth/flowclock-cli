import { describe, it, expect, beforeAll, beforeEach, afterEach } from "vitest";
import { execFileSync, type ExecFileSyncOptions } from "node:child_process";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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
    expect(run(["--version"]).stdout.trim()).toBe("0.1.0");
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
});
