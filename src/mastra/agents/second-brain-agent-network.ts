import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { noteAgent } from "./note-agent";
import { saveNoteTool } from "../tools/save-note-tool";
import { readNoteTool } from "../tools/read-note-tool";
import { updateNoteTool } from "../tools/update-note-tool";
import { deleteNoteTool } from "../tools/delete-note-tool";
import { listNotesTool } from "../tools/list-notes-tool";
import { savePlanTool } from "../tools/save-plan-tool";
import { readPlanTool } from "../tools/read-plan-tool";
import { updatePlanTool } from "../tools/update-plan-tool";
import { deletePlanTool } from "../tools/delete-plan-tool";
import { listPlansTool } from "../tools/list-plans-tool";
import { archiveItemTool } from "../tools/archive-item-tool";
import { createLinkTool } from "../tools/create-link-tool";
import { createMocTool } from "../tools/create-moc-tool";
import { promptLoader } from "../loader/prompt-loader";
import { searchAgent } from "./search-agent";
import { modelLoader } from "../loader/model-loader";

export const secondBrainAgentNetwork = new Agent({
  id: "secondBrainAgentNetwork",
  name: "Second Brain Agent Network",
  description: "A network of agents that functions as a second brain, implementing Building a Second Brain (BASB) principles. It coordinates planning, note-taking, and task execution using CODE method and PARA organization.",
  instructions: await promptLoader("second-brain-agent-network"),
  model: await modelLoader(),
  agents: {
    noteAgent,
    searchAgent,
  },
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
  ]
});
