import type { CommandContext } from "../lib/context.js";
import { Timer } from "../lib/timer.js";
import { renderHud, ANSI } from "../lib/hud.js";
import { startKeyReader, readGoalOutcome } from "../lib/keys.js";
import { appendSession } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import { THEME_FG } from "../lib/theme.js";
import { jsonSuccess, printJson } from "../lib/output.js";
import { ExitCode, fail } from "../lib/exit.js";
import { humanDuration } from "../lib/format.js";
import { suggestBreakS } from "../lib/flowtime.js";
import type { Session, SessionSource, BreakCategory } from "../schemas/session.js";
import { ThemeNameSchema, type ThemeName } from "../schemas/config.js";

export interface StartOptions {
  duration?: number;
  label?: string;
  /** The goal/intention for this session (`--goal`). */
  goal?: string;
  /** Theme override for this session only (`--theme`). */
  theme?: ThemeName;
  /** Render the time in big 7-segment ASCII (`--big`). */
  big?: boolean;
  /** Force headless (no HUD) even in a TTY. */
  noHud?: boolean;
  /** Focus target in seconds (`--target`). */
  target?: number;
  /** Break budget in seconds (`--break-budget`). */
  breakBudget?: number;
  /** Minimal HUD: clock only (`--zen`). */
  zen?: boolean;
}

const TICK_MS = 100; // matches flowtime.sh `sleep 0.1`

/** Ordered break categories — digit keys 1..6 map to this array. */
const BREAK_CATEGORIES: BreakCategory[] = [
  "rest",
  "meal",
  "exercise",
  "walk",
  "distraction",
  "other",
];

export async function runStart(
  ctx: CommandContext,
  opts: StartOptions,
): Promise<void> {
  // Validate an explicit --theme override early (clear USAGE error vs a silent
  // fallback). When omitted, the configured theme is used.
  if (opts.theme !== undefined) {
    const parsed = ThemeNameSchema.safeParse(opts.theme);
    if (!parsed.success) {
      fail(
        ExitCode.USAGE,
        `unknown theme '${opts.theme}' (expected: neon|amber|blue|mono)`,
      );
    }
  }

  const headless = opts.noHud === true || !ctx.isTTY;

  if (headless && opts.duration === undefined) {
    fail(
      ExitCode.NO_TTY,
      "no TTY for the HUD. Run with --duration <seconds> for a headless timed session, or in an interactive terminal.",
    );
  }

  const session = headless
    ? await runHeadless(ctx, opts)
    : await runHud(ctx, opts);

  if (ctx.json) printJson(jsonSuccess("start", session));
  else ctx.logger.info(`logged session ${session.id} (${session.durationS}s)`);
}

/** Headless timed session: wait `duration` seconds, then log. */
async function runHeadless(
  ctx: CommandContext,
  opts: StartOptions,
): Promise<Session> {
  const timer = new Timer();
  await new Promise<void>((resolve) =>
    setTimeout(resolve, (opts.duration ?? 0) * 1000),
  );
  const stored = appendSession(
    sessionsPathFor(ctx.config, ctx.paths),
    timer.toSession({
      source: "timed",
      label: opts.label ?? null,
      goal: opts.goal ?? null,
      focusTargetS: opts.target ?? null,
      breakBudgetS: opts.breakBudget ?? null,
    }),
  );
  return stored;
}

/** Interactive HUD: Flowtime session with break support + controls footer. */
function runHud(ctx: CommandContext, opts: StartOptions): Promise<Session> {
  return new Promise<Session>((resolve) => {
    const out = process.stdout;
    const timer = new Timer();
    const source: SessionSource = opts.duration ? "timed" : "hud";
    const theme: ThemeName = (opts.theme as ThemeName) ?? ctx.config.theme;
    const colorOn = ctx.color ? THEME_FG[theme] : undefined;
    const style =
      opts.big ?? ctx.config.bigFont ? "block" : ctx.config.displayStyle;
    const zen = !!opts.zen;
    const showControls = zen ? false : ctx.config.showControls;

    const render = () => {
      const frame = renderHud({
        rows: out.rows ?? 0,
        cols: out.columns ?? 0,
        time: timer.display(),
        style,
        colorOn,
        colorOff: ANSI.reset,
        zen,
        showControls,
        onBreak: timer.isOnBreak,
        focusS: timer.elapsedS(),
        totalBreakS: timer.totalBreakS(),
        currentBreakS: timer.currentBreakS(),
        breakCategory: timer.currentBreakCategory,
        suggestedBreakS: suggestBreakS(timer.elapsedS()),
        goal: opts.goal ?? null,
        focusTargetS: opts.target ?? null,
        breakBudgetS: opts.breakBudget ?? null,
        keybindings: ctx.config.keybindings,
      });
      if (frame) out.write(frame);
    };

    let finished = false;
    let stopKeys = () => {};
    let interval: NodeJS.Timeout;

    const finish = async () => {
      if (finished) return;
      finished = true;
      clearInterval(interval);
      out.off("resize", render);
      stopKeys();
      process.off("SIGTERM", finish);

      // End any open break so toSession() gets the final totals.
      if (timer.isOnBreak) timer.endBreak();

      // End-of-session summary (TTY && !headless && !json && !yes).
      if (ctx.isTTY && !ctx.json) {
        out.write(ANSI.showCursor + ANSI.clear);
        writeSummary(out, timer, opts, colorOn ?? "");
      }

      // Optional, non-blocking goal hit/miss prompt (3s auto-skip = neutral).
      let goalMet: boolean | null = null;
      if (opts.goal && ctx.isTTY && !ctx.yes) {
        out.write(`\r\nGoal: ${opts.goal}\r\nDid you meet it? [y/n] (auto-skip in 3s) `);
        goalMet = await readGoalOutcome(process.stdin, { timeoutMs: 3000 });
      }

      out.write(ANSI.showCursor + ANSI.clear);
      const stored = appendSession(
        sessionsPathFor(ctx.config, ctx.paths),
        timer.toSession({
          source,
          label: opts.label ?? null,
          goal: opts.goal ?? null,
          goalMet,
          focusTargetS: opts.target ?? null,
          breakBudgetS: opts.breakBudget ?? null,
        }),
      );
      resolve(stored);
    };

    out.write(ANSI.hideCursor);
    render();

    interval = setInterval(() => {
      if (opts.duration !== undefined && timer.elapsedS() >= opts.duration) {
        finish();
        return;
      }
      render();
    }, TICK_MS);

    out.on("resize", render);
    process.once("SIGTERM", finish);

    stopKeys = startKeyReader(process.stdin, ctx.config.keybindings, {
      onPause: () => {
        timer.togglePause();
        render();
      },
      onBreak: () => {
        if (timer.isOnBreak) {
          timer.endBreak();
        } else {
          timer.startBreak("rest", null, suggestBreakS(timer.elapsedS()));
        }
        render();
      },
      onDigit: (n: number) => {
        const cat = BREAK_CATEGORIES[n - 1];
        if (!cat) return;
        if (timer.isOnBreak) {
          timer.setBreakCategory(cat);
        } else {
          timer.startBreak(cat, null, suggestBreakS(timer.elapsedS()));
        }
        render();
      },
      onCategory: () => {
        if (!timer.isOnBreak) return;
        const current = timer.currentBreakCategory;
        const idx = BREAK_CATEGORIES.indexOf(current);
        const next = BREAK_CATEGORIES[(idx + 1) % BREAK_CATEGORIES.length] ?? "rest";
        timer.setBreakCategory(next);
        render();
      },
      onReset: () => {
        timer.reset();
        render();
      },
      // q and Ctrl-C both land here — a normal stop+log, exit 0.
      onQuit: finish,
    });
  });
}

/** Write an end-of-session summary block to stdout. */
function writeSummary(
  out: NodeJS.WriteStream,
  timer: Timer,
  opts: StartOptions,
  colorOn: string,
): void {
  const focusS = timer.elapsedS();
  const totalBreakS = timer.totalBreakS();
  const reset = colorOn ? ANSI.reset : "";

  out.write(`${colorOn}── Session Summary ──${reset}\r\n`);
  out.write(`  Focus total:  ${humanDuration(focusS)}\r\n`);
  out.write(`  Break total:  ${humanDuration(totalBreakS)}\r\n`);

  // Per-category breakdown — we need to reconstruct from session snapshot
  // Use a temporary toSession to read the closed breaks list.
  const snap = timer.toSession({ source: "hud" });
  if (snap.breaks.length > 0) {
    const byCategory = new Map<BreakCategory, number>();
    for (const b of snap.breaks) {
      byCategory.set(b.category, (byCategory.get(b.category) ?? 0) + b.durationS);
    }
    for (const [cat, s] of byCategory) {
      out.write(`    ${cat}: ${humanDuration(s)}\r\n`);
    }
  }

  if (focusS > 0 && totalBreakS > 0) {
    const ratio = totalBreakS / focusS;
    out.write(`  Focus:rest ratio: 1:${ratio.toFixed(1)}\r\n`);
  }

  if (opts.target != null) {
    const met = focusS >= opts.target;
    out.write(
      `  Target (${humanDuration(opts.target)}): ${met ? "✓ met" : "✗ not met"}\r\n`,
    );
  }

  if (opts.breakBudget != null) {
    const ok = totalBreakS <= opts.breakBudget;
    out.write(
      `  Break budget (${humanDuration(opts.breakBudget)}): ${ok ? "✓ within budget" : "✗ over budget"}\r\n`,
    );
  }

  out.write("\r\n");
}
