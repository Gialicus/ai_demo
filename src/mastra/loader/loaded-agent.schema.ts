import z from "zod";

export const LoadedAgentSchema = z.object({
  id: z.string().describe("The ID of the agent."),
  name: z.string().describe("The name of the agent."),
  instructions: z.string().describe("The instructions of the agent."),
  model: z.string().describe("The model of the agent."),
  // custom field for the loader
  withMemorySlave: z.boolean().describe("Whether the agent has a memory slave.").optional().default(false),
});

export type LoadedAgent = z.infer<typeof LoadedAgentSchema>;