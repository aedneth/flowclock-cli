import { describe, it, expect } from "vitest";
import { recomputeSession } from "../src/lib/session-edit.js";
import { SessionSchema, type Session } from "../src/schemas/session.js";

/** Build a valid session with sensible defaults for editing tests. */
function makeSession(over: Partial<Session> = {}): Session {
  return SessionSchema.parse({
    id: "2026-06-12T03-00-00-000-aaaa",
    start: "2026-06-12T03:00:00.000Z",
    end: "2026-06-12T04:00:00.000Z",
    durationS: 3600,
    breaks: [],
    breakS: 0,
    goal: "Deep work",
    label: "Korvex",
    ...over,
  });
}

/** A session with one 30m meal break: 1h focus, 30m break, 1h focus = end +2h30m. */
function makeWithBreak(): Session {
  return SessionSchema.parse({
    id: "2026-06-12T03-00-00-000-bbbb",
    start: "2026-06-12T03:00:00.000Z",
    end: "2026-06-12T05:30:00.000Z",
    durationS: 7200, // 2h focus
    breaks: [
      {
        start: "2026-06-12T04:00:00.000Z",
        end: "2026-06-12T04:30:00.000Z",
        durationS: 1800,
        category: "meal",
        label: null,
        suggestedS: null,
      },
    ],
    breakS: 1800,
    goal: "Deep work",
    label: "Korvex",
  });
}

const focusOf = (s: Session) => s.durationS;
const endSec = (s: Session) => (Date.parse(s.end) - Date.parse(s.start)) / 1000;

describe("recomputeSession — focus edit (no breaks)", () => {
  it("trims focus and moves end earlier; start is immutable", () => {
    const s = makeSession({ durationS: 21600, end: "2026-06-12T09:00:00.000Z" }); // fell asleep, 6h
    const out = recomputeSession(s, { focusS: 5400 }); // real focus = 1h30m
    expect(out.start).toBe(s.start);
    expect(out.durationS).toBe(5400);
    expect(out.breakS).toBe(0);
    expect(out.breaks).toEqual([]);
    expect(endSec(out)).toBe(5400);
    expect(out.end).toBe("2026-06-12T04:30:00.000Z");
  });

  it("extends focus and moves end later", () => {
    const out = recomputeSession(makeSession(), { focusS: 7200 });
    expect(out.durationS).toBe(7200);
    expect(endSec(out)).toBe(7200);
  });

  it("accepts focus of 0", () => {
    const out = recomputeSession(makeSession(), { focusS: 0 });
    expect(out.durationS).toBe(0);
    expect(endSec(out)).toBe(0);
    expect(out.end).toBe(out.start);
  });

  it("clears legacy pauses on edit so re-read never re-derives stale breaks", () => {
    const s = makeSession({
      pauses: [{ start: "2026-06-12T03:10:00.000Z", end: "2026-06-12T03:15:00.000Z", durationS: 300 }],
    });
    const out = recomputeSession(s, { focusS: 1800 });
    expect(out.pauses).toEqual([]);
  });
});

describe("recomputeSession — focus edit keeps breaks intact (trim from end)", () => {
  it("reducing focus keeps the meal break exactly, trims the tail focus", () => {
    const s = makeWithBreak();
    // 6h tail-runaway: pretend end is far out with same single break.
    const ranAway = recomputeSession(s, { focusS: 7200 + 14400 }); // extend tail by 4h first
    expect(ranAway.breaks).toHaveLength(1);
    // Now correct it back down to 2h total focus.
    const fixed = recomputeSession(ranAway, { focusS: 7200 });
    expect(fixed.durationS).toBe(7200);
    expect(fixed.breakS).toBe(1800);
    expect(fixed.breaks).toHaveLength(1);
    expect(fixed.breaks[0]!.category).toBe("meal");
    expect(fixed.breaks[0]!.durationS).toBe(1800);
    // end = start + 2h focus + 30m break = 2h30m
    expect(endSec(fixed)).toBe(7200 + 1800);
  });

  it("cascades the trim backwards when the last focus segment is too small", () => {
    // focus split: 1h before break, 1h after. Trim to 30m total focus → last seg
    // (1h) can only give 1h; need to remove 1h30m, so 1h from tail + 30m from head.
    const s = makeWithBreak();
    const out = recomputeSession(s, { focusS: 1800 }); // 30m total focus
    expect(out.durationS).toBe(1800);
    expect(out.breakS).toBe(1800);
    expect(out.breaks).toHaveLength(1);
    // First focus segment shrank from 1h to 30m; break starts at +30m.
    expect(out.breaks[0]!.start).toBe("2026-06-12T03:30:00.000Z");
    expect(endSec(out)).toBe(1800 + 1800);
  });
});

describe("recomputeSession — break edit", () => {
  it("setting break to 0 removes all breaks and shifts end in", () => {
    const out = recomputeSession(makeWithBreak(), { breakS: 0 });
    expect(out.breaks).toEqual([]);
    expect(out.breakS).toBe(0);
    expect(out.durationS).toBe(7200); // focus untouched
    expect(endSec(out)).toBe(7200);
  });

  it("scaling break preserves category and hits the exact new total", () => {
    const out = recomputeSession(makeWithBreak(), { breakS: 600 }); // 30m → 10m
    expect(out.breaks).toHaveLength(1);
    expect(out.breaks[0]!.category).toBe("meal");
    expect(out.breakS).toBe(600);
    expect(out.breaks[0]!.durationS).toBe(600);
    expect(endSec(out)).toBe(7200 + 600);
  });

  it("adds a single rest break when the session had none", () => {
    const out = recomputeSession(makeSession(), { breakS: 900 });
    expect(out.breaks).toHaveLength(1);
    expect(out.breaks[0]!.category).toBe("rest");
    expect(out.breakS).toBe(900);
    expect(endSec(out)).toBe(3600 + 900);
  });

  it("omitting breakS keeps recorded breaks byte-for-byte", () => {
    const s = makeWithBreak();
    const out = recomputeSession(s, { goal: "X" });
    expect(out.breaks[0]!.durationS).toBe(1800);
    expect(out.breaks[0]!.start).toBe(s.breaks[0]!.start);
    expect(out.breaks[0]!.end).toBe(s.breaks[0]!.end);
  });

  it("scales multiple breaks proportionally and sums exactly", () => {
    const s = SessionSchema.parse({
      id: "x",
      start: "2026-06-12T03:00:00.000Z",
      end: "2026-06-12T06:00:00.000Z",
      durationS: 7200,
      breaks: [
        { start: "2026-06-12T04:00:00.000Z", end: "2026-06-12T04:20:00.000Z", durationS: 1200, category: "rest", label: null, suggestedS: null },
        { start: "2026-06-12T05:20:00.000Z", end: "2026-06-12T05:40:00.000Z", durationS: 1200, category: "walk", label: null, suggestedS: null },
      ],
      breakS: 2400,
    });
    const out = recomputeSession(s, { breakS: 1000 });
    expect(out.breakS).toBe(1000);
    expect(out.breaks.reduce((a, b) => a + b.durationS, 0)).toBe(1000);
    expect(out.breaks.map((b) => b.category)).toEqual(["rest", "walk"]);
  });
});

describe("recomputeSession — metadata + combined edits", () => {
  it("edits goal and label, clears with null, preserves when undefined", () => {
    const a = recomputeSession(makeSession(), { goal: "New goal" });
    expect(a.goal).toBe("New goal");
    expect(a.label).toBe("Korvex");
    const b = recomputeSession(makeSession(), { label: null });
    expect(b.label).toBeNull();
    expect(b.goal).toBe("Deep work");
  });

  it("combined focus + break + goal edit stays internally consistent", () => {
    const out = recomputeSession(makeWithBreak(), { focusS: 3600, breakS: 600, goal: "Z" });
    expect(out.durationS).toBe(3600);
    expect(out.breakS).toBe(600);
    expect(out.goal).toBe("Z");
    expect(endSec(out)).toBe(3600 + 600);
    expect(out.id).toBe(makeWithBreak().id); // id preserved
  });

  it("invariant: end - start === focus + break for random edits", () => {
    const base = makeWithBreak();
    for (const f of [0, 1, 599, 3600, 99999]) {
      for (const b of [0, 1, 333, 1800, 7200]) {
        const out = recomputeSession(base, { focusS: f, breakS: b });
        expect(focusOf(out)).toBe(f);
        expect(out.breakS).toBe(b);
        expect(endSec(out)).toBe(f + b);
        // never-negative durations
        for (const brk of out.breaks) expect(brk.durationS).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
