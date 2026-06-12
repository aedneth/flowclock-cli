import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  mkdtempSync,
  rmSync,
  writeFileSync,
  existsSync,
  readdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  appendSession,
  deleteSession,
  updateSession,
  readSessions,
  querySessions,
  makeSessionId,
  normalizeSession,
} from "../src/lib/session.js";
import { SessionSchema } from "../src/schemas/session.js";

let dir: string;
let file: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "fc-sess-"));
  file = join(dir, "sessions.json");
});
afterEach(() => rmSync(dir, { recursive: true, force: true }));

function sample(durationS: number, start: string) {
  return SessionSchema.parse({
    id: makeSessionId(new Date(start)),
    start,
    end: new Date(new Date(start).getTime() + durationS * 1000).toISOString(),
    durationS,
    source: "log",
  });
}

describe("session store", () => {
  it("returns empty list when file is missing", () => {
    expect(readSessions(file).sessions).toEqual([]);
  });

  it("appends and reads back sessions", () => {
    appendSession(file, sample(60, "2026-05-01T10:00:00.000Z"));
    appendSession(file, sample(120, "2026-05-02T10:00:00.000Z"));
    const { sessions } = readSessions(file);
    expect(sessions).toHaveLength(2);
    expect(sessions[1]!.durationS).toBe(120);
  });

  it("updates a session by id, recomputes end, persists atomically", () => {
    appendSession(file, sample(60, "2026-05-01T10:00:00.000Z"));
    const b = appendSession(file, sample(21600, "2026-05-02T10:00:00.000Z")); // 6h runaway
    const updated = updateSession(file, b.id, { focusS: 5400 }); // → 1h30m
    expect(updated).not.toBeNull();
    expect(updated!.durationS).toBe(5400);
    expect(updated!.end).toBe("2026-05-02T11:30:00.000Z");
    // start immutable; other session untouched; change persisted to disk
    const { sessions } = readSessions(file);
    expect(sessions).toHaveLength(2);
    const onDisk = sessions.find((s) => s.id === b.id)!;
    expect(onDisk.durationS).toBe(5400);
    expect(onDisk.start).toBe(b.start);
  });

  it("updateSession returns null for an unknown id and leaves the file untouched", () => {
    const a = appendSession(file, sample(60, "2026-05-01T10:00:00.000Z"));
    const before = readSessions(file).sessions;
    const res = updateSession(file, "no-such-id", { focusS: 10 });
    expect(res).toBeNull();
    expect(readSessions(file).sessions).toEqual(before);
    expect(a.id).toBeTruthy();
  });

  it("deletes a session by id and persists the rest", () => {
    const a = appendSession(file, sample(60, "2026-05-01T10:00:00.000Z"));
    const b = appendSession(file, sample(120, "2026-05-02T10:00:00.000Z"));
    const remaining = deleteSession(file, a.id);
    expect(remaining).toHaveLength(1);
    expect(remaining[0]!.id).toBe(b.id);
    // persisted to disk, not just in memory
    expect(readSessions(file).sessions.map((s) => s.id)).toEqual([b.id]);
  });

  it("deleteSession is a no-op for an unknown id", () => {
    appendSession(file, sample(60, "2026-05-01T10:00:00.000Z"));
    const remaining = deleteSession(file, "does-not-exist");
    expect(remaining).toHaveLength(1);
  });

  it("recovers from a corrupt file by backing it up", () => {
    writeFileSync(file, "{ not json");
    const { sessions, recoveredBackup } = readSessions(file);
    expect(sessions).toEqual([]);
    expect(recoveredBackup).toBeDefined();
    expect(existsSync(recoveredBackup!)).toBe(true);
    expect(readdirSync(dir).some((f) => f.includes("corrupt"))).toBe(true);
  });

  it("recovers from a schema-invalid file", () => {
    writeFileSync(file, JSON.stringify([{ nope: true }]));
    const { recoveredBackup } = readSessions(file);
    expect(recoveredBackup).toBeDefined();
  });

  it("reads legacy schemaVersion 1 records non-destructively (v1→v2)", () => {
    // A v1 record as written by flowclock-cli v0.1.0 — no goal fields.
    const legacy = {
      schemaVersion: 1,
      id: "2026-05-01T10-00-00-000-abcd",
      start: "2026-05-01T10:00:00.000Z",
      end: "2026-05-01T10:01:00.000Z",
      durationS: 60,
      pauses: [],
      label: null,
      note: null,
      source: "hud",
      tags: [],
    };
    writeFileSync(file, JSON.stringify([legacy]));

    const { sessions, recoveredBackup } = readSessions(file);
    expect(recoveredBackup).toBeUndefined(); // not treated as corrupt
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.schemaVersion).toBe(1); // preserved, not forced to 2
    expect(sessions[0]!.durationS).toBe(60);
    // New v2 fields are filled with null defaults.
    expect(sessions[0]!.goal).toBeNull();
    expect(sessions[0]!.goalMet).toBeNull();
    expect(sessions[0]!.recmp3SessionId).toBeNull();
  });

  it("writes new sessions at schemaVersion 3 with goal fields", () => {
    const stored = appendSession(
      file,
      SessionSchema.parse({
        id: makeSessionId(new Date("2026-06-01T10:00:00.000Z")),
        start: "2026-06-01T10:00:00.000Z",
        end: "2026-06-01T10:25:00.000Z",
        durationS: 1500,
        source: "log",
        goal: "Deep work on StreamNet",
      }),
    );
    expect(stored.schemaVersion).toBe(3);
    expect(stored.goal).toBe("Deep work on StreamNet");
    const { sessions } = readSessions(file);
    expect(sessions[0]!.goal).toBe("Deep work on StreamNet");
  });
});

describe("normalizeSession", () => {
  it("derives breaks from pauses on a v2-style record", () => {
    const raw = SessionSchema.parse({
      schemaVersion: 2,
      id: "test-id",
      start: "2026-05-01T10:00:00.000Z",
      end: "2026-05-01T10:31:00.000Z",
      durationS: 1500,
      pauses: [
        {
          start: "2026-05-01T10:25:00.000Z",
          end: "2026-05-01T10:31:00.000Z",
          durationS: 360,
        },
      ],
      source: "hud",
    });
    // Raw parse should have empty breaks (v3 default)
    expect(raw.breaks).toHaveLength(0);
    expect(raw.breakS).toBe(0);

    const normalized = normalizeSession(raw);
    expect(normalized.breaks).toHaveLength(1);
    expect(normalized.breaks[0]!.category).toBe("rest");
    expect(normalized.breaks[0]!.durationS).toBe(360);
    expect(normalized.breaks[0]!.label).toBeNull();
    expect(normalized.breaks[0]!.suggestedS).toBeNull();
    expect(normalized.breakS).toBe(360);
    // Original pauses preserved
    expect(normalized.pauses).toHaveLength(1);
  });

  it("is idempotent — calling twice gives same result", () => {
    const raw = SessionSchema.parse({
      schemaVersion: 2,
      id: "test-id",
      start: "2026-05-01T10:00:00.000Z",
      end: "2026-05-01T10:31:00.000Z",
      durationS: 1500,
      pauses: [
        {
          start: "2026-05-01T10:25:00.000Z",
          end: "2026-05-01T10:31:00.000Z",
          durationS: 360,
        },
      ],
      source: "hud",
    });
    const once = normalizeSession(raw);
    const twice = normalizeSession(once);
    expect(twice.breaks).toHaveLength(1);
    expect(twice.breakS).toBe(360);
  });

  it("does not overwrite existing breaks", () => {
    const raw = SessionSchema.parse({
      schemaVersion: 3,
      id: "test-id",
      start: "2026-05-01T10:00:00.000Z",
      end: "2026-05-01T10:31:00.000Z",
      durationS: 1500,
      pauses: [],
      breaks: [
        {
          start: "2026-05-01T10:25:00.000Z",
          end: "2026-05-01T10:31:00.000Z",
          durationS: 360,
          category: "meal",
          label: "lunch",
          suggestedS: null,
        },
      ],
      breakS: 360,
      source: "hud",
    });
    const normalized = normalizeSession(raw);
    expect(normalized.breaks).toHaveLength(1);
    expect(normalized.breaks[0]!.category).toBe("meal");
    expect(normalized.breakS).toBe(360);
  });

  it("readSessions applies normalizeSession to loaded records", () => {
    const v2Record = {
      schemaVersion: 2,
      id: "2026-05-01T10-00-00-000-abcd",
      start: "2026-05-01T10:00:00.000Z",
      end: "2026-05-01T10:31:00.000Z",
      durationS: 1500,
      pauses: [
        {
          start: "2026-05-01T10:25:00.000Z",
          end: "2026-05-01T10:31:00.000Z",
          durationS: 360,
        },
      ],
      label: null,
      note: null,
      source: "hud",
      tags: [],
    };
    writeFileSync(file, JSON.stringify([v2Record]));
    const { sessions } = readSessions(file);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.breaks).toHaveLength(1);
    expect(sessions[0]!.breaks[0]!.category).toBe("rest");
    expect(sessions[0]!.breakS).toBe(360);
  });
});

describe("querySessions", () => {
  const data = [
    sample(60, "2026-05-01T10:00:00.000Z"),
    sample(120, "2026-05-03T10:00:00.000Z"),
    sample(90, "2026-05-02T10:00:00.000Z"),
  ];

  it("sorts newest first", () => {
    const rows = querySessions(data);
    expect(rows.map((r) => r.start)).toEqual([
      "2026-05-03T10:00:00.000Z",
      "2026-05-02T10:00:00.000Z",
      "2026-05-01T10:00:00.000Z",
    ]);
  });

  it("applies limit", () => {
    expect(querySessions(data, { limit: 2 })).toHaveLength(2);
  });

  it("filters by since/until", () => {
    const rows = querySessions(data, {
      since: new Date("2026-05-02T00:00:00.000Z"),
      until: new Date("2026-05-02T23:59:59.000Z"),
    });
    expect(rows).toHaveLength(1);
    expect(rows[0]!.start).toBe("2026-05-02T10:00:00.000Z");
  });
});

describe("makeSessionId", () => {
  it("is sortable and unique-ish", () => {
    const a = makeSessionId(new Date("2026-05-01T10:00:00.000Z"));
    const b = makeSessionId(new Date("2026-05-01T10:00:01.000Z"));
    expect(a < b).toBe(true);
    expect(a).not.toBe(makeSessionId(new Date("2026-05-01T10:00:00.000Z")));
  });
});
