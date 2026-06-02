import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { VERSION } from "../version.js";
import { resolvePaths } from "../lib/paths.js";
import {
  loadConfig,
  saveConfig,
  sessionsPathFor,
  getConfigValue,
  setConfigValue,
} from "../lib/config.js";
import {
  readSessions,
  querySessions,
  appendSession,
  makeSessionId,
} from "../lib/session.js";
import { computeStats } from "../lib/stats.js";
import { SessionSchema } from "../schemas/session.js";

/** JSON text content helper for tool results. */
function jsonContent(value: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }],
  };
}

/**
 * Build the MCP server. Tools call lib/* directly (never the CLI printers) so
 * nothing leaks onto stdout, which the stdio transport owns.
 */
export function createMcpServer(): McpServer {
  const server = new McpServer({ name: "flowclock", version: VERSION });

  const ctx = () => {
    const paths = resolvePaths();
    const config = loadConfig(paths);
    return { paths, config, file: sessionsPathFor(config, paths) };
  };

  server.tool(
    "flowclock_stats",
    "Aggregate Flowtime stats (today/all-time totals, best, average, last 7 days).",
    { since: z.string().datetime().optional() },
    async ({ since }) => {
      const { file } = ctx();
      const { sessions } = readSessions(file);
      const filtered = since
        ? querySessions(sessions, { since: new Date(since) })
        : sessions;
      return jsonContent(computeStats(filtered));
    },
  );

  server.tool(
    "flowclock_history",
    "List logged sessions, newest first.",
    {
      limit: z.number().int().positive().optional(),
      since: z.string().datetime().optional(),
      until: z.string().datetime().optional(),
    },
    async ({ limit, since, until }) => {
      const { file } = ctx();
      const { sessions } = readSessions(file);
      const rows = querySessions(sessions, {
        limit,
        since: since ? new Date(since) : undefined,
        until: until ? new Date(until) : undefined,
      });
      return jsonContent({ count: rows.length, sessions: rows });
    },
  );

  server.tool(
    "flowclock_log",
    "Record a completed session (duration in seconds; optional label/note/tags).",
    {
      duration: z.number().int().nonnegative(),
      start: z.string().datetime().optional(),
      label: z.string().optional(),
      note: z.string().optional(),
      tags: z.array(z.string()).optional(),
    },
    async ({ duration, start, label, note, tags }) => {
      const { file } = ctx();
      const end = new Date();
      const startDate = start
        ? new Date(start)
        : new Date(end.getTime() - duration * 1000);
      const session = SessionSchema.parse({
        id: makeSessionId(startDate),
        start: startDate.toISOString(),
        end: end.toISOString(),
        durationS: duration,
        pauses: [],
        label: label ?? null,
        note: note ?? null,
        source: "log",
        tags: tags ?? [],
      });
      return jsonContent(appendSession(file, session));
    },
  );

  server.tool(
    "flowclock_config_get",
    "Read a configuration value by key (e.g. theme, keybindings.pause).",
    { key: z.string() },
    async ({ key }) => {
      const { config } = ctx();
      return jsonContent({ key, value: getConfigValue(config, key) });
    },
  );

  server.tool(
    "flowclock_config_set",
    "Set a configuration value by key.",
    { key: z.string(), value: z.string() },
    async ({ key, value }) => {
      const { config, paths } = ctx();
      const next = setConfigValue(config, key, value);
      saveConfig(next, paths);
      return jsonContent({ key, value: getConfigValue(next, key) });
    },
  );

  server.tool(
    "flowclock_doctor",
    "Report installation/environment health checks.",
    {},
    async () => {
      const { file, paths } = ctx();
      const { sessions, recoveredBackup } = readSessions(file);
      const major = Number(process.versions.node.split(".")[0]);
      return jsonContent({
        ok: major >= 20 && !recoveredBackup,
        node: process.versions.node,
        configFile: paths.configFile,
        sessionsFile: file,
        sessionCount: sessions.length,
        recoveredBackup: recoveredBackup ?? null,
      });
    },
  );

  return server;
}

/** Start the server on stdio. Resolves when the transport closes. */
export async function startMcpServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}
