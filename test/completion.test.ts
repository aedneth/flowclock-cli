import { describe, it, expect } from "vitest";
import {
  detectShell,
  SUPPORTED_SHELLS,
  runCompletion,
} from "../src/commands/completion.js";
import type { CommandContext } from "../src/lib/context.js";

// Capture stdout for the human-output path.
function capture(fn: () => void): string {
  const chunks: string[] = [];
  const orig = process.stdout.write.bind(process.stdout);
  process.stdout.write = ((s: string) => {
    chunks.push(String(s));
    return true;
  }) as typeof process.stdout.write;
  try {
    fn();
  } finally {
    process.stdout.write = orig;
  }
  return chunks.join("");
}

const ctx = (json = false) =>
  ({ json, env: {} as NodeJS.ProcessEnv }) as CommandContext;

describe("detectShell", () => {
  it("recognizes supported shells from $SHELL", () => {
    expect(detectShell({ SHELL: "/usr/bin/zsh" } as NodeJS.ProcessEnv)).toBe(
      "zsh",
    );
    expect(detectShell({ SHELL: "/bin/bash" } as NodeJS.ProcessEnv)).toBe(
      "bash",
    );
  });
  it("returns null for unknown/missing shells", () => {
    expect(detectShell({ SHELL: "/bin/tcsh" } as NodeJS.ProcessEnv)).toBeNull();
    expect(detectShell({} as NodeJS.ProcessEnv)).toBeNull();
  });
});

describe("runCompletion", () => {
  it("emits a non-empty script per supported shell", () => {
    for (const shell of SUPPORTED_SHELLS) {
      const out = capture(() => runCompletion(ctx(), shell));
      expect(out.length).toBeGreaterThan(0);
      expect(out).toContain("flowclock");
      // every script mentions existing subcommands
      expect(out).toContain("stats");
      // dashboard command must appear in every generated completion script
      expect(out).toContain("dashboard");
    }
  });

  it("bash script registers a completion function", () => {
    const out = capture(() => runCompletion(ctx(), "bash"));
    expect(out).toContain("complete -F _flowclock flowclock");
  });

  it("fish script uses complete -c flowclock", () => {
    const out = capture(() => runCompletion(ctx(), "fish"));
    expect(out).toContain("complete -c flowclock");
  });

  it("throws a usage error on an unsupported shell", () => {
    expect(() => runCompletion(ctx(), "powershell")).toThrowError(
      /unsupported shell/,
    );
  });
});
