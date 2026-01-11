import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { Observability } from "@mastra/observability";
import {
  toolCallAppropriatenessScorer,
  completenessScorer,
  translationScorer,
} from "./scorers/weather-scorer";
import { storage } from "./storage/storage";
import { vector } from "./storage/vector";
import { noteAgent } from "./agents/note-agent";
import { secondBrainAgentNetwork } from "./agents/second-brain-agent-network";
import { secondBrainAgent } from "./agents/second-brain-agent";
import { chatRoute } from "@mastra/ai-sdk";
import { searchAgent } from "./agents/search-agent";
import { codeWorkflow } from "./workflows/code-workflow";

export const mastra = new Mastra({
  workflows: {
    codeWorkflow,
  },
  agents: {
    noteAgent,
    secondBrainAgent,
    secondBrainAgentNetwork,
    searchAgent,
  },
  scorers: {
    toolCallAppropriatenessScorer,
    completenessScorer,
    translationScorer,
  },
  mcpServers: {},
  vectors: {
    sqlVector: vector,
  },
  storage: storage,
  logger: new PinoLogger({
    name: "Mastra",
    level: "info",
  }),
  observability: new Observability({
    // Enables DefaultExporter and CloudExporter for tracing
    default: { enabled: true },
  }),
  server: {
    apiRoutes: [
      chatRoute({
        path: "/chat/:agentId",
      }),
    ],
  },
});
