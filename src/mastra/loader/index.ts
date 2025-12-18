import { Agent, AgentConfig, ToolsInput } from "@mastra/core/agent";
import { mockAgents } from "./mock";
import { defaultMemory } from "../storage/memory";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { fileLoader } from "./file-loader";

async function fetchAgentsDefinition(): Promise<AgentConfig<string, ToolsInput>[]> {
  const agents = await fileLoader("local-agent.json");
  return agents;
}

export const agentLoader: () => Promise<
  Record<string, Agent<string, ToolsInput>>
> = async () => {
  const loadedAgents = await fetchAgentsDefinition();
  const agents = loadedAgents.map(
    (agent) =>
      new Agent({
        ...agent,
        memory: agent?.memory ?? defaultMemory,
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
      }),
  );
  return agents.reduce(
    (acc, agent) => {
      acc[agent.id] = agent;
      return acc;
    },
    {} as Record<string, Agent<string, ToolsInput>>,
  );
};
