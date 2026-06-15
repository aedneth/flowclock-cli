import {
  SESSION_SCHEMA_VERSION,
  type Break,
  type BreakCategory,
  type Session,
  type SessionSource,
} from "../schemas/session.js";
import { makeSessionId } from "./session.js";

/** Injectable clock returning epoch milliseconds (Date.now by default). */
export type Clock = () => number;

/** Format whole seconds as zero-padded HH:MM:SS (matches flowtime.sh printf). */
export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

/**
 * Pure count-up timer with categorized break support. All time arithmetic
 * mirrors flowtime.sh:
 *   elapsed = now - start - totalBreak
 * Break time is excluded from the active (focus) duration.
 */
export class Timer {
  private readonly clock: Clock;
  private startMs: number;
  private onBreak = false;
  private breakStartMs = 0;
  private breakCategory: BreakCategory = "rest";
  private breakLabel: string | null = null;
  private breakSuggestedS: number | null = null;
  private totalBreakMs = 0;
  private readonly breaks: Break[] = [];

  constructor(clock: Clock = Date.now, startMs?: number) {
    this.clock = clock;
    this.startMs = startMs ?? this.clock();
  }

  /**
   * Rebuild a *running* timer from a recovered snapshot (crash recovery).
   *
   * The reconstructed timer's active focus equals `focusS` and its accumulated
   * break equals the sum of `breaks` durations, continuing forward from `now`.
   * The wall-clock gap between the crash and the resume is intentionally
   * discarded — we never invent focus time, so the session picks up exactly
   * where the last heartbeat left it. Resumes in focus mode (any break that was
   * open at crash time is already folded into `breaks` by the journal writer).
   */
  static fromResume(
    focusS: number,
    breaks: Break[],
    clock: Clock = Date.now,
  ): Timer {
    const now = clock();
    const breakMs = breaks.reduce((sum, b) => sum + b.durationS, 0) * 1000;
    const t = new Timer(clock, now - Math.max(0, focusS) * 1000 - breakMs);
    t.totalBreakMs = breakMs;
    t.breaks.push(...breaks);
    return t;
  }

  get isPaused(): boolean {
    return this.onBreak;
  }

  get isOnBreak(): boolean {
    return this.onBreak;
  }

  /** Start a break. No-op if already on break. */
  startBreak(
    category: BreakCategory = "rest",
    label: string | null = null,
    suggestedS: number | null = null,
  ): void {
    if (this.onBreak) return;
    this.onBreak = true;
    this.breakStartMs = this.clock();
    this.breakCategory = category;
    this.breakLabel = label;
    this.breakSuggestedS = suggestedS;
  }

  /** End the current break. No-op if not on break. */
  endBreak(): void {
    if (!this.onBreak) return;
    const now = this.clock();
    const breakForMs = now - this.breakStartMs;
    this.totalBreakMs += breakForMs;
    this.breaks.push({
      start: new Date(this.breakStartMs).toISOString(),
      end: new Date(now).toISOString(),
      durationS: Math.round(breakForMs / 1000),
      category: this.breakCategory,
      label: this.breakLabel,
      suggestedS: this.breakSuggestedS,
    });
    this.onBreak = false;
    this.breakStartMs = 0;
    this.breakLabel = null;
    this.breakSuggestedS = null;
  }

  /** Toggle break/resume — back-compat alias for the `p` key. */
  togglePause(): void {
    if (this.onBreak) {
      this.endBreak();
    } else {
      this.startBreak("rest");
    }
  }

  /** Seconds elapsed in the current in-progress break (0 if not on break). */
  currentBreakS(): number {
    if (!this.onBreak) return 0;
    return Math.floor((this.clock() - this.breakStartMs) / 1000);
  }

  get currentBreakCategory(): BreakCategory {
    return this.breakCategory;
  }

  /**
   * Change the category of the current in-progress break.
   * No-op if not currently on break.
   */
  setBreakCategory(category: BreakCategory): void {
    if (!this.onBreak) return;
    this.breakCategory = category;
  }

  /**
   * Total break seconds accumulated so far (closed breaks + current open break).
   * Mirrors the elapsedS() pattern: always reflects the live total.
   */
  totalBreakS(): number {
    return Math.floor(this.totalBreakMs / 1000) + this.currentBreakS();
  }

  /** Reset to zero and clear break state — the `r` control. */
  reset(): void {
    this.startMs = this.clock();
    this.totalBreakMs = 0;
    this.onBreak = false;
    this.breakStartMs = 0;
    this.breaks.length = 0;
  }

  /** Active elapsed milliseconds (frozen while on break). */
  elapsedMs(): number {
    const ref = this.onBreak ? this.breakStartMs : this.clock();
    return Math.max(0, ref - this.startMs - this.totalBreakMs);
  }

  /** Active elapsed whole seconds. */
  elapsedS(): number {
    return Math.floor(this.elapsedMs() / 1000);
  }

  /** Current display string. */
  display(): string {
    return formatHMS(this.elapsedS());
  }

  /**
   * Build the loggable session record at stop time. If currently on a break,
   * the open break is closed at `now` so durationS stays consistent.
   */
  toSession(opts: {
    source: SessionSource;
    label?: string | null;
    note?: string | null;
    tags?: string[];
    goal?: string | null;
    goalMet?: boolean | null;
    recmp3SessionId?: string | null;
    focusTargetS?: number | null;
    breakBudgetS?: number | null;
  }): Session {
    const now = this.clock();
    const breaks = [...this.breaks];
    let totalBreakMs = this.totalBreakMs;

    if (this.onBreak) {
      const breakForMs = now - this.breakStartMs;
      totalBreakMs += breakForMs;
      breaks.push({
        start: new Date(this.breakStartMs).toISOString(),
        end: new Date(now).toISOString(),
        durationS: Math.round(breakForMs / 1000),
        category: this.breakCategory,
        label: this.breakLabel,
        suggestedS: this.breakSuggestedS,
      });
    }

    const breakS = breaks.reduce((sum, b) => sum + b.durationS, 0);
    const durationS = Math.max(
      0,
      Math.floor((now - this.startMs - totalBreakMs) / 1000),
    );
    const startDate = new Date(this.startMs);
    return {
      schemaVersion: SESSION_SCHEMA_VERSION,
      id: makeSessionId(startDate),
      start: startDate.toISOString(),
      end: new Date(now).toISOString(),
      durationS,
      pauses: [],
      breaks,
      breakS,
      label: opts.label ?? null,
      note: opts.note ?? null,
      source: opts.source,
      tags: opts.tags ?? [],
      goal: opts.goal ?? null,
      goalMet: opts.goalMet ?? null,
      recmp3SessionId: opts.recmp3SessionId ?? null,
      focusTargetS: opts.focusTargetS ?? null,
      breakBudgetS: opts.breakBudgetS ?? null,
    };
  }
}
