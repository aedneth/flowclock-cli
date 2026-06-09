import { describe, it, expect } from "vitest";
import { Timer, formatHMS } from "../src/lib/timer.js";

/** A controllable clock for deterministic time math. */
function fakeClock(start = 0) {
  let t = start;
  const clock = () => t;
  return {
    clock,
    advance: (ms: number) => (t += ms),
    set: (ms: number) => (t = ms),
  };
}

describe("formatHMS", () => {
  it("zero-pads HH:MM:SS like flowtime.sh", () => {
    expect(formatHMS(0)).toBe("00:00:00");
    expect(formatHMS(9)).toBe("00:00:09");
    expect(formatHMS(61)).toBe("00:01:01");
    expect(formatHMS(3661)).toBe("01:01:01");
    expect(formatHMS(360000)).toBe("100:00:00");
  });
  it("clamps negatives to zero", () => {
    expect(formatHMS(-5)).toBe("00:00:00");
  });
});

describe("Timer count-up", () => {
  it("counts elapsed seconds from start", () => {
    const c = fakeClock(1000);
    const t = new Timer(c.clock);
    c.advance(5000);
    expect(t.elapsedS()).toBe(5);
    expect(t.display()).toBe("00:00:05");
  });

  it("excludes break time (elapsed = now - start - totalBreak)", () => {
    const c = fakeClock(0);
    const t = new Timer(c.clock);
    c.advance(10_000); // 10s active
    t.togglePause(); // start break via togglePause alias
    c.advance(30_000); // 30s on break — must not count
    expect(t.isPaused).toBe(true);
    expect(t.isOnBreak).toBe(true);
    expect(t.elapsedS()).toBe(10); // frozen while on break
    t.togglePause(); // end break
    c.advance(5_000); // 5s more active
    expect(t.elapsedS()).toBe(15);
  });

  it("reset returns to zero and clears breaks", () => {
    const c = fakeClock(0);
    const t = new Timer(c.clock);
    c.advance(20_000);
    t.togglePause();
    t.togglePause();
    t.reset();
    expect(t.elapsedS()).toBe(0);
    const s = t.toSession({ source: "hud" });
    expect(s.breaks).toHaveLength(0);
    expect(s.breakS).toBe(0);
    // pauses is always empty on new records
    expect(s.pauses).toHaveLength(0);
  });

  it("builds a session record closing an open break", () => {
    const c = fakeClock(0);
    const t = new Timer(c.clock);
    c.advance(60_000); // 60s focus
    t.startBreak("rest");
    c.advance(10_000); // 10s break (open)
    const s = t.toSession({ source: "hud", label: "x" });
    expect(s.durationS).toBe(60);
    expect(s.breaks).toHaveLength(1);
    expect(s.breaks[0]!.durationS).toBe(10);
    expect(s.breaks[0]!.category).toBe("rest");
    expect(s.breakS).toBe(10);
    expect(s.pauses).toHaveLength(0);
    expect(s.label).toBe("x");
    expect(s.source).toBe("hud");
  });

  it("records breaks with category and sums breakS", () => {
    const c = fakeClock(0);
    const t = new Timer(c.clock);

    c.advance(25 * 60 * 1000); // 25 min focus
    t.startBreak("meal", "lunch", null);
    c.advance(8 * 60 * 1000); // 8 min meal break
    t.endBreak();

    c.advance(20 * 60 * 1000); // 20 min more focus
    t.startBreak("walk", null, 300);
    c.advance(5 * 60 * 1000); // 5 min walk break
    t.endBreak();

    const s = t.toSession({ source: "hud" });
    expect(s.breaks).toHaveLength(2);
    expect(s.breaks[0]!.category).toBe("meal");
    expect(s.breaks[0]!.label).toBe("lunch");
    expect(s.breaks[1]!.category).toBe("walk");
    expect(s.breaks[1]!.suggestedS).toBe(300);
    expect(s.breakS).toBe(8 * 60 + 5 * 60);
    expect(s.durationS).toBe(25 * 60 + 20 * 60); // focus only
  });

  it("startBreak is a no-op if already on break", () => {
    const c = fakeClock(0);
    const t = new Timer(c.clock);
    c.advance(10_000);
    t.startBreak("rest");
    const breakStart = c.clock;
    c.advance(5_000);
    t.startBreak("meal"); // should be ignored
    c.advance(5_000);
    t.endBreak();
    const s = t.toSession({ source: "hud" });
    // Only one break recorded, still "rest" (second call ignored)
    expect(s.breaks).toHaveLength(1);
    expect(s.breaks[0]!.category).toBe("rest");
    void breakStart;
  });

  it("endBreak is a no-op if not on break", () => {
    const c = fakeClock(0);
    const t = new Timer(c.clock);
    c.advance(10_000);
    t.endBreak(); // no-op
    const s = t.toSession({ source: "hud" });
    expect(s.breaks).toHaveLength(0);
    expect(s.durationS).toBe(10);
  });

  it("currentBreakS returns 0 when not on break", () => {
    const c = fakeClock(0);
    const t = new Timer(c.clock);
    expect(t.currentBreakS()).toBe(0);
  });

  it("currentBreakS returns elapsed break time while on break", () => {
    const c = fakeClock(0);
    const t = new Timer(c.clock);
    c.advance(10_000);
    t.startBreak("rest");
    c.advance(7_000);
    expect(t.currentBreakS()).toBe(7);
  });

  it("toSession includes focusTargetS and breakBudgetS", () => {
    const c = fakeClock(0);
    const t = new Timer(c.clock);
    c.advance(30_000);
    const s = t.toSession({
      source: "timed",
      focusTargetS: 1500,
      breakBudgetS: 300,
    });
    expect(s.focusTargetS).toBe(1500);
    expect(s.breakBudgetS).toBe(300);
  });

  it("toSession defaults focusTargetS and breakBudgetS to null", () => {
    const c = fakeClock(0);
    const t = new Timer(c.clock);
    c.advance(10_000);
    const s = t.toSession({ source: "hud" });
    expect(s.focusTargetS).toBeNull();
    expect(s.breakBudgetS).toBeNull();
  });
});
