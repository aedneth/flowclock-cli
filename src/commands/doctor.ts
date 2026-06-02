import { mkdirSync, writeFileSync, unlinkSync } from "node:fs";
import { join } from "node:path";
import type { CommandContext } from "../lib/context.js";
import { readSessions } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import { jsonSuccess, printJson } from "../lib/output.js";
import { ExitCode } from "../lib/exit.js";

export interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

function checkNode(): Check {
  const major = Number(process.versions.node.split(".")[0]);
  return {
    name: "node-version",
    ok: major >= 20,
    detail: `node ${process.versions.node} (require >= 20)`,
  };
}

function checkWritable(dir: string, label: string): Check {
  try {
    mkdirSync(dir, { recursive: true });
    const probe = join(dir, `.flowclock-write-test-${process.pid}`);
    writeFileSync(probe, "ok");
    unlinkSync(probe);
    return { name: label, ok: true, detail: `writable: ${dir}` };
  } catch (err) {
    return {
      name: label,
      ok: false,
      detail: `not writable: ${dir} (${(err as Error).message})`,
    };
  }
}

function checkSessions(file: string): Check {
  const { sessions, recoveredBackup } = readSessions(file);
  if (recoveredBackup) {
    return {
      name: "sessions-integrity",
      ok: false,
      detail: `corrupt sessions file recovered; backup at ${recoveredBackup}`,
    };
  }
  return {
    name: "sessions-integrity",
    ok: true,
    detail: `${sessions.length} session(s) in ${file}`,
  };
}

function checkTTY(ctx: CommandContext): Check {
  return {
    name: "tty",
    ok: true,
    detail: ctx.isTTY
      ? "interactive TTY (HUD available)"
      : "no TTY (agent mode; use --duration / --json)",
  };
}

export function runDoctor(ctx: CommandContext): ExitCode {
  const sessionsFile = sessionsPathFor(ctx.config, ctx.paths);
  const checks: Check[] = [
    checkNode(),
    checkWritable(ctx.paths.configDir, "config-dir"),
    checkWritable(ctx.paths.dataDir, "data-dir"),
    checkSessions(sessionsFile),
    checkTTY(ctx),
  ];

  const allOk = checks.every((c) => c.ok);

  if (ctx.json) {
    printJson(jsonSuccess("doctor", { ok: allOk, checks }));
  } else {
    for (const c of checks) {
      process.stdout.write(`${c.ok ? "✓" : "✗"} ${c.name}: ${c.detail}\n`);
    }
    process.stdout.write(
      allOk ? "\nAll checks passed.\n" : "\nSome checks failed.\n",
    );
  }

  return allOk ? ExitCode.OK : ExitCode.DOCTOR;
}
