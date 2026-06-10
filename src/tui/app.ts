/**
 * Interactive TUI dashboard application.
 *
 * Manages state, composes frames, and handles keyboard input.
 * Runs until the user quits (q / Esc / Ctrl-C) or a signal arrives.
 *
 * WS5: unified dashboard — hosts a live Flowtime session, palette overlay,
 * summary modal, and all static views in one alt-screen TUI.
 */

import type { CommandContext } from "../lib/context.js";
import type { Session } from "../schemas/session.js";
import type { ThemeName } from "../schemas/config.js";
import type { BreakCategory } from "../schemas/session.js";
import { buildSnapshot } from "../lib/snapshot.js";
import { readSessions, appendSession } from "../lib/session.js";
import { sessionsPathFor } from "../lib/config.js";
import { Timer } from "../lib/timer.js";
import { suggestBreakS } from "../lib/flowtime.js";
import { humanDuration } from "../lib/format.js";
import { Screen } from "../lib/tui/screen.js";
import { startNavReader } from "../lib/tui/input.js";
import { splitV } from "../lib/tui/layout.js";
import type { Rect } from "../lib/tui/layout.js";
import { padTo, truncate, displayWidth, panel } from "../lib/tui/draw.js";
import { paint, THEME_FG } from "../lib/theme.js";
import { renderOverview } from "./views/overview.js";
import { renderSessions, sessionDetail } from "./views/sessions.js";
import type { SessionsState } from "./views/sessions.js";
import { renderGoals } from "./views/goals.js";
import { renderBreaks } from "./views/breaks.js";
import { renderSession } from "./views/session.js";
import type { SessionViewState } from "./views/session.js";
import { renderHelp } from "./views/help.js";
import {
  emptyPaletteState,
  paletteApplyKey,
  renderPalette,
} from "./palette.js";
import type { PaletteState } from "./palette.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ViewName = "session" | "overview" | "sessions" | "goals" | "breaks" | "help";

export const VIEWS: ViewName[] = ["session", "overview", "sessions", "goals", "breaks", "help"];

const VIEW_LABELS: Record<ViewName, string> = {
  session: "1:Session",
  overview: "2:Overview",
  sessions: "3:Sessions",
  goals: "4:Goals",
  breaks: "5:Breaks",
  help: "6:Help",
};

/** Ordered break categories — digit keys 1..6 map to this array. */
const BREAK_CATEGORIES: BreakCategory[] = [
  "rest",
  "meal",
  "exercise",
  "walk",
  "distraction",
  "other",
];

/** All available themes in cycle order. */
const THEMES: ThemeName[] = ["neon", "amber", "blue", "mono"];

const CTRL_C = "\x03";

// ---------------------------------------------------------------------------
// Live session + summary state
// ---------------------------------------------------------------------------

export interface LiveSession {
  timer: Timer;
  goal: string | null;
  label: string | null;
  focusTargetS: number | null;
  breakBudgetS: number | null;
}

export interface SummaryState {
  record: Session;
  focusS: number;
  breakS: number;
  askGoal: boolean;
}

interface AppState {
  view: ViewName;
  sessions: Session[];
  selectedIndex: number;
  scrollTop: number;
  detailOpen: boolean;
  live: LiveSession | null;
  palette: PaletteState;
  summary: SummaryState | null;
  theme: ThemeName;
}

// ---------------------------------------------------------------------------
// Public options / signature
// ---------------------------------------------------------------------------

export interface RunDashboardOptions {
  initialView?: ViewName;
  pendingSession?: {
    goal?: string | null;
    label?: string | null;
    theme?: ThemeName;
    focusTargetS?: number | null;
    breakBudgetS?: number | null;
  };
}

// ---------------------------------------------------------------------------
// Overlay compositing helper (pure)
// ---------------------------------------------------------------------------

/**
 * Composite an overlay panel over a base frame.
 *
 * Each overlay row is spliced into the base at the given (top + i) row,
 * starting at column `left`. The base row's total display width stays
 * exactly `cols`.
 */
export function compositeOverlay(
  frame: string[],
  overlay: { rows: string[]; top: number; left: number },
  cols: number,
): string[] {
  const result = frame.slice();
  for (let i = 0; i < overlay.rows.length; i++) {
    const rowIdx = overlay.top + i;
    if (rowIdx < 0 || rowIdx >= result.length) continue;
    const baseRow = result[rowIdx] ?? "";
    const overlayRow = overlay.rows[i] ?? "";
    const overlayW = displayWidth(overlayRow);
    const left = Math.max(0, overlay.left);

    // Slice the base row into prefix + tail (ANSI-unaware column slicing using
    // padTo / truncate on the stripped version for safety; we reconstruct the
    // row as: prefix (left cols) + overlayRow + suffix (remaining cols)).
    // eslint-disable-next-line no-control-regex
    const stripped = baseRow.replace(/\x1b(?:\[[0-9;]*[A-Za-z]|\][^\x07\x1b]*(?:\x07|\x1b\\))/g, "");

    // Prefix: first `left` visible chars of base row
    const prefix = truncate(stripped, left);
    const prefixW = displayWidth(prefix);
    const prefixPadded = padTo(prefix, left);

    // After overlay: tail starting at left + overlayW
    const afterCol = left + overlayW;
    const tailRaw = [...stripped].slice(afterCol).join("");
    const tailW = Math.max(0, cols - prefixW - overlayW);
    const tail = padTo(tailRaw, tailW);

    result[rowIdx] = prefixPadded + overlayRow + tail;
    // Safety: ensure exact width
    const composite = result[rowIdx]!;
    const cw = displayWidth(composite);
    if (cw > cols) {
      result[rowIdx] = truncate(composite, cols);
    } else if (cw < cols) {
      result[rowIdx] = padTo(composite, cols);
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// buildFrame — pure frame composer
// ---------------------------------------------------------------------------

/**
 * Build the full frame (header + body + footer) as an array of row strings.
 *
 * Exported for testing; call compositeOverlay after if overlays are needed,
 * but the returned frame already has palette / summary composited.
 */
export function buildFrame(
  state: AppState,
  cols: number,
  rows: number,
  ctx: CommandContext,
): string[] {
  const snap = buildSnapshot(state.sessions, ctx.config.dailyFocusGoalS);
  const theme = state.theme; // use live-switchable theme
  const color = ctx.color;

  // Layout: header(1) + body(flex) + footer(1)
  const fullRect: Rect = { top: 0, left: 0, width: cols, height: rows };
  const [headerRect, bodyRect, footerRect] = splitV(fullRect, [1, { flex: 1 }, 1]);

  const frame: string[] = [];

  // ── HEADER ─────────────────────────────────────────────────────────────────
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

  // Live indicator appended to headerRight when a session is running
  let headerRight: string;
  if (state.live) {
    const liveStr = `● ${state.live.timer.display()}`;
    const liveFormatted = color ? `${THEME_FG[theme]}${liveStr}\x1b[0m` : liveStr;
    headerRight = `${genAt} ${viewTabs}  ${liveFormatted}`;
  } else {
    headerRight = `${genAt} ${viewTabs}`;
  }

  const headerLeft = title;
  const headerLine = padTo(`${headerLeft}  ${headerRight}`, cols);
  if (headerRect) frame.push(headerLine);

  // ── BODY ───────────────────────────────────────────────────────────────────
  if (bodyRect && bodyRect.height > 0) {
    const sessState: SessionsState = {
      selectedIndex: state.selectedIndex,
      scrollTop: state.scrollTop,
      detailOpen: state.detailOpen,
    };

    // Defensive init: an unexpected view never leaves bodyRows unassigned
    // (which would throw on the spread below and corrupt the alt-screen).
    let bodyRows: string[] = [];

    if (state.detailOpen && state.view === "sessions") {
      const session = snap.recent[state.selectedIndex];
      if (session) {
        bodyRows = sessionDetail(session, bodyRect, theme, color);
      } else {
        bodyRows = renderSessions(snap, bodyRect, sessState, theme, color);
      }
    } else {
      switch (state.view) {
        case "session": {
          // Build SessionViewState from live session (or idle)
          let sv: SessionViewState;
          if (state.live) {
            const live = state.live;
            sv = {
              active: true,
              time: live.timer.display(),
              goal: live.goal,
              label: live.label,
              focusS: live.timer.elapsedS(),
              totalBreakS: live.timer.totalBreakS(),
              onBreak: live.timer.isOnBreak,
              currentBreakS: live.timer.currentBreakS(),
              breakCategory: live.timer.currentBreakCategory,
              suggestedBreakS: suggestBreakS(live.timer.elapsedS()),
              focusTargetS: live.focusTargetS,
              breakBudgetS: live.breakBudgetS,
              zen: false,
              showControls: true,
              keybindings: ctx.config.keybindings,
            };
          } else {
            sv = {
              active: false,
              time: "00:00:00",
              goal: null,
              label: null,
              focusS: 0,
              totalBreakS: 0,
              onBreak: false,
              currentBreakS: 0,
              breakCategory: "rest",
              suggestedBreakS: null,
              focusTargetS: null,
              breakBudgetS: null,
              zen: false,
              showControls: true,
              keybindings: ctx.config.keybindings,
            };
          }
          bodyRows = renderSession(sv, bodyRect, theme, color);
          break;
        }
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
        case "help":
          bodyRows = renderHelp(bodyRect, theme, color);
          break;
      }
    }

    frame.push(...bodyRows);
  }

  // ── FOOTER (context-sensitive) ────────────────────────────────────────────
  let footerHints: string;
  if (state.summary) {
    if (state.summary.askGoal) {
      footerHints = "[y] met · [n] missed · [any key] dismiss";
    } else {
      footerHints = "[any key] dismiss";
    }
  } else if (state.palette.open) {
    footerHints = "[↑↓] select · [Enter] run · [Esc] cancel";
  } else if (state.live && state.view === "session") {
    const kb = ctx.config.keybindings;
    if (state.live.timer.isOnBreak) {
      footerHints = `[1]rest [2]meal [3]exercise [4]walk [5]distraction [6]other  [${kb.break}] resume`;
    } else {
      footerHints = `[${kb.pause}] pause · [${kb.break}] break · [1-6] cat · [${kb.reset}] reset · [${kb.quit}] stop & save · [Tab] views`;
    }
  } else if (state.live) {
    footerHints = `[Tab]/[1-6] views · session ● ${state.live.timer.display()} running · [Ctrl-C] quit`;
  } else {
    footerHints = "[Tab] view · [↑↓] move · [Enter] detail · [/] commands · [r] refresh · [q] quit";
  }
  const footerLine = padTo(footerHints, cols);
  if (footerRect) frame.push(footerLine);

  // Ensure exactly `rows` lines (pad if needed)
  while (frame.length < rows) frame.push(" ".repeat(cols));
  const baseFrame = frame.slice(0, rows);

  // ── OVERLAYS ──────────────────────────────────────────────────────────────
  // Summary overlay (end-of-session)
  if (state.summary) {
    const summaryOverlay = buildSummaryOverlay(state.summary, cols, rows, theme, color);
    return compositeOverlay(baseFrame, summaryOverlay, cols);
  }

  // Palette overlay
  if (state.palette.open) {
    const paletteOverlay = renderPalette(state.palette, cols, rows, theme, color);
    return compositeOverlay(baseFrame, paletteOverlay, cols);
  }

  return baseFrame;
}

// ---------------------------------------------------------------------------
// Summary overlay builder
// ---------------------------------------------------------------------------

function buildSummaryOverlay(
  summary: SummaryState,
  cols: number,
  rows: number,
  theme: ThemeName,
  color: boolean,
): { rows: string[]; top: number; left: number } {
  const { record, focusS, breakS, askGoal } = summary;
  const boxWidth = Math.min(54, Math.max(30, cols - 4));
  const themeColor = color ? THEME_FG[theme] : undefined;

  const body: string[] = [];
  body.push(`Focus total:  ${humanDuration(focusS)}`);
  body.push(`Break total:  ${humanDuration(breakS)}`);

  if (focusS > 0 && breakS > 0) {
    const ratio = breakS / focusS;
    body.push(`Ratio:        1:${ratio.toFixed(1)}`);
  } else {
    body.push(`Ratio:        1:0.0`);
  }

  if (record.focusTargetS != null) {
    const met = focusS >= record.focusTargetS;
    body.push(`Target (${humanDuration(record.focusTargetS)}): ${met ? "✓ met" : "✗ not met"}`);
  }
  if (record.breakBudgetS != null) {
    const ok = breakS <= record.breakBudgetS;
    body.push(`Budget (${humanDuration(record.breakBudgetS)}): ${ok ? "✓ within" : "✗ over"}`);
  }
  if (record.goal != null) {
    body.push(`Goal: ${record.goal}`);
  }
  if (askGoal) {
    body.push(``);
    body.push(`Did you meet your goal? [y] yes  [n] no`);
  }

  const boxHeight = body.length + 2; // 2 borders
  const panelRows = panel({ title: "Session saved", width: boxWidth, height: boxHeight, body, color: themeColor });

  const left = Math.max(0, Math.floor((cols - boxWidth) / 2));
  const top = Math.max(0, Math.floor((rows - boxHeight) / 2));

  return { rows: panelRows, top, left };
}

// ---------------------------------------------------------------------------
// runDashboardApp — main TUI loop
// ---------------------------------------------------------------------------

/**
 * Run the interactive dashboard TUI.
 *
 * Resolves when the user quits or a SIGINT/SIGTERM arrives.
 */
export async function runDashboardApp(
  ctx: CommandContext,
  sessions: Session[],
  opts: RunDashboardOptions = {},
): Promise<void> {
  return new Promise<void>((resolve) => {
    const file = sessionsPathFor(ctx.config, ctx.paths);

    const state: AppState = {
      view: opts.initialView ?? "session",
      sessions,
      selectedIndex: 0,
      scrollTop: 0,
      detailOpen: false,
      live: null,
      palette: emptyPaletteState(),
      summary: null,
      theme: ctx.config.theme,
    };

    // If a pending session is provided, start it immediately
    if (opts.pendingSession) {
      const ps = opts.pendingSession;
      const timer = new Timer();
      state.live = {
        timer,
        goal: ps.goal ?? null,
        label: ps.label ?? null,
        focusTargetS: ps.focusTargetS ?? null,
        breakBudgetS: ps.breakBudgetS ?? null,
      };
      state.view = "session";
      state.theme = ps.theme ?? ctx.config.theme;
    }

    const screen = new Screen(process.stdout);
    let stopReader: (() => void) | null = null;
    let tickInterval: ReturnType<typeof setInterval> | null = null;

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

    /** Start the 100ms tick interval. Guard against double-start. */
    function startTick() {
      if (tickInterval !== null) return;
      tickInterval = setInterval(render, 100);
    }

    /** Stop the tick interval. */
    function stopTick() {
      if (tickInterval !== null) {
        clearInterval(tickInterval);
        tickInterval = null;
      }
    }

    function cleanup() {
      stopTick();
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

    /**
     * Stop & save the live session.
     *
     * If exitAfter=true: append session immediately and cleanup (exit).
     * If exitAfter=false: show summary overlay; persistence happens on dismiss.
     */
    function stopAndSave(exitAfter: boolean) {
      if (!state.live) {
        if (exitAfter) cleanup();
        return;
      }
      const t = state.live.timer;
      if (t.isOnBreak) t.endBreak();
      const record = t.toSession({
        source: "hud",
        goal: state.live.goal ?? undefined,
        label: state.live.label ?? undefined,
        goalMet: null,
        focusTargetS: state.live.focusTargetS ?? undefined,
        breakBudgetS: state.live.breakBudgetS ?? undefined,
      });
      const focusS = record.durationS;
      const breakS = record.breakS;

      stopTick();
      state.live = null;

      if (exitAfter) {
        appendSession(file, record);
        cleanup();
        return;
      }

      // Show summary overlay; persistence happens when dismissed in key handler
      state.summary = {
        record,
        focusS,
        breakS,
        askGoal: record.goal != null,
      };
      state.view = "session";
      render();
    }

    function handleSignal() {
      // On external signal: stop & save if live, then exit
      if (state.live) {
        const t = state.live.timer;
        if (t.isOnBreak) t.endBreak();
        const record = t.toSession({
          source: "hud",
          goal: state.live.goal ?? undefined,
          label: state.live.label ?? undefined,
          goalMet: null,
          focusTargetS: state.live.focusTargetS ?? undefined,
          breakBudgetS: state.live.breakBudgetS ?? undefined,
        });
        appendSession(file, record);
      }
      // A stopped-but-not-yet-dismissed session lives in the summary modal —
      // persist it too so an external signal never drops it.
      if (state.summary) {
        appendSession(file, state.summary.record);
      }
      cleanup();
    }

    function clampSelection(newSnap = buildSnapshot(state.sessions, ctx.config.dailyFocusGoalS)) {
      const max = Math.max(0, newSnap.recent.length - 1);
      state.selectedIndex = Math.max(0, Math.min(state.selectedIndex, max));
      const { rows } = getTermSize();
      const visibleRows = Math.max(1, rows - 3);
      if (state.selectedIndex < state.scrollTop) {
        state.scrollTop = state.selectedIndex;
      } else if (state.selectedIndex >= state.scrollTop + visibleRows) {
        state.scrollTop = state.selectedIndex - visibleRows + 1;
      }
    }

    /** Execute a palette command by name, then close the palette. */
    function executePaletteCommand(commandName: string) {
      state.palette = emptyPaletteState();

      switch (commandName) {
        case "session":
        case "overview":
        case "sessions":
        case "goals":
        case "breaks":
        case "help":
          state.view = commandName as ViewName;
          state.detailOpen = false;
          break;
        case "start":
          if (!state.live) {
            state.live = {
              timer: new Timer(),
              goal: null,
              label: null,
              focusTargetS: null,
              breakBudgetS: null,
            };
            startTick();
            state.view = "session";
          }
          break;
        case "stats":
        case "summary":
          state.view = "overview";
          state.detailOpen = false;
          break;
        case "history":
          state.view = "sessions";
          state.detailOpen = false;
          break;
        case "theme": {
          const idx = THEMES.indexOf(state.theme);
          state.theme = THEMES[(idx + 1) % THEMES.length]!;
          break;
        }
        case "zen":
          // Switch to session view (no dedicated zen mode in dashboard)
          state.view = "session";
          state.detailOpen = false;
          break;
        case "config":
          state.view = "help";
          state.detailOpen = false;
          break;
        case "refresh": {
          const { sessions: fresh } = readSessions(file);
          state.sessions = fresh;
          state.selectedIndex = 0;
          state.scrollTop = 0;
          state.detailOpen = false;
          screen.enter();
          break;
        }
        case "quit":
          stopAndSave(true);
          return; // cleanup already called inside stopAndSave
        default:
          // Unknown command — no-op, stay in valid state
          break;
      }
      render();
    }

    stopReader = startNavReader(process.stdin, (key) => {
      // ── (1) Summary modal: any key dismisses ──────────────────────────────
      if (state.summary !== null) {
        if (key.name === "char") {
          const ch = key.char;
          if (state.summary.askGoal) {
            if (ch === "y") state.summary.record = { ...state.summary.record, goalMet: true };
            else if (ch === "n") state.summary.record = { ...state.summary.record, goalMet: false };
          }
          if (ch === CTRL_C) {
            // Ctrl-C while the summary is up: persist, then exit cleanly.
            appendSession(file, state.summary.record);
            cleanup();
            return;
          }
        }
        // Persist and dismiss
        appendSession(file, state.summary.record);
        const { sessions: fresh } = readSessions(file);
        state.sessions = fresh;
        state.summary = null;
        state.selectedIndex = 0;
        state.scrollTop = 0;
        render();
        return;
      }

      // ── (2) Palette: feed keys to reducer ────────────────────────────────
      if (state.palette.open) {
        const result = paletteApplyKey(state.palette, key);
        state.palette = result.state;

        if (result.action?.type === "close") {
          render();
          return;
        }
        if (result.action?.type === "run") {
          executePaletteCommand(result.action.command);
          return;
        }
        render();
        return;
      }

      // ── (3) Open palette on "/" (works idle or during a live session) ─────
      if (key.name === "char" && key.char === "/") {
        state.palette = { open: true, query: "", selected: 0 };
        render();
        return;
      }

      // ── (4) Live-session capture (session view) ───────────────────────────
      if (state.live && state.view === "session") {
        const live = state.live;
        const kb = ctx.config.keybindings;

        if (key.name === "char") {
          const ch = key.char;

          if (ch === CTRL_C) {
            // Ctrl-C: stop & save, then exit
            stopAndSave(true);
            return;
          }

          if (ch === kb.pause) {
            live.timer.togglePause();
            render();
            return;
          }

          if (ch === kb.break) {
            if (live.timer.isOnBreak) {
              live.timer.endBreak();
            } else {
              live.timer.startBreak("rest", null, suggestBreakS(live.timer.elapsedS()));
            }
            render();
            return;
          }

          if (ch >= "1" && ch <= "6") {
            const n = parseInt(ch, 10);
            const cat = BREAK_CATEGORIES[n - 1];
            if (cat) {
              if (live.timer.isOnBreak) {
                live.timer.setBreakCategory(cat);
              } else {
                live.timer.startBreak(cat, null, suggestBreakS(live.timer.elapsedS()));
              }
            }
            render();
            return;
          }

          if (ch === kb.reset) {
            live.timer.reset();
            render();
            return;
          }

          if (ch === kb.quit) {
            // Stop & save, stay in dashboard (show summary overlay)
            stopAndSave(false);
            return;
          }

          if (ch === (ctx.config.keybindings.category ?? "c")) {
            if (live.timer.isOnBreak) {
              const current = live.timer.currentBreakCategory;
              const idx = BREAK_CATEGORIES.indexOf(current);
              const next = BREAK_CATEGORIES[(idx + 1) % BREAK_CATEGORIES.length] ?? "rest";
              live.timer.setBreakCategory(next);
            }
            render();
            return;
          }
        }

        if (key.name === "tab") {
          const idx = VIEWS.indexOf(state.view);
          state.view = VIEWS[(idx + 1) % VIEWS.length]!;
          state.detailOpen = false;
          render();
          return;
        }

        // Fall through to global for other keys not captured above
      }

      // ── (5) Global key handling ───────────────────────────────────────────

      if (key.name === "tab") {
        const idx = VIEWS.indexOf(state.view);
        state.view = VIEWS[(idx + 1) % VIEWS.length]!;
        state.detailOpen = false;
        render();
        return;
      }

      if (key.name === "char") {
        const ch = key.char;

        // Ctrl-C: always exit (stop & save if live)
        if (ch === CTRL_C) {
          stopAndSave(true);
          return;
        }

        // Switch views by number
        if (ch === "1") { state.view = "session"; state.detailOpen = false; render(); return; }
        if (ch === "2") { state.view = "overview"; state.detailOpen = false; render(); return; }
        if (ch === "3") { state.view = "sessions"; state.detailOpen = false; render(); return; }
        if (ch === "4") { state.view = "goals"; state.detailOpen = false; render(); return; }
        if (ch === "5") { state.view = "breaks"; state.detailOpen = false; render(); return; }
        if (ch === "6") { state.view = "help"; state.detailOpen = false; render(); return; }

        // Start a new session on session view when idle
        if ((ch === "s" || ch === "\r") && state.view === "session" && !state.live) {
          state.live = {
            timer: new Timer(),
            goal: null,
            label: null,
            focusTargetS: null,
            breakBudgetS: null,
          };
          startTick();
          render();
          return;
        }

        // j/k navigation (vim-style, sessions view)
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
          const { sessions: fresh } = readSessions(file);
          state.sessions = fresh;
          state.selectedIndex = 0;
          state.scrollTop = 0;
          state.detailOpen = false;
          screen.enter();
          render();
          return;
        }

        // Quit / escape
        if (ch === "q") {
          if (state.live) {
            // Live session on non-session view: stop & save, switch to session
            stopAndSave(false);
          } else {
            cleanup();
          }
          return;
        }
      }

      if (key.name === "escape") {
        if (state.detailOpen) {
          state.detailOpen = false;
          render();
        } else if (state.live) {
          // Don't exit while live; switch to session view to show controls
          state.view = "session";
          render();
        } else {
          cleanup();
        }
        return;
      }

      if (key.name === "enter") {
        if (state.view === "session" && !state.live) {
          // Start a new session on Enter when idle
          state.live = {
            timer: new Timer(),
            goal: null,
            label: null,
            focusTargetS: null,
            breakBudgetS: null,
          };
          startTick();
          render();
          return;
        }
        if (state.view === "sessions") {
          state.detailOpen = !state.detailOpen;
          render();
          return;
        }
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

    // Start tick interval if we launched with a pending session
    if (state.live) {
      startTick();
    }

    // Initial render
    screen.enter();
    render();
  });
}
