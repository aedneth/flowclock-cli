import { describe, it, expect } from "vitest";
import { EventEmitter } from "node:events";
import {
  tokenize,
  startNavReader,
  PASTE_START,
  PASTE_END,
  type Key,
} from "../src/lib/tui/input.js";

describe("tokenize — multi-char chunks no longer drop characters", () => {
  it("splits a batched plain-text chunk into one char Key each", () => {
    expect(tokenize("abc")).toEqual([
      { name: "char", char: "a" },
      { name: "char", char: "b" },
      { name: "char", char: "c" },
    ]);
  });

  it("recognizes escape sequences embedded in a burst (arrow auto-repeat)", () => {
    expect(tokenize("\x1b[A\x1b[A")).toEqual([{ name: "up" }, { name: "up" }]);
  });

  it("mixes text and control bytes correctly", () => {
    expect(tokenize("a\x7fb")).toEqual([
      { name: "char", char: "a" },
      { name: "backspace" },
      { name: "char", char: "b" },
    ]);
  });

  it("keeps multibyte code points whole", () => {
    expect(tokenize("a😀")).toEqual([
      { name: "char", char: "a" },
      { name: "char", char: "😀" },
    ]);
  });
});

/** Minimal fake of a raw-mode TTY ReadStream for the reader. */
class FakeIn extends EventEmitter {
  isTTY = true;
  isRaw = false;
  setRawMode(v: boolean) {
    this.isRaw = v;
    return this;
  }
  resume() {
    return this;
  }
  pause() {
    return this;
  }
  setEncoding() {
    return this;
  }
  send(data: string) {
    this.emit("data", data);
  }
}

class FakeOut {
  isTTY = true;
  written: string[] = [];
  write(s: string) {
    this.written.push(s);
    return true;
  }
}

describe("startNavReader — bracketed paste assembly", () => {
  it("emits a single paste Key for wrapped text, sanitized of newlines", () => {
    const input = new FakeIn();
    const keys: Key[] = [];
    const stop = startNavReader(input as never, (k) => keys.push(k));
    input.send(`${PASTE_START}line one\nline two${PASTE_END}`);
    stop();
    expect(keys).toEqual([{ name: "paste", text: "line one\nline two" }]);
  });

  it("assembles a paste that spans multiple data events", () => {
    const input = new FakeIn();
    const keys: Key[] = [];
    startNavReader(input as never, (k) => keys.push(k));
    input.send(`${PASTE_START}hel`);
    input.send("lo wor");
    input.send(`ld${PASTE_END}`);
    expect(keys).toEqual([{ name: "paste", text: "hello world" }]);
  });

  it("handles text before and after the paste in the same chunk", () => {
    const input = new FakeIn();
    const keys: Key[] = [];
    startNavReader(input as never, (k) => keys.push(k));
    input.send(`x${PASTE_START}yo${PASTE_END}z`);
    expect(keys).toEqual([
      { name: "char", char: "x" },
      { name: "paste", text: "yo" },
      { name: "char", char: "z" },
    ]);
  });

  it("toggles bracketed-paste mode on the output TTY and restores on stop", () => {
    const input = new FakeIn();
    const out = new FakeOut();
    const stop = startNavReader(input as never, () => {}, out as never);
    expect(out.written).toContain("\x1b[?2004h");
    stop();
    expect(out.written).toContain("\x1b[?2004l");
  });
});
