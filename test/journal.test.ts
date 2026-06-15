import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  writeJournal,
  readJournal,
  clearJournal,
  journalPathFor,
} from "../src/lib/journal.js";
import { Timer } from "../src/lib/timer.js";
import { DEFAULT_CONFIG } from "../src/schemas/config.js";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fc-journal-"));
  file = join(dir, "active-session.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

/** A timer at a fixed clock for deterministic snapshots. */
function timerAt(startMs: number, nowMs: number) {
  let t = nowMs;
  const clock = () => t;
  const timer = new Timer(clock, startMs);
  return { timer, clock, set: (ms: number) => (t = ms) };
}

describe("journal — path", () => {
  it("sits next to sessions.json", () => {
    const p = journalPathFor(DEFAULT_CONFIG);
    expect(p.endsWith("active-session.json")).toBe(true);
  });
});

describe("journal — write/read/clear round-trip", () => {
  it("persists a session snapshot and reads it back", () => {
    const start = Date.parse("2026-06-15T09:00:00.000Z");
    const { timer, set } = timerAt(start, start);
    set(start + 90 * 60 * 1000); // 90m focus
    const session = timer.toSession({ source: "hud", goal: "Deep work", label: "Korvex" });
    writeJournal(file, { session, onBreak: false, breakCategory: "rest", heartbeat: start + 90 * 60 * 1000 });

    const rec = readJournal(file);
    expect(rec).not.toBeNull();
    expect(rec!.v).toBe(1);
    expect(rec!.session.durationS).toBe(5400);
    expect(rec!.session.goal).toBe("Deep work");
    expect(rec!.session.label).toBe("Korvex");
  });

  it("clear removes the journal; read returns null after", () => {
    writeJournal(file, {
      session: new Timer(() => 1000, 0).toSession({ source: "hud" }),
      onBreak: false,
      breakCategory: "rest",
    });
    expect(existsSync(file)).toBe(true);
    clearJournal(file);
    expect(existsSync(file)).toBe(false);
    expect(readJournal(file)).toBeNull();
  });

  it("returns null for a missing or corrupt journal (never throws)", () => {
    expect(readJournal(join(dir, "nope.json"))).toBeNull();
    writeFileSync(file, "{ not json");
    expect(readJournal(file)).toBeNull();
    writeFileSync(file, JSON.stringify({ v: 99, garbage: true }));
    expect(readJournal(file)).toBeNull();
  });
});

describe("Timer.fromResume — conservative gap discard", () => {
  it("rebuilds focus exactly and continues forward, ignoring the frozen gap", () => {
    // Session ran 90m focus, then the machine froze for 2h before resume.
    const breaks = new Timer(() => 0, 0).toSession({ source: "hud" }).breaks;
    let now = Date.parse("2026-06-15T12:00:00.000Z");
    const clock = () => now;
    const resumed = Timer.fromResume(5400, breaks, "2026-06-15T09:00:00.000Z", clock);
    expect(resumed.elapsedS()).toBe(5400); // exactly the heartbeat focus, gap discarded
    now += 60 * 1000; // 1 minute later
    expect(resumed.elapsedS()).toBe(5460); // counts forward normally
  });

  it("restores accumulated break totals", () => {
    const start = 0;
    const { timer, set } = timerAt(start, start);
    set(1000 * 1000);
    timer.startBreak("meal");
    set(1000 * 1000 + 600 * 1000); // 10m meal break
    timer.endBreak();
    set(1000 * 1000 + 600 * 1000 + 500 * 1000);
    const snap = timer.toSession({ source: "hud" });
    expect(snap.breakS).toBe(600);

    let now = Date.parse("2026-06-15T15:00:00.000Z");
    const resumed = Timer.fromResume(snap.durationS, snap.breaks, snap.start, () => now);
    expect(resumed.totalBreakS()).toBe(600);
    expect(resumed.elapsedS()).toBe(snap.durationS);
    // stopping later yields a consistent end - start = focus + break
    now += 300 * 1000;
    const out = resumed.toSession({ source: "hud" });
    const span = (Date.parse(out.end) - Date.parse(out.start)) / 1000;
    expect(span).toBe(out.durationS + out.breakS);
    // every recovered break falls within the reconstructed [start, end] window
    for (const b of out.breaks) {
      expect(Date.parse(b.start)).toBeGreaterThanOrEqual(Date.parse(out.start));
      expect(Date.parse(b.end)).toBeLessThanOrEqual(Date.parse(out.end));
    }
  });
});
