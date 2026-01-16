import { Agent } from "@mastra/core/agent";
import { promptLoader } from "../loader/prompt-loader";
import { modelLoader } from "../loader/model-loader";
import { savePlanTool } from "../tools/save-plan-tool";
import { readPlanTool } from "../tools/read-plan-tool";
import { updatePlanTool } from "../tools/update-plan-tool";
import { deletePlanTool } from "../tools/delete-plan-tool";
import { listPlansTool } from "../tools/list-plans-tool";

export const plannerAgent = new Agent({
  id: "plannerAgent",
  name: "Planner Agent",
  description: "An agent specialized in planning and organizing tasks.",
  instructions: await promptLoader("planner-agent"),
  model: await modelLoader(),
  tools: {
    savePlanTool,
    readPlanTool,
    updatePlanTool,
    deletePlanTool,
    listPlansTool,
  },
});