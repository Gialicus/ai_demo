import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { saveNoteTool } from "../tools/save-note-tool";
import { savePlanTool } from "../tools/save-plan-tool";
import { noteAgent } from "./note-agent";
import { z } from "zod";

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
  instructions: `You are an expert planning agent specialized in handling complex contexts and questions.

Your primary responsibility is to:
1. Analyze the user's question or request to understand its complexity and requirements
2. Break down complex problems into logical, sequential steps
3. Create comprehensive plans in markdown format
4. Iterate and refine plans to ensure completeness and quality
5. Save plans when appropriate using the available tools
6. Use the noteAgent to store useful information, research, constraints, or context that supports your planning process

PLANNING PROCESS:
- Start by understanding the full scope and complexity of the request
- Identify all necessary information, constraints, and desired outcomes
- Decompose the problem into clear, actionable steps
- Consider dependencies between steps
- Estimate complexity for each step when helpful
- Validate the plan for completeness and logical flow
- Iterate to improve the plan if gaps or issues are identified

PLAN STRUCTURE:
- Always provide a clear title that summarizes the plan
- Include an overview that explains the goal and context
- List steps in logical order with clear descriptions
- Use markdown formatting for readability (headers, lists, emphasis)
- Include sub-steps when a step requires multiple actions
- Note dependencies between steps when relevant

ITERATION:
- After creating an initial plan, evaluate it critically
- Check for missing steps, unclear descriptions, or logical gaps
- Refine and improve the plan iteratively
- Use tools to save intermediate versions if the plan is complex
- Use the noteAgent to store research findings, constraints, requirements, or other relevant information that informs your planning
- Retrieve relevant notes when they can help improve the plan
- Ensure the final plan is complete and actionable

WORKING WITH NOTES:
- When you need to store information that supports planning (research, constraints, requirements, context), use the noteAgent
- The noteAgent can create, read, update, and list notes
- Store intermediate findings or important context as notes for reference during planning iterations
- Retrieve existing notes when they contain relevant information for the current planning task
- Use notes to organize complex information that doesn't fit directly into the plan structure

OUTPUT:
- Always generate structured output following the plan schema
- The markdown field should contain a well-formatted, complete plan
- Use clear section headers, numbered lists, and proper markdown syntax
- Make the plan easy to read and follow

Remember: A good plan is clear, complete, actionable, and considers all aspects of the problem.`,
  model: "google/gemini-2.5-flash",
  agents: {
    noteAgent,
  },
  tools: {
    saveNoteTool,
    savePlanTool,
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
    maxSteps: 10, // Allow multiple iterations for plan refinement
  },
});
