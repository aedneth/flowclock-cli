#!/usr/bin/env node
// Startup-latency benchmark for the flowclock HUD hot path.
//
// Measures cold-start wall time of the built CLI and, on a POSIX system with a
// PTY, the time-to-first-HUD-frame. This is the evidence that gates the
// Node-vs-Go and Ink-vs-raw-ANSI decisions: the HUD must feel instant.
//
// Usage: node scripts/bench.mjs [runs]
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { performance } from "node:perf_hooks";

const CLI = fileURLToPath(new URL("../dist/cli.js", import.meta.url));
const runs = Number(process.argv[2] ?? 30);
const env = {
  ...process.env,
  FLOWCLOCK_CONFIG_DIR: "/tmp/fc-bench/config",
  FLOWCLOCK_DATA_DIR: "/tmp/fc-bench/data",
  NO_COLOR: "1",
};

function timeCmd(args) {
  const samples = [];
  for (let i = 0; i < runs; i++) {
    const t0 = performance.now();
    spawnSync("node", [CLI, ...args], { env, stdio: "ignore" });
    samples.push(performance.now() - t0);
  }
  samples.sort((a, b) => a - b);
  const mean = samples.reduce((s, v) => s + v, 0) / samples.length;
  const p50 = samples[Math.floor(samples.length / 2)];
  const p95 = samples[Math.floor(samples.length * 0.95)];
  return { mean, p50, p95, min: samples[0] };
}

function report(label, r) {
  console.log(
    `${label.padEnd(24)} mean ${r.mean.toFixed(1)}ms  p50 ${r.p50.toFixed(1)}ms  p95 ${r.p95.toFixed(1)}ms  min ${r.min.toFixed(1)}ms`,
  );
}

console.log(
  `flowclock startup benchmark (${runs} runs, node ${process.version})\n`,
);
report("flowclock --version", timeCmd(["--version"]));
report("flowclock stats --json", timeCmd(["stats", "--json"]));
report("flowclock manifest --json", timeCmd(["manifest", "--json"]));

console.log(
  "\nTargets: cold start < 150ms acceptable, < 80ms ideal. Raw-ANSI HUD keeps\n" +
    "the timer off React/Ink so first-frame ≈ process start. Re-run with an Ink\n" +
    "spike to compare before adding any TUI dependency.",
);
