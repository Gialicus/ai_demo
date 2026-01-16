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
import {
  savePlanTool,
  readPlanTool,
  updatePlanTool,
  deletePlanTool,
  listPlansTool,
} from "../tools/plans";
import {
  archiveItemTool,
  createLinkTool,
  createMocTool,
} from "../tools/basb";
import { promptLoader } from "../loader/prompt-loader";
import { modelLoader } from "../loader/model-loader";
import { google } from "@ai-sdk/google";

export const secondBrainAgent = new Agent({
  id: "secondBrainAgent",
  name: "Second Brain Agent",
  description: "A standalone orchestrator agent that automatically manages the complete CODE cycle (Capture, Organize, Distill, Express) implementing Building a Second Brain (BASB) principles by Tiago Forte. It automatically applies PARA organization and handles the full second brain workflow with minimal user intervention, using tools directly without dependencies on other agents.",
  instructions: await promptLoader("second-brain-agent"),
  model: await modelLoader(),
  tools: {
    // Note tools
    saveNoteTool,
    readNoteTool,
    updateNoteTool,
    deleteNoteTool,
    listNotesTool,
    // Plan tools
    savePlanTool,
    readPlanTool,
    updatePlanTool,
    deletePlanTool,
    listPlansTool,
    // BASB tools
    archiveItemTool,
    createLinkTool,
    createMocTool,
    // Web search tool
    webSearch: google.tools.googleSearch({
      mode: "MODE_DYNAMIC",
    }),
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
    maxSteps: 25, // Higher limit for automatic CODE cycle management
  },
});
