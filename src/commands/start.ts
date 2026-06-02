import type { CommandContext } from "../lib/context.js";
import { Timer } from "../lib/timer.js";
import { renderFrame, ANSI } from "../lib/hud.js";
import { startKeyReader } from "../lib/keys.js";
import { appendSession } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import { THEME_FG } from "../lib/theme.js";
import { jsonSuccess, printJson } from "../lib/output.js";
import { ExitCode, fail } from "../lib/exit.js";
import type { Session, SessionSource } from "../schemas/session.js";

export interface StartOptions {
  duration?: number;
  label?: string;
  /** Force headless (no HUD) even in a TTY. */
  noHud?: boolean;
}

const TICK_MS = 100; // matches flowtime.sh `sleep 0.1`

export async function runStart(
  ctx: CommandContext,
  opts: StartOptions,
): Promise<void> {
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
    timer.toSession({ source: "timed", label: opts.label ?? null }),
  );
  return stored;
}

/** Interactive HUD: single centered HH:MM:SS, invisible p/r/q controls. */
function runHud(ctx: CommandContext, opts: StartOptions): Promise<Session> {
  return new Promise<Session>((resolve) => {
    const out = process.stdout;
    const timer = new Timer();
    const source: SessionSource = opts.duration ? "timed" : "hud";
    const colorOn = ctx.color ? THEME_FG[ctx.config.theme] : undefined;

    const render = () => {
      const frame = renderFrame({
        rows: out.rows ?? 0,
        cols: out.columns ?? 0,
        time: timer.display(),
        colorOn,
        colorOff: ANSI.reset,
      });
      if (frame) out.write(frame);
    };

    let finished = false;
    let stopKeys = () => {};
    let interval: NodeJS.Timeout;

    const finish = () => {
      if (finished) return;
      finished = true;
      clearInterval(interval);
      out.off("resize", render);
      stopKeys();
      process.off("SIGTERM", finish);
      out.write(ANSI.showCursor + ANSI.clear);
      const stored = appendSession(
        sessionsPathFor(ctx.config, ctx.paths),
        timer.toSession({ source, label: opts.label ?? null }),
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
