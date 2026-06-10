/**
 * Help view — keyboard shortcuts, view navigation, commands, and Flowtime
 * philosophy.
 *
 * Pure function: no I/O, no side effects.
 */

import type { Rect } from "../../lib/tui/layout.js";
import type { ThemeName } from "../../schemas/config.js";
import { panel, padTo } from "../../lib/tui/draw.js";
import { THEME_FG } from "../../lib/theme.js";

export function renderHelp(rect: Rect, theme: ThemeName, color: boolean): string[] {
  const w = rect.width;
  const h = rect.height;
  const innerW = Math.max(0, w - 2);

  const body: string[] = [];

  // Intro
  body.push(padTo("Flowtime control center — focus, breaks, flow.", innerW));

  // Spacer
  body.push("");

  // Views
  body.push(padTo("Views:", innerW));
  body.push(padTo("1 Session · 2 Overview · 3 Sessions · 4 Goals · 5 Breaks · 6 Help   (Tab cycles)", innerW));

  // Spacer
  body.push("");

  // Session controls
  body.push(padTo("Session controls (while a session runs):", innerW));
  body.push(padTo("p pause/resume · b break on/off · 1-6 break category · r reset · q stop & save", innerW));
  body.push(padTo("categories: 1 rest · 2 meal · 3 exercise · 4 walk · 5 distraction · 6 other", innerW));

  // Spacer
  body.push("");

  // Global
  body.push(padTo("Global:", innerW));
  body.push(padTo("/ command palette · r refresh · q or Esc quit", innerW));

  // Spacer
  body.push("");

  // Commands
  body.push(padTo("Commands (also from your shell):", innerW));
  body.push(padTo("start · stats · history · goals · summary · breaks · theme · config · doctor · dashboard", innerW));

  // Spacer
  body.push("");

  // Flowtime philosophy
  body.push(padTo("Flowtime:", innerW));
  body.push(padTo("Unitasking; work until natural fatigue; proportional breaks (~10-50% of focus).", innerW));
  body.push(padTo("Log everything. This is NOT Pomodoro.", innerW));

  return panel({ title: "Help", width: w, height: h, body, color: color ? THEME_FG[theme] : undefined });
}
