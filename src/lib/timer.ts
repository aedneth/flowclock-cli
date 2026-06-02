import type { Pause, Session, SessionSource } from "../schemas/session.js";
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
 * Pure count-up timer. All time arithmetic mirrors flowtime.sh:
 *   elapsed = now - start - totalPause
 * Paused time is excluded from the active duration.
 */
export class Timer {
  private readonly clock: Clock;
  private startMs: number;
  private paused = false;
  private pauseStartMs = 0;
  private totalPauseMs = 0;
  private readonly pauses: Pause[] = [];

  constructor(clock: Clock = Date.now, startMs?: number) {
    this.clock = clock;
    this.startMs = startMs ?? this.clock();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  /** Toggle pause/resume — the `p` control. */
  togglePause(): void {
    const now = this.clock();
    if (!this.paused) {
      this.paused = true;
      this.pauseStartMs = now;
    } else {
      this.paused = false;
      const pausedFor = now - this.pauseStartMs;
      this.totalPauseMs += pausedFor;
      this.pauses.push({
        start: new Date(this.pauseStartMs).toISOString(),
        end: new Date(now).toISOString(),
        durationS: Math.round(pausedFor / 1000),
      });
    }
  }

  /** Reset to zero and clear pause state — the `r` control. */
  reset(): void {
    this.startMs = this.clock();
    this.totalPauseMs = 0;
    this.paused = false;
    this.pauseStartMs = 0;
    this.pauses.length = 0;
  }

  /** Active elapsed milliseconds (frozen while paused). */
  elapsedMs(): number {
    const ref = this.paused ? this.pauseStartMs : this.clock();
    return Math.max(0, ref - this.startMs - this.totalPauseMs);
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
   * Build the loggable session record at stop time. If currently paused, the
   * open pause is closed at `now` so durationS stays consistent.
   */
  toSession(opts: {
    source: SessionSource;
    label?: string | null;
    note?: string | null;
    tags?: string[];
  }): Session {
    const now = this.clock();
    const pauses = [...this.pauses];
    let totalPauseMs = this.totalPauseMs;
    if (this.paused) {
      const pausedFor = now - this.pauseStartMs;
      totalPauseMs += pausedFor;
      pauses.push({
        start: new Date(this.pauseStartMs).toISOString(),
        end: new Date(now).toISOString(),
        durationS: Math.round(pausedFor / 1000),
      });
    }
    const durationS = Math.max(
      0,
      Math.floor((now - this.startMs - totalPauseMs) / 1000),
    );
    const startDate = new Date(this.startMs);
    return {
      schemaVersion: 1,
      id: makeSessionId(startDate),
      start: startDate.toISOString(),
      end: new Date(now).toISOString(),
      durationS,
      pauses,
      label: opts.label ?? null,
      note: opts.note ?? null,
      source: opts.source,
      tags: opts.tags ?? [],
    };
  }
}
