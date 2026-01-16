import type { Agent } from "@mastra/core/agent";
import type { Mastra } from "@mastra/core/mastra";

/**
 * Gets the secondBrainAgent from Mastra instance with proper typing.
 * 
 * @param mastra - Mastra instance
 * @returns The secondBrainAgent
 */
export function getSecondBrainAgent(mastra: Mastra): Agent {
  return mastra.getAgent("secondBrainAgent");
}

/**
 * Generates a response using an agent with a given prompt.
 * 
 * @param agent - The agent to use for generation
 * @param prompt - The prompt to send to the agent
 * @returns The generated response text
 */
export async function generateWithAgent(agent: Agent, prompt: string): Promise<string> {
  const result = await agent.generate(prompt);
  return result.text || "";
}
