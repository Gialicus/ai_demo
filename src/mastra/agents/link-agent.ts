import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { readNoteTool } from "../tools/read-note-tool";
import { listNotesTool } from "../tools/list-notes-tool";
import { createLinkTool } from "../tools/create-link-tool";
import { createMocTool } from "../tools/create-moc-tool";
import { promptLoader } from "../loader/prompt-loader";

export const linkAgent = new Agent({
  id: "linkAgent",
  name: "Link Agent",
  description: "An agent specialized in Connection Making, identifying relationships between notes, creating bidirectional links, and building Maps of Content (MOC) according to BASB principles.",
  instructions: await promptLoader("link-agent"),
  model: "google/gemini-2.5-flash-lite",
  tools: {
    readNoteTool,
    listNotesTool,
    createLinkTool,
    createMocTool,
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
  defaultOptions: {
    maxSteps: 15, // Allow multiple steps for reading, analyzing, and creating links
  },
});