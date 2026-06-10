/**
 * Command palette — a pure, self-contained, OPTIONAL transient overlay for the
 * TUI dashboard. Rendered as a centered box (Claude Code style); never mutates
 * state; no I/O.
 *
 * Wiring is done by the caller (app.ts). This file only exports types and pure
 * functions.
 */

import type { Key } from "../lib/tui/input.js";
import type { ThemeName } from "../schemas/config.js";
import { panel, truncate } from "../lib/tui/draw.js";
import { paint, THEME_FG } from "../lib/theme.js";

// ---------------------------------------------------------------------------
// Commands list
// ---------------------------------------------------------------------------

export interface PaletteCommand {
  name: string;
  summary: string;
}

/**
 * All interactive palette commands (excludes mcp / completion / manifest which
 * are non-interactive or internal).
 */
export const PALETTE_COMMANDS: PaletteCommand[] = [
  { name: "session",  summary: "go to the live session view" },
  { name: "start",    summary: "new session — opens the goal/target/break form" },
  { name: "overview", summary: "today's flow overview" },
  { name: "sessions", summary: "browse logged sessions" },
  { name: "goals",    summary: "goals with hit/miss" },
  { name: "breaks",   summary: "break time by category" },
  { name: "stats",    summary: "stats + flow score" },
  { name: "history",  summary: "session history" },
  { name: "summary",  summary: "weekly markdown summary" },
  { name: "theme",    summary: "switch theme (neon|amber|blue|mono), saved" },
  { name: "display",  summary: "toggle display style (block|simple), saved" },
  { name: "zen",      summary: "toggle zen (clock only)" },
  { name: "help",     summary: "keybindings & help" },
  { name: "config",   summary: "show configuration" },
  { name: "refresh",  summary: "reload data" },
  { name: "quit",     summary: "exit the dashboard" },
];

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface PaletteState {
  open: boolean;
  query: string;
  selected: number;
}

/** Returns the canonical empty / closed palette state. */
export function emptyPaletteState(): PaletteState {
  return { open: false, query: "", selected: 0 };
}

// ---------------------------------------------------------------------------
// Filtering
// ---------------------------------------------------------------------------

/**
 * Filter `commands` (defaults to PALETTE_COMMANDS) by `query`.
 *
 * Match rule: case-insensitive SUBSTRING match against the command's `name`
 * OR its `summary`. An empty or whitespace-only query returns all commands in
 * their original (stable) order.
 */
export function filterCommands(
  query: string,
  commands: PaletteCommand[] = PALETTE_COMMANDS,
): PaletteCommand[] {
  const q = query.trim().toLowerCase();
  if (q === "") return commands.slice(); // stable copy of full list
  return commands.filter(
    (cmd) =>
      cmd.name.toLowerCase().includes(q) ||
      cmd.summary.toLowerCase().includes(q),
  );
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export interface PaletteResult {
  state: PaletteState;
  action?: { type: "run"; command: string } | { type: "close" };
}

/**
 * Pure reducer — never mutates `state`; always returns a fresh PaletteState.
 *
 * Key handling:
 *   escape    → close overlay, reset state
 *   enter     → run the currently selected command (if any match exists)
 *   backspace → remove last character from query; reset selected to 0
 *   up        → move selection up, clamped to 0
 *   down      → move selection down, clamped to filtered.length-1
 *   char      → if code >= 0x20 and not Ctrl-C ("\x03"), append to query
 *   anything else → state unchanged, no action
 */
export function paletteApplyKey(state: PaletteState, key: Key): PaletteResult {
  // Recompute filtered list and clamp selected for the CURRENT state.
  const filtered = filterCommands(state.query);
  const clampedSelected = filtered.length > 0
    ? Math.min(state.selected, filtered.length - 1)
    : 0;

  switch (key.name) {
    case "escape":
      return {
        state: { open: false, query: "", selected: 0 },
        action: { type: "close" },
      };

    case "enter": {
      if (filtered.length === 0) {
        // No matches — leave state unchanged
        return { state: { ...state, selected: clampedSelected } };
      }
      const cmd = filtered[clampedSelected];
      return {
        state: { open: false, query: "", selected: 0 },
        action: { type: "run", command: cmd!.name },
      };
    }

    case "backspace":
      return {
        state: {
          ...state,
          query: state.query.slice(0, -1),
          selected: 0,
        },
      };

    case "up":
      return {
        state: {
          ...state,
          selected: Math.max(0, clampedSelected - 1),
        },
      };

    case "down": {
      const max = filtered.length > 0 ? filtered.length - 1 : 0;
      return {
        state: {
          ...state,
          selected: Math.min(max, clampedSelected + 1),
        },
      };
    }

    case "char": {
      const ch = key.char;
      const code = ch.codePointAt(0) ?? 0;
      // Printable: code >= 0x20 AND not Ctrl-C (0x03)
      if (code >= 0x20 && ch !== "\x03") {
        return {
          state: {
            ...state,
            query: state.query + ch,
            selected: 0,
          },
        };
      }
      // Non-printable char — no change
      return { state: { ...state, selected: clampedSelected } };
    }

    default:
      return { state: { ...state, selected: clampedSelected } };
  }
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

export interface PaletteOverlay {
  rows: string[];
  top: number;
  left: number;
}

/**
 * Render the command palette as a centered bordered panel.
 *
 * Layout:
 *   boxWidth    = Math.min(50, Math.max(20, cols - 4))
 *   visibleCount = Math.min(filtered.length, Math.max(1, rows - 6))
 *   boxHeight   = visibleCount + 3  // 2 borders + 1 query line
 *
 * Body line 0: "> " + state.query + "▏"   (query with cursor bar)
 * Body lines 1+: each filtered command as "${name} — ${summary}"
 *   • selected entry: highlighted via paint(…, theme, true) when color=true,
 *     or prefixed with "› " when color=false
 *   • others: prefixed with "  " (two spaces)
 *
 * NOTE: local variable `panelRows` holds the string[] from panel() to avoid
 * shadowing the `rows` (terminal height) parameter.
 */
export function renderPalette(
  state: PaletteState,
  cols: number,
  rows: number,      // terminal height
  theme: ThemeName,
  color: boolean,
): PaletteOverlay {
  const filtered = filterCommands(state.query);

  const boxWidth = Math.min(50, Math.max(20, cols - 4));
  const visibleCount = Math.min(filtered.length, Math.max(1, rows - 6));
  const boxHeight = visibleCount + 3; // 2 borders + 1 query line

  const innerW = boxWidth - 2; // inner content width (between │ borders)

  // Clamp selected for rendering
  const clampedSelected = filtered.length > 0
    ? Math.min(state.selected, filtered.length - 1)
    : 0;

  // Build body
  const body: string[] = [];

  // Query line (body[0])
  body.push(truncate("> " + state.query + "▏", innerW));

  // Command lines (body[1..])
  for (let i = 0; i < visibleCount; i++) {
    const cmd = filtered[i];
    if (cmd === undefined) break;

    const raw = `${cmd.name} — ${cmd.summary}`;
    const isSelected = i === clampedSelected;

    let line: string;
    if (isSelected) {
      if (color) {
        // Highlight the full line with the theme color
        line = paint(truncate(raw, innerW), theme, true);
      } else {
        // Prefix with selection indicator; truncate to fit innerW
        const prefixed = "› " + raw;
        line = truncate(prefixed, innerW);
      }
    } else {
      // Non-selected: prefix two spaces to match selector width
      const prefixed = "  " + raw;
      line = truncate(prefixed, innerW);
    }

    body.push(line);
  }

  // Render the panel — store as panelRows to avoid shadowing `rows` param
  const panelRows: string[] = panel({
    title: "Commands",
    width: boxWidth,
    height: boxHeight,
    body,
    color: color ? THEME_FG[theme] : undefined,
  });

  // Center the overlay
  const left = Math.max(0, Math.floor((cols - boxWidth) / 2));
  const top = Math.max(0, Math.floor((rows - boxHeight) / 2));

  return { rows: panelRows, top, left };
}
