/**
 * Interactive TUI dashboard application.
 *
 * Manages state, composes frames, and handles keyboard input.
 * Runs until the user quits (q / Esc / Ctrl-C) or a signal arrives.
 */

import type { CommandContext } from "../lib/context.js";
import type { Session } from "../schemas/session.js";
import { buildSnapshot } from "../lib/snapshot.js";
import { readSessions } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import { Screen } from "../lib/tui/screen.js";
import { startNavReader } from "../lib/tui/input.js";
import { splitV } from "../lib/tui/layout.js";
import type { Rect } from "../lib/tui/layout.js";
import { padTo } from "../lib/tui/draw.js";
import { paint, THEME_FG } from "../lib/theme.js";
import { renderOverview } from "./views/overview.js";
import { renderSessions, sessionDetail } from "./views/sessions.js";
import type { SessionsState } from "./views/sessions.js";
import { renderGoals } from "./views/goals.js";
import { renderBreaks } from "./views/breaks.js";

type ViewName = "overview" | "sessions" | "goals" | "breaks";

interface AppState {
  view: ViewName;
  sessions: Session[];
  selectedIndex: number;
  scrollTop: number;
  detailOpen: boolean;
}

const VIEWS: ViewName[] = ["overview", "sessions", "goals", "breaks"];
const VIEW_LABELS: Record<ViewName, string> = {
  overview: "1:Overview",
  sessions: "2:Sessions",
  goals: "3:Goals",
  breaks: "4:Breaks",
};

const CTRL_C = "\x03";

/** Build the full frame (header + body + footer) as an array of row strings. */
function buildFrame(
  state: AppState,
  cols: number,
  rows: number,
  ctx: CommandContext,
): string[] {
  const snap = buildSnapshot(state.sessions, ctx.config.dailyFocusGoalS);
  const theme = ctx.config.theme;
  const color = ctx.color;

  // Layout: header(1) + body(flex) + footer(1)
  const fullRect: Rect = { top: 0, left: 0, width: cols, height: rows };
  const [headerRect, bodyRect, footerRect] = splitV(fullRect, [1, { flex: 1 }, 1]);

  const frame: string[] = [];

  // Header
  const genAt = new Date(snap.generatedAt).toLocaleTimeString();
  const viewTabs = VIEWS.map((v) =>
    v === state.view
      ? color
        ? `${THEME_FG[theme]}[${VIEW_LABELS[v]}]\x1b[0m`
        : `[${VIEW_LABELS[v]}]`
      : ` ${VIEW_LABELS[v]} `,
  ).join(" ");
  const title = color
    ? paint("Flowclock Dashboard", theme, true)
    : "Flowclock Dashboard";
  const headerRight = `${genAt} ${viewTabs}`;
  const headerLeft = title;
  const headerLine = padTo(
    `${headerLeft}  ${headerRight}`,
    cols,
  );
  if (headerRect) frame.push(headerLine);

  // Body
  if (bodyRect && bodyRect.height > 0) {
    const sessState: SessionsState = {
      selectedIndex: state.selectedIndex,
      scrollTop: state.scrollTop,
      detailOpen: state.detailOpen,
    };

    let bodyRows: string[];

    if (state.detailOpen && state.view === "sessions") {
      const session = snap.recent[state.selectedIndex];
      if (session) {
        bodyRows = sessionDetail(session, bodyRect, theme, color);
      } else {
        bodyRows = renderSessions(snap, bodyRect, sessState, theme, color);
      }
    } else {
      switch (state.view) {
        case "overview":
          bodyRows = renderOverview(snap, bodyRect, {}, theme, color);
          break;
        case "sessions":
          bodyRows = renderSessions(snap, bodyRect, sessState, theme, color);
          break;
        case "goals":
          bodyRows = renderGoals(snap, bodyRect, {}, theme, color);
          break;
        case "breaks":
          bodyRows = renderBreaks(snap, bodyRect, {}, theme, color);
          break;
      }
    }

    frame.push(...bodyRows);
  }

  // Footer
  const footerHints = "[Tab] view · [↑↓] move · [Enter] detail · [r] refresh · [q] quit";
  const footerLine = padTo(footerHints, cols);
  if (footerRect) frame.push(footerLine);

  // Ensure exactly `rows` lines (pad if needed)
  while (frame.length < rows) frame.push(" ".repeat(cols));
  return frame.slice(0, rows);
}

/**
 * Run the interactive dashboard TUI.
 *
 * Resolves when the user quits or a SIGINT/SIGTERM arrives.
 */
export async function runDashboardApp(
  ctx: CommandContext,
  sessions: Session[],
): Promise<void> {
  return new Promise<void>((resolve) => {
    const state: AppState = {
      view: "overview",
      sessions,
      selectedIndex: 0,
      scrollTop: 0,
      detailOpen: false,
    };

    const screen = new Screen(process.stdout);
    let stopReader: (() => void) | null = null;

    function getTermSize(): { cols: number; rows: number } {
      const cols = process.stdout.columns ?? 80;
      const rows = process.stdout.rows ?? 24;
      return { cols, rows };
    }

    function render() {
      const { cols, rows } = getTermSize();
      const frame = buildFrame(state, cols, rows, ctx);
      screen.render(frame);
    }

    function cleanup() {
      if (stopReader) {
        stopReader();
        stopReader = null;
      }
      process.stdout.removeListener("resize", render);
      process.removeListener("SIGINT", handleSignal);
      process.removeListener("SIGTERM", handleSignal);
      screen.exit();
      resolve();
    }

    function handleSignal() {
      cleanup();
    }

    function clampSelection(newSnap = buildSnapshot(state.sessions, ctx.config.dailyFocusGoalS)) {
      const max = Math.max(0, newSnap.recent.length - 1);
      state.selectedIndex = Math.max(0, Math.min(state.selectedIndex, max));
      // Adjust scroll so selectedIndex is visible
      const { rows } = getTermSize();
      const visibleRows = Math.max(1, rows - 3); // header + footer + panel borders
      if (state.selectedIndex < state.scrollTop) {
        state.scrollTop = state.selectedIndex;
      } else if (state.selectedIndex >= state.scrollTop + visibleRows) {
        state.scrollTop = state.selectedIndex - visibleRows + 1;
      }
    }

    stopReader = startNavReader(process.stdin, (key) => {
      if (key.name === "tab") {
        const idx = VIEWS.indexOf(state.view);
        state.view = VIEWS[(idx + 1) % VIEWS.length]!;
        state.detailOpen = false;
        render();
        return;
      }

      if (key.name === "char") {
        const ch = key.char;

        // Quit
        if (ch === "q" || ch === CTRL_C) {
          cleanup();
          return;
        }

        // Switch views by number
        if (ch === "1") { state.view = "overview"; state.detailOpen = false; render(); return; }
        if (ch === "2") { state.view = "sessions"; state.detailOpen = false; render(); return; }
        if (ch === "3") { state.view = "goals"; state.detailOpen = false; render(); return; }
        if (ch === "4") { state.view = "breaks"; state.detailOpen = false; render(); return; }

        // j/k navigation (vim-style)
        if (ch === "j" && state.view === "sessions") {
          const snap = buildSnapshot(state.sessions, ctx.config.dailyFocusGoalS);
          state.selectedIndex = Math.min(snap.recent.length - 1, state.selectedIndex + 1);
          clampSelection(snap);
          render();
          return;
        }
        if (ch === "k" && state.view === "sessions") {
          state.selectedIndex = Math.max(0, state.selectedIndex - 1);
          clampSelection();
          render();
          return;
        }

        // Refresh
        if (ch === "r") {
          const file = sessionsPathFor(ctx.config, ctx.paths);
          const { sessions: fresh } = readSessions(file);
          state.sessions = fresh;
          state.selectedIndex = 0;
          state.scrollTop = 0;
          state.detailOpen = false;
          screen.enter(); // re-enter clears the screen for full redraw
          render();
          return;
        }
      }

      if (key.name === "escape") {
        if (state.detailOpen) {
          state.detailOpen = false;
          render();
        } else {
          cleanup();
        }
        return;
      }

      if (key.name === "enter" && state.view === "sessions") {
        state.detailOpen = !state.detailOpen;
        render();
        return;
      }

      if (key.name === "up" && state.view === "sessions") {
        state.selectedIndex = Math.max(0, state.selectedIndex - 1);
        clampSelection();
        render();
        return;
      }

      if (key.name === "down" && state.view === "sessions") {
        const snap = buildSnapshot(state.sessions, ctx.config.dailyFocusGoalS);
        state.selectedIndex = Math.min(snap.recent.length - 1, state.selectedIndex + 1);
        clampSelection(snap);
        render();
        return;
      }
    });

    process.on("SIGINT", handleSignal);
    process.on("SIGTERM", handleSignal);
    process.stdout.on("resize", render);

    // Initial render
    screen.enter();
    render();
  });
}
