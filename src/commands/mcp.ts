/**
 * `flowclock mcp` — long-running MCP stdio server.
 *
 * The MCP SDK is heavy (~150ms to import), so it is loaded lazily here: only
 * the `mcp` command pays that cost, keeping the HUD and every other command on
 * a fast cold-start path.
 */
export async function runMcp(): Promise<void> {
  const { startMcpServer } = await import("../mcp/server.js");
  await startMcpServer();
}
