import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { storage } from "../storage/storage";
import { vector } from "../storage/vector";
import { google } from "@ai-sdk/google";
import { mcpClient } from "../mcp/client";

export const researchAgent = new Agent({
  id: "research-agent",
  name: "Research Agent",
  description: "A research assistant that can search the web for information.",
  instructions: `You are a research assistant that can search the web for information.
  use the webSearch to gather information and analyze the data to provide a comprehensive report`,
  model: "google/gemini-2.5-flash",
  tools: {
    webSearch: google.tools.googleSearch({ mode: "MODE_DYNAMIC" }),
    ...(await mcpClient.listTools()),
  },
  memory: new Memory({
    embedder: "google/gemini-embedding-001",
    storage: storage,
    vector: vector,
    options: {
      workingMemory: {
        enabled: true,
      },
      semanticRecall: {
        topK: 3,
        messageRange: 2,
        scope: "resource",
      },
    },
  }),
});
