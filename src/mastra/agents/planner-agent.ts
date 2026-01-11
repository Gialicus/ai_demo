import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { noteAgent } from "./note-agent";
import { z } from "zod";
import { savePlanTool } from "../tools/save-plan-tool";
import { deletePlanTool } from "../tools/delete-plan-tool";
import { listPlansTool } from "../tools/list-plans-tool";
import { readPlanTool } from "../tools/read-plan-tool";
import { updatePlanTool } from "../tools/update-plan-tool";
import { promptLoader } from "../loader/prompt-loader";

// Schema for structured plan output
export const planSchema = z.object({
  title: z.string().describe("A clear, descriptive title for the plan"),
  overview: z.string().describe("A brief overview explaining the goal and context of the plan"),
  steps: z.array(
    z.object({
      number: z.number().describe("Sequential step number"),
      description: z.string().describe("Clear description of what needs to be done in this step"),
      subSteps: z
        .array(z.string())
        .optional()
        .describe("Optional detailed sub-steps or tasks for this step"),
      estimatedComplexity: z
        .enum(["low", "medium", "high"])
        .optional()
        .describe("Estimated complexity level of this step"),
      dependencies: z
        .array(z.number())
        .optional()
        .describe("Step numbers this step depends on"),
    })
  ),
  markdown: z
    .string()
    .describe(
      "Complete plan formatted in markdown with clear structure, headers, and formatting"
    ),
});

export type PlanOutput = z.infer<typeof planSchema>;

export const plannerAgent = new Agent({
  id: "plannerAgent",
  name: "Planner Agent",
  description: "An agent specialized in creating detailed plans for complex tasks. It analyzes problems, breaks them down into logical steps, and iterates to refine the plan.",
  instructions: await promptLoader("planner-agent"),
  model: "google/gemini-2.5-flash-lite",
  agents: {
    noteAgent,
  },
  tools: {
    savePlanTool,
    listPlansTool,
    readPlanTool,
    updatePlanTool,
    deletePlanTool,
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
