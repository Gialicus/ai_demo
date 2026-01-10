import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { readNoteTool } from "../tools/read-note-tool";
import { listNotesTool } from "../tools/list-notes-tool";
import { updateNoteTool } from "../tools/update-note-tool";
import { distillAgent } from "./distill-agent";
import { promptLoader } from "../loader/prompt-loader";

export const inboxAgent = new Agent({
  id: "inboxAgent",
  name: "Inbox Agent",
  description: "An agent specialized in Inbox Processing, classifying captured items according to PARA and organizing them automatically according to BASB principles.",
  instructions: await promptLoader("inbox-agent"),
  model: "google/gemini-2.5-flash-lite",
  agents: {
    distillAgent,
  },
  tools: {
    readNoteTool,
    listNotesTool,
    updateNoteTool,
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
    maxSteps: 20, // Allow multiple steps for processing inbox items
  },
});