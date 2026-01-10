import { MCPServer } from "@mastra/mcp";
import { resourceHandlers } from "./resources";
import { saveNoteTool } from "../tools/save-note-tool";
import { promptHandlers } from "./prompts";
import { researchAgent } from "../agents/research-agent";
import { deleteNoteTool } from "../tools/delete-note-tool";
import { listNotesTool } from "../tools/list-notes-tool";
import { readNoteTool } from "../tools/read-note-tool";
import { updateNoteTool } from "../tools/update-note-tool";

export const notes = new MCPServer({
  id: "notes",
  name: "Notes Server",
  version: "0.1.0",
  agents: { researchAgent },
  tools: {
    save: saveNoteTool,
    list: listNotesTool,
    read: readNoteTool,
    update: updateNoteTool,
    delete: deleteNoteTool,
  },
  resources: resourceHandlers,
  prompts: promptHandlers,
});
