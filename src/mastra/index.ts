import { Mastra } from "@mastra/core/mastra";
import { PinoLogger } from "@mastra/loggers";
import { Observability } from "@mastra/observability";
import { weatherWorkflow } from "./workflows/weather-workflow";
import { weatherAgent } from "./agents/weather-agent";
import {
  toolCallAppropriatenessScorer,
  completenessScorer,
  translationScorer,
} from "./scorers/weather-scorer";
import { researchAgent } from "./agents/research-agent";
import { storage } from "./storage/storage";
import { notes } from "./mcp/server";
import { vector } from "./storage/vector";
import { summaryAgent } from "./agents/summary-agent";
import { chatRoute } from "@mastra/ai-sdk";
import { agentLoader } from "./loader";

export const mastra = new Mastra({
  workflows: { weatherWorkflow },
  agents: {
    weatherAgent,
    researchAgent,
    summaryAgent,
    ...(await agentLoader()),
  },
  scorers: {
    toolCallAppropriatenessScorer,
    completenessScorer,
    translationScorer,
  },
  mcpServers: {
    notes,
  },
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
