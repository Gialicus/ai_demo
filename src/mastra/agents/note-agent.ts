import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { saveNoteTool } from "../tools/save-note-tool";
import { readNoteTool } from "../tools/read-note-tool";
import { updateNoteTool } from "../tools/update-note-tool";
import { deleteNoteTool } from "../tools/delete-note-tool";
import { listNotesTool } from "../tools/list-notes-tool";
import { promptLoader } from "../loader/prompt-loader";
import { modelLoader } from "../loader/model-loader";

export const noteAgent = new Agent({
  id: "noteAgent",
  name: "Note Agent",
  description: "An agent specialized in managing notes - creating, reading, updating, deleting, and listing notes. Useful for storing information that supports planning and complex tasks.",
  instructions: await promptLoader("note-agent"),
  model: await modelLoader(),
  tools: {
    saveNoteTool,
    readNoteTool,
    updateNoteTool,
    deleteNoteTool,
    listNotesTool,
  },
  memory: defaultMemory,
  inputProcessors: [
    new UnicodeNormalizer({
      stripControlChars: true,
      collapseWhitespace: true,
    }),
  ],
  outputProcessors: [
    new BatchPartsProcessor({
      batchSize: 5,
      maxWaitTime: 100,
      emitOnNonText: true,
    }),
  ],
});
