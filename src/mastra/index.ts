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
import { plannerAgent } from "./agents/planner-agent";
import { noteAgent } from "./agents/note-agent";
import { secondBrainAgent } from "./agents/second-brain-agent";
import { chatRoute } from "@mastra/ai-sdk";
import { distillAgent } from "./agents/distill-agent";
import { inboxAgent } from "./agents/inbox-agent";
import { linkAgent } from "./agents/link-agent";
import { reviewAgent } from "./agents/review-agent";
import { searchAgent } from "./agents/search-agent";
import { captureWorkflow } from "./workflows/capture-workflow";

export const mastra = new Mastra({
  workflows: {
    captureWorkflow,
  },
  agents: {
    plannerAgent,
    noteAgent,
    secondBrainAgent,
    inboxAgent,
    reviewAgent,
    distillAgent,
    linkAgent,
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
