import { Agent, AgentConfig, ToolsInput } from "@mastra/core/agent";
import { defaultMemory } from "../storage/memory";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { fileLoader } from "./file-loader";
import { createMemoryAgent } from "../agents/memory-agent";
import { join } from "node:path";

async function fetchAgentsDefinition() {
  const agents = await fileLoader(join(__dirname, "./agents/example-agent.json"));
  return agents;
}

export const agentLoader: () => Promise<
  Record<string, Agent<string, ToolsInput>>
> = async () => {
  const loadedAgentsDefinition = await fetchAgentsDefinition();
  const agents: Agent<string, ToolsInput>[] = [];
  for (const agentDefinition of loadedAgentsDefinition) {
    const agent = new Agent({
      ...agentDefinition,
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
    })
    if (agentDefinition.withMemorySlave) {
      const memoryAgent = createMemoryAgent(agent.id);
      agents.push(memoryAgent);
    }
    agents.push(agent);
  }
  return agents.reduce(
    (acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    },
    {} as Record<string, Agent<string, ToolsInput>>,
  );
};
