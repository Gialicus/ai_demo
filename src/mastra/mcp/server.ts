import { MCPServer } from "@mastra/mcp";
import { resourceHandlers } from "./resources";
import { writeNoteTool } from "../tools/write-note-tool";
import { promptHandlers } from "./prompts";
import { researchAgent } from "../agents/research-agent";

export const notes = new MCPServer({
  id: "notes",
  name: "Notes Server",
  version: "0.1.0",
  agents: { researchAgent },
  tools: {
    write: writeNoteTool,
  },
  resources: resourceHandlers,
  prompts: promptHandlers,
});
