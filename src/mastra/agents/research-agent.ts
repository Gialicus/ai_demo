import { Agent } from "@mastra/core/agent";
import { google } from "@ai-sdk/google";
import { mcpClient } from "../mcp/client";
import { defaultMemory } from "../storage/memory";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";

export const researchAgent = new Agent({
  id: "researchAgent",
  name: "Research Agent",
  description: "A research assistant that can search the web for information.",
  instructions: `You are a research assistant that can search the web for information.
  use the webSearch to gather information and analyze the data to provide a comprehensive report`,
  model: "google/gemini-2.5-flash",
  tools: {
    webSearch: google.tools.googleSearch({ mode: "MODE_DYNAMIC" }),
    ...(await mcpClient.listTools()),
  },
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
});
