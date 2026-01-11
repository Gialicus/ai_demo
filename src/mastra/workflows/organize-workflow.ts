import { createStep, createWorkflow } from "@mastra/core/workflows";
import z from "zod";
import { secondBrainAgentNetwork } from "../agents/second-brain-agent-network";
import { noteAgent } from "../agents/note-agent";

export const organizeWorkflow = createWorkflow({
  id: "organizeWorkflow",
  description: "Organize the notes",
  inputSchema: z.object({
    prompt: z.string().describe("The prompt to organize the notes"),
  }),
  outputSchema: z.object({
    text: z.string().describe("The text to organize the notes"),
  }),
}).then(createStep(secondBrainAgentNetwork)).map(async ({ inputData }) => ({
  prompt: inputData.text,
})).then(createStep(noteAgent)).commit();