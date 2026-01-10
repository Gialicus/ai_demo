import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { listNotesTool } from "../tools/list-notes-tool";
import { listPlansTool } from "../tools/list-plans-tool";
import { readNoteTool } from "../tools/read-note-tool";
import { readPlanTool } from "../tools/read-plan-tool";
import { updateNoteTool } from "../tools/update-note-tool";
import { updatePlanTool } from "../tools/update-plan-tool";
import { archiveItemTool } from "../tools/archive-item-tool";
import { promptLoader } from "../loader/prompt-loader";

export const reviewAgent = new Agent({
  id: "reviewAgent",
  name: "Review Agent",
  description: "An agent specialized in Weekly/Monthly Reviews, maintaining PARA organization, identifying items to archive, and keeping the second brain clean and organized according to BASB principles.",
  instructions: await promptLoader("review-agent"),
  model: "google/gemini-2.5-flash",
  tools: {
    listNotesTool,
    listPlansTool,
    readNoteTool,
    readPlanTool,
    updateNoteTool,
    updatePlanTool,
    archiveItemTool,
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
    maxSteps: 25, // Allow many steps for comprehensive reviews
  },
});