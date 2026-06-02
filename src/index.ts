// Programmatic API surface (for embedding and tests).
export { VERSION } from "./version.js";
export { Timer, formatHMS, type Clock } from "./lib/timer.js";
export { renderFrame, ANSI, type FrameInput } from "./lib/hud.js";
export {
  readSessions,
  appendSession,
  querySessions,
  makeSessionId,
  type QueryOptions,
  type ReadResult,
} from "./lib/session.js";
export {
  computeStats,
  type StatsSummary,
  type DayBucket,
} from "./lib/stats.js";
export { resolvePaths, type FlowclockPaths } from "./lib/paths.js";
export {
  loadConfig,
  saveConfig,
  getConfigValue,
  setConfigValue,
  sessionsPathFor,
} from "./lib/config.js";
export { buildManifest, type Manifest } from "./lib/manifest.js";
export { ExitCode, FlowclockError } from "./lib/exit.js";
export {
  jsonSuccess,
  jsonError,
  JSON_ENVELOPE_SCHEMA,
  type JsonEnvelope,
} from "./lib/output.js";
export { createMcpServer, startMcpServer } from "./mcp/server.js";
export * from "./schemas/session.js";
export * from "./schemas/config.js";
