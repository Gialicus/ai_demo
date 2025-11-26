import { MCPClient } from "@mastra/mcp";

export const mcpClient = new MCPClient({
  id: "mcp-client",
  servers: {
    wikipedia: {
      command: "npx",
      args: ["-y", "wikipedia-mcp"],
    },
  },
});
