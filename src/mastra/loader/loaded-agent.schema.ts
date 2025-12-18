import z from "zod";

export const LoadedAgentSchema = z.object({
  id: z.string().describe("The ID of the agent."),
  name: z.string().describe("The name of the agent."),
  instructions: z.string().describe("The instructions of the agent."),
  model: z.string().describe("The model of the agent."),
});

export type LoadedAgent = z.infer<typeof LoadedAgentSchema>;