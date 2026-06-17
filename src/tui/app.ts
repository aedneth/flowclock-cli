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
import type { ThemeName, DisplayStyle } from "../schemas/config.js";
import { QUICK_BREAK_CATEGORIES } from "../schemas/session.js";
import type { BreakCategory } from "../schemas/session.js";
import { buildSnapshot } from "../lib/snapshot.js";
import { readSessions, appendSession, deleteSession, updateSession } from "../lib/session.js";
import { sessionsPathFor, saveConfig } from "../lib/config.js";
import { Timer } from "../lib/timer.js";
import { suggestBreakS } from "../lib/flowtime.js";
import { humanDuration, compactDuration, parseDurationToS } from "../lib/format.js";
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
import {
  emptySessionFormState,
  openSessionFormState,
  sessionFormApplyKey,
  renderSessionForm,
} from "./sessionform.js";
import type { SessionFormState, SessionFormValues } from "./sessionform.js";
import {
  emptyConfirmState,
  openConfirmState,
  confirmApplyKey,
  renderConfirm,
} from "./confirm.js";
import type { ConfirmState } from "./confirm.js";
import {
  emptyEditFormState,
  openEditFormState,
  editFormApplyKey,
  renderEditForm,
} from "./editform.js";
import type { EditFormState, EditFormValues } from "./editform.js";
import {
  emptyBreakPickerState,
  openBreakPickerState,
  breakPickerApplyKey,
  renderBreakPicker,
} from "./breakpicker.js";
import type { BreakPickerState } from "./breakpicker.js";
import {
  emptyResumeState,
  openResumeState,
  resumeApplyKey,
  renderResume,
} from "./resume.js";
import type { ResumeState } from "./resume.js";
import {
  journalPathFor,
  writeJournal,
  readJournal,
  clearJournal,
} from "../lib/journal.js";
import type { ActiveSession } from "../lib/journal.js";

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

/** Ordered break categories — digit keys 1..6 map to this array. The full set
 * (incl. coffee/sleep) is reachable via the break-category picker ([c]). */
const BREAK_CATEGORIES: readonly BreakCategory[] = QUICK_BREAK_CATEGORIES;

/** All available themes in cycle order. */
const THEMES: ThemeName[] = ["neon", "amber", "blue", "mono"];

/** Display styles in toggle order (cycled with `d` / the `display` command). */
const DISPLAY_STYLES: DisplayStyle[] = ["block", "simple", "outline", "minimal", "classic", "bold"];

const CTRL_C = "\x03";

/** Confirm-modal payload sentinel: discard the live session without saving. */
const CANCEL_LIVE = "__cancel_live__";

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
  form: SessionFormState;
  edit: EditFormState;
  confirm: ConfirmState;
  /** Break-category picker overlay ([c] during a live session). */
  breakpicker: BreakPickerState;
  /** Resume-previous-session overlay (shown at launch after a crash). */
  resume: ResumeState;
  summary: SummaryState | null;
  theme: ThemeName;
  displayStyle: DisplayStyle;
  /** Live-session zen toggle (`z`): hides goal + metadata, hero clock only. */
  zenLive: boolean;
  /** Hide the global footer control hints (Enter) to remove visual noise. */
  hideControls: boolean;
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
    ? paint("Flowclock", theme, true)
    : "Flowclock";

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
              zen: state.zenLive,
              displayStyle: state.displayStyle,
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
              displayStyle: state.displayStyle,
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
  // The footer is the SINGLE source of session controls — the session panel no
  // longer renders its own, so they never duplicate. `z` toggles zen (panel
  // metadata) and Enter toggles this control row's visibility.
  let footerHints: string;
  if (state.resume.open) {
    footerHints = "[r] resume · [d] discard · [Esc] discard";
  } else if (state.summary) {
    if (state.summary.askGoal) {
      footerHints = "[y] met · [n] missed · [any key] dismiss";
    } else {
      footerHints = "[any key] dismiss";
    }
  } else if (state.confirm.open) {
    footerHints = "[y] confirm · [n] cancel";
  } else if (state.breakpicker.open) {
    footerHints = "[↑↓] select · [1-8] pick · [Enter] choose · [Esc] cancel";
  } else if (state.form.open) {
    const verb = state.form.mode === "edit" ? "save" : "start";
    footerHints = `[Tab] next field · [Enter] ${verb} · [Esc] cancel`;
  } else if (state.edit.open) {
    footerHints = "[Tab] next field · [Enter] save · [Esc] cancel";
  } else if (state.palette.open) {
    footerHints = "[↑↓] select · [Enter] run · [Esc] cancel";
  } else if (state.live && state.view === "session") {
    if (state.hideControls) {
      // Controls hidden (Enter) — keep the row clean; press Enter to restore.
      footerHints = "";
    } else {
      const kb = ctx.config.keybindings;
      const cat = kb.category ?? "c";
      if (state.live.timer.isOnBreak) {
        footerHints = `[${cat}] cat · [${kb.break}] resume · [e] edit · [Enter] hide`;
      } else {
        footerHints = `[${kb.pause}] pause · [${kb.break}] break · [${cat}] cat · [e] edit · [x] cancel · [${kb.quit}] stop`;
      }
    }
  } else if (state.live) {
    footerHints = `[Tab]/[1-6] views · session ● ${state.live.timer.display()} running · [d] style · [Ctrl-C] quit`;
  } else if (state.view === "sessions") {
    footerHints = "[↑↓] select · [Enter] detail · [e] edit · [Supr] delete · [Tab] views · [q] quit";
  } else {
    footerHints = "[Tab] views · [s] start · [/] commands · [d] style · [t] theme · [q] quit";
  }
  const footerLine = padTo(footerHints, cols, "center");
  if (footerRect) frame.push(footerLine);

  // Ensure exactly `rows` lines (pad if needed)
  while (frame.length < rows) frame.push(" ".repeat(cols));
  const baseFrame = frame.slice(0, rows);

  // ── OVERLAYS ──────────────────────────────────────────────────────────────
  // Resume overlay (crash recovery) — highest priority, shown at launch.
  if (state.resume.open) {
    const resumeOverlay = renderResume(state.resume, cols, rows, theme, color);
    return compositeOverlay(baseFrame, resumeOverlay, cols);
  }

  // Summary overlay (end-of-session)
  if (state.summary) {
    const summaryOverlay = buildSummaryOverlay(state.summary, cols, rows, theme, color);
    return compositeOverlay(baseFrame, summaryOverlay, cols);
  }

  // Confirm overlay (destructive action, e.g. delete session)
  if (state.confirm.open) {
    const confirmOverlay = renderConfirm(state.confirm, cols, rows, theme, color);
    return compositeOverlay(baseFrame, confirmOverlay, cols);
  }

  // New-session form overlay
  if (state.form.open) {
    const formOverlay = renderSessionForm(state.form, cols, rows, theme, color);
    return compositeOverlay(baseFrame, formOverlay, cols);
  }

  // Edit-session form overlay
  if (state.edit.open) {
    const editOverlay = renderEditForm(state.edit, cols, rows, theme, color);
    return compositeOverlay(baseFrame, editOverlay, cols);
  }

  // Break-category picker overlay (during a live session)
  if (state.breakpicker.open) {
    const pickerOverlay = renderBreakPicker(state.breakpicker, cols, rows, theme, color);
    return compositeOverlay(baseFrame, pickerOverlay, cols);
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
      form: emptySessionFormState(),
      edit: emptyEditFormState(),
      confirm: emptyConfirmState(),
      breakpicker: emptyBreakPickerState(),
      resume: emptyResumeState(),
      summary: null,
      theme: ctx.config.theme,
      displayStyle: ctx.config.displayStyle,
      zenLive: false,
      hideControls: false,
    };

    const journalFile = journalPathFor(ctx.config, ctx.paths);
    /** The recovered journal record, held until the user resumes or discards. */
    let pendingResumeRec: ActiveSession | null = null;
    /** Epoch ms of the last journal write (throttle the per-tick heartbeat). */
    let lastJournalMs = 0;

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
    } else {
      // No new session requested — offer to resume a prior one left by a crash.
      const rec = readJournal(journalFile);
      if (rec) {
        pendingResumeRec = rec;
        state.resume = openResumeState({
          goal: rec.session.goal,
          label: rec.session.label,
          focusS: rec.session.durationS,
          breakS: rec.session.breakS,
          heartbeatISO: new Date(rec.heartbeat).toISOString(),
        });
      }
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
      tickInterval = setInterval(tick, 100);
    }

    /** Stop the tick interval. */
    function stopTick() {
      if (tickInterval !== null) {
        clearInterval(tickInterval);
        tickInterval = null;
      }
    }

    /**
     * Snapshot the live session to the crash-recovery journal. The snapshot
     * reuses Timer.toSession so a recovered session reconstructs through the
     * exact same path a normal one would. Best-effort: a write failure must
     * never disrupt the session.
     */
    function writeLiveJournal(): void {
      if (!state.live) return;
      const t = state.live.timer;
      const session = t.toSession({
        source: "hud",
        goal: state.live.goal ?? undefined,
        label: state.live.label ?? undefined,
        focusTargetS: state.live.focusTargetS ?? undefined,
        breakBudgetS: state.live.breakBudgetS ?? undefined,
      });
      try {
        writeJournal(journalFile, {
          session,
          onBreak: t.isOnBreak,
          breakCategory: t.currentBreakCategory,
        });
      } catch {
        /* best-effort: a missed heartbeat just shortens recovery coverage */
      }
      lastJournalMs = Date.now();
    }

    /** Remove the journal — the session ended cleanly (stop/cancel). */
    function clearLiveJournal(): void {
      clearJournal(journalFile);
      lastJournalMs = 0;
    }

    /** Per-tick: redraw, and refresh the journal heartbeat at most every 5s. */
    function tick(): void {
      render();
      if (state.live && Date.now() - lastJournalMs >= 5000) writeLiveJournal();
    }

    /** Reconstruct and start a live session from a recovered journal record. */
    function resumeFromJournal(rec: ActiveSession): void {
      const s = rec.session;
      state.live = {
        timer: Timer.fromResume(s.durationS, s.breaks, s.start),
        goal: s.goal,
        label: s.label,
        focusTargetS: s.focusTargetS,
        breakBudgetS: s.breakBudgetS,
      };
      state.resume = emptyResumeState();
      state.view = "session";
      startTick();
      writeLiveJournal(); // re-anchor the heartbeat to now
      render();
    }

    /** Discard the live session WITHOUT saving (the [x] cancel control). */
    function cancelSession(): void {
      if (!state.live) return;
      stopTick();
      state.live = null;
      state.zenLive = false;
      state.hideControls = false;
      state.breakpicker = emptyBreakPickerState();
      clearLiveJournal();
      render();
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
      // The session is over; from here persistence is handled by the summary
      // modal (or handleSignal). Drop the journal so it is never re-offered.
      clearLiveJournal();
      state.live = null;
      // Reset live-only view toggles so the next session starts normally.
      state.zenLive = false;
      state.hideControls = false;

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
      // The session is now persisted; drop the journal so it is not re-offered.
      clearLiveJournal();
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

    /**
     * Persist the live-switchable preferences (theme + display style) to the
     * config file so they stick as the user's default. Best-effort: a write
     * failure must never crash the TUI — the in-memory state still applies.
     */
    function persistConfig() {
      try {
        ctx.config.theme = state.theme;
        ctx.config.displayStyle = state.displayStyle;
        saveConfig(ctx.config, ctx.paths);
      } catch {
        // ignore — preference still applied for this session
      }
    }

    /** Cycle the theme (live) and persist it. */
    function cycleTheme() {
      const idx = THEMES.indexOf(state.theme);
      state.theme = THEMES[(idx + 1) % THEMES.length]!;
      persistConfig();
      render();
    }

    /** Cycle the display style (block → simple → outline → minimal → classic → bold, live) and persist it. */
    function cycleDisplayStyle() {
      const idx = DISPLAY_STYLES.indexOf(state.displayStyle);
      state.displayStyle = DISPLAY_STYLES[(idx + 1) % DISPLAY_STYLES.length]!;
      persistConfig();
      render();
    }

    /** Open the new-session form (only when idle — never over a live session). */
    function openForm() {
      if (state.live) return;
      state.form = openSessionFormState();
      state.view = "session";
      render();
    }

    /**
     * Start a live session from the form's values. Parses the target/break
     * durations; on a parse error, surfaces it in the form and stays open.
     */
    function startSessionFromForm(values: SessionFormValues) {
      let focusTargetS: number | null = null;
      let breakBudgetS: number | null = null;
      try {
        if (values.target.trim()) focusTargetS = parseDurationToS(values.target);
        if (values.break.trim()) breakBudgetS = parseDurationToS(values.break);
      } catch (err) {
        state.form = { ...state.form, error: (err as Error).message };
        render();
        return;
      }

      state.live = {
        timer: new Timer(),
        goal: values.goal.trim() || null,
        label: values.label.trim() || null,
        focusTargetS,
        breakBudgetS,
      };
      state.form = emptySessionFormState();
      state.view = "session";
      startTick();
      writeLiveJournal(); // seed the crash-recovery journal immediately
      render();
    }

    /**
     * Open the session form in EDIT mode over the RUNNING session, pre-filled
     * with its current goal/details and target/budget (compact, parser-friendly).
     * Lets you start a session "blind" and fill in what you're doing mid-flow.
     */
    function openLiveEditForm() {
      if (!state.live) return;
      const live = state.live;
      state.form = openSessionFormState({
        mode: "edit",
        values: {
          goal: live.goal ?? "",
          label: live.label ?? "",
          target: live.focusTargetS != null ? compactDuration(live.focusTargetS) : "",
          break: live.breakBudgetS != null ? compactDuration(live.breakBudgetS) : "",
        },
      });
      state.view = "session";
      render();
    }

    /**
     * Apply the form's values to the LIVE session (goal/details/target/budget).
     * The timer keeps running; on a duration parse error, surface it and stay
     * open. Re-seeds the crash-recovery journal so the new metadata survives.
     */
    function applyLiveEdit(values: SessionFormValues) {
      if (!state.live) return;
      let focusTargetS: number | null = null;
      let breakBudgetS: number | null = null;
      try {
        if (values.target.trim()) focusTargetS = parseDurationToS(values.target);
        if (values.break.trim()) breakBudgetS = parseDurationToS(values.break);
      } catch (err) {
        state.form = { ...state.form, error: (err as Error).message };
        render();
        return;
      }
      state.live = {
        ...state.live,
        goal: values.goal.trim() || null,
        label: values.label.trim() || null,
        focusTargetS,
        breakBudgetS,
      };
      state.form = emptySessionFormState();
      state.view = "session";
      writeLiveJournal();
      render();
    }

    /**
     * Open the edit form for the currently-selected session, pre-filled with its
     * goal/name and its focus/break totals in a parser-friendly compact form.
     */
    function openEditForm() {
      const snap = buildSnapshot(state.sessions, ctx.config.dailyFocusGoalS);
      const session = snap.recent[state.selectedIndex];
      if (!session) return;
      state.edit = openEditFormState({
        sessionId: session.id,
        startISO: session.start,
        values: {
          goal: session.goal ?? "",
          label: session.label ?? "",
          focus: compactDuration(session.durationS),
          break: compactDuration(session.breakS),
        },
      });
      render();
    }

    /**
     * Persist an edit from the form's values. Parses the focus/break durations
     * (blank = keep the original total); on a parse error, surfaces it in the
     * form and stays open. The end timestamp + break timeline recompute
     * automatically via `updateSession` → `recomputeSession`.
     */
    function saveEditForm(sessionId: string, values: EditFormValues) {
      let focusS: number | undefined;
      let breakS: number | undefined;
      try {
        if (values.focus.trim()) focusS = parseDurationToS(values.focus);
        if (values.break.trim()) breakS = parseDurationToS(values.break);
      } catch (err) {
        state.edit = { ...state.edit, error: (err as Error).message };
        render();
        return;
      }

      updateSession(file, sessionId, {
        focusS,
        breakS,
        goal: values.goal.trim() || null,
        label: values.label.trim() || null,
      });

      const { sessions: fresh } = readSessions(file);
      state.sessions = fresh;
      state.edit = emptyEditFormState();
      clampSelection();
      render();
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
          // Open the intuitive new-session form (only when idle).
          if (!state.live) {
            state.form = openSessionFormState();
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
          persistConfig();
          break;
        }
        case "display": {
          const idx = DISPLAY_STYLES.indexOf(state.displayStyle);
          state.displayStyle = DISPLAY_STYLES[(idx + 1) % DISPLAY_STYLES.length]!;
          persistConfig();
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
      // ── (0) Resume modal: r resume · d/Esc discard ────────────────────────
      if (state.resume.open) {
        // Ctrl-C exits; the journal is left in place to re-offer next launch.
        if (key.name === "char" && key.char === CTRL_C) {
          cleanup();
          return;
        }
        const result = resumeApplyKey(state.resume, key);
        state.resume = result.state;
        if (result.action?.type === "resume" && pendingResumeRec) {
          resumeFromJournal(pendingResumeRec);
          pendingResumeRec = null;
          return;
        }
        if (result.action?.type === "discard") {
          clearLiveJournal();
          pendingResumeRec = null;
          render();
          return;
        }
        render();
        return;
      }

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

      // ── (1a) Confirm modal: y confirms · n/Esc/Enter cancel ───────────────
      if (state.confirm.open) {
        // Ctrl-C closes the modal (never deletes) without exiting the app.
        if (key.name === "char" && key.char === CTRL_C) {
          state.confirm = emptyConfirmState();
          render();
          return;
        }
        const result = confirmApplyKey(state.confirm, key);
        state.confirm = result.state;
        if (result.action?.type === "confirm" && result.action.payload) {
          if (result.action.payload === CANCEL_LIVE) {
            cancelSession(); // discard the live session without saving
            return;
          }
          state.sessions = deleteSession(file, result.action.payload);
          clampSelection();
          render();
          return;
        }
        render();
        return;
      }

      // ── (1b) New-session form: feed keys to its reducer ───────────────────
      if (state.form.open) {
        // Ctrl-C: create mode has no session yet → exit cleanly; edit mode has a
        // session running → just close the form and leave it counting.
        if (key.name === "char" && key.char === CTRL_C) {
          if (state.form.mode === "edit") {
            state.form = emptySessionFormState();
            render();
          } else {
            cleanup();
          }
          return;
        }
        const mode = state.form.mode;
        const result = sessionFormApplyKey(state.form, key);
        state.form = result.state;
        if (result.action?.type === "cancel") {
          render();
          return;
        }
        if (result.action?.type === "submit") {
          if (mode === "edit") applyLiveEdit(result.action.values);
          else startSessionFromForm(result.action.values);
          return;
        }
        render();
        return;
      }

      // ── (1c) Edit-session form: feed keys to its reducer ──────────────────
      if (state.edit.open) {
        // Ctrl-C closes the edit modal (never edits) without exiting the app.
        if (key.name === "char" && key.char === CTRL_C) {
          state.edit = emptyEditFormState();
          render();
          return;
        }
        const result = editFormApplyKey(state.edit, key);
        state.edit = result.state;
        if (result.action?.type === "cancel") {
          render();
          return;
        }
        if (result.action?.type === "submit") {
          saveEditForm(result.action.sessionId, result.action.values);
          return;
        }
        render();
        return;
      }

      // ── (1d) Break-category picker ([c]): pick from ALL categories ─────────
      if (state.breakpicker.open) {
        // Ctrl-C closes the picker without exiting the app.
        if (key.name === "char" && key.char === CTRL_C) {
          state.breakpicker = emptyBreakPickerState();
          render();
          return;
        }
        const result = breakPickerApplyKey(state.breakpicker, key);
        state.breakpicker = result.state;
        if (result.action?.type === "pick" && state.live) {
          const cat = result.action.category;
          const t = state.live.timer;
          if (t.isOnBreak) t.setBreakCategory(cat);
          else t.startBreak(cat, null, suggestBreakS(t.elapsedS()));
          writeLiveJournal();
        }
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
            writeLiveJournal();
            render();
            return;
          }

          if (ch === kb.break) {
            if (live.timer.isOnBreak) {
              live.timer.endBreak();
            } else {
              live.timer.startBreak("rest", null, suggestBreakS(live.timer.elapsedS()));
            }
            writeLiveJournal();
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
              writeLiveJournal();
            }
            render();
            return;
          }

          // [e] — edit the running session's goal/details/target/budget live.
          if (ch === "e") {
            openLiveEditForm();
            return;
          }

          // [x] — cancel (discard without saving), confirmed first.
          if (ch === "x") {
            state.confirm = openConfirmState({
              title: "Cancel session",
              message: "Discard this session without saving?",
              payload: CANCEL_LIVE,
            });
            render();
            return;
          }

          if (ch === kb.reset) {
            live.timer.reset();
            writeLiveJournal();
            render();
            return;
          }

          if (ch === kb.quit) {
            // Stop & save, stay in dashboard (show summary overlay)
            stopAndSave(false);
            return;
          }

          // [c] — open the category picker (all categories, incl. coffee/sleep).
          // On break it pre-selects the current category; off break, picking one
          // starts a break in that category.
          if (ch === (kb.category ?? "c")) {
            state.breakpicker = openBreakPickerState(
              live.timer.isOnBreak ? live.timer.currentBreakCategory : undefined,
            );
            render();
            return;
          }

          if (ch === "z") {
            // Zen toggle: hide goal + metadata in the panel, hero clock only.
            state.zenLive = !state.zenLive;
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

        if (key.name === "enter") {
          // Toggle the control-hints row to remove visual noise once memorized.
          state.hideControls = !state.hideControls;
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

      // Delete / Supr on the Sessions list → confirm modal, then delete.
      if (key.name === "delete" && state.view === "sessions" && !state.detailOpen) {
        const snap = buildSnapshot(state.sessions, ctx.config.dailyFocusGoalS);
        const session = snap.recent[state.selectedIndex];
        if (session) {
          state.confirm = openConfirmState({
            title: "Delete session",
            message: "Delete this session? This cannot be undone.",
            payload: session.id,
          });
          render();
        }
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

        // Open the new-session form on the session view when idle.
        if ((ch === "s" || ch === "n" || ch === "\r") && state.view === "session" && !state.live) {
          openForm();
          return;
        }

        // Cycle display style (block → simple → outline → minimal → classic → bold) — anywhere, persisted.
        if (ch === "d") {
          cycleDisplayStyle();
          return;
        }

        // Cycle theme — works anywhere, persisted.
        if (ch === "t") {
          cycleTheme();
          return;
        }

        // Edit the selected session (sessions view, list or detail).
        if (ch === "e" && state.view === "sessions") {
          openEditForm();
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
          // Open the new-session form on Enter when idle
          openForm();
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
    }, process.stdout); // 3rd arg enables bracketed-paste mode for the forms

    process.on("SIGINT", handleSignal);
    process.on("SIGTERM", handleSignal);
    process.stdout.on("resize", render);

    // Start tick interval if we launched with a pending session
    if (state.live) {
      startTick();
      writeLiveJournal(); // seed the crash-recovery journal immediately
    }

    // Initial render
    screen.enter();
    render();
  });
}
