import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import {
  saveNoteTool,
  readNoteTool,
  updateNoteTool,
  deleteNoteTool,
  listNotesTool,
} from "../tools/notes";
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
