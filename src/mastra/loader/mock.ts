import { AgentConfig, ToolsInput } from "@mastra/core/agent";

export const mockAgents: Promise<AgentConfig<string, ToolsInput>[]> =
  Promise.resolve([
    {
      id: "chefAgent",
      name: "Chef Agent",
      instructions:
        "You are Michel, a practical and experienced home chef" +
        "You help people cook with whatever ingredients they have available.",
      model: "google/gemini-2.5-flash",
    },
  ]);
