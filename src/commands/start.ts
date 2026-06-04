import type { CommandContext } from "../lib/context.js";
import { Timer } from "../lib/timer.js";
import { renderFrame, renderBigFrame, ANSI } from "../lib/hud.js";
import { startKeyReader, readGoalOutcome } from "../lib/keys.js";
import { appendSession } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import { THEME_FG } from "../lib/theme.js";
import { jsonSuccess, printJson } from "../lib/output.js";
import { ExitCode, fail } from "../lib/exit.js";
import type { Session, SessionSource } from "../schemas/session.js";
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
}

const TICK_MS = 100; // matches flowtime.sh `sleep 0.1`

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
    }),
  );
  return stored;
}

/** Interactive HUD: single centered HH:MM:SS, invisible p/r/q controls. */
function runHud(ctx: CommandContext, opts: StartOptions): Promise<Session> {
  return new Promise<Session>((resolve) => {
    const out = process.stdout;
    const timer = new Timer();
    const source: SessionSource = opts.duration ? "timed" : "hud";
    const theme: ThemeName = (opts.theme as ThemeName) ?? ctx.config.theme;
    const colorOn = ctx.color ? THEME_FG[theme] : undefined;
    const big = opts.big ?? ctx.config.bigFont;

    const render = () => {
      const dims = {
        rows: out.rows ?? 0,
        cols: out.columns ?? 0,
        time: timer.display(),
        colorOn,
        colorOff: ANSI.reset,
      };
      // --big renders the block font, but transparently falls back to the
      // compact HUD when the terminal is too small (renderBigFrame → "").
      const frame = (big && renderBigFrame(dims)) || renderFrame(dims);
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

      // Optional, non-blocking goal hit/miss prompt (3s auto-skip = neutral).
      let goalMet: boolean | null = null;
      if (opts.goal && ctx.isTTY && !ctx.yes) {
        out.write(ANSI.showCursor + ANSI.clear);
        out.write(
          `Goal: ${opts.goal}\r\nDid you meet it? [y/n] (auto-skip in 3s) `,
        );
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
      onReset: () => {
        timer.reset();
        render();
      },
      // q and Ctrl-C both land here — a normal stop+log, exit 0.
      onQuit: finish,
    });
  });
}
