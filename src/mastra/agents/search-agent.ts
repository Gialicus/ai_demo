import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { google } from "@ai-sdk/google";
import { promptLoader } from "../loader/prompt-loader";

export const searchAgent = new Agent({
  id: "searchAgent",
  name: "Search Agent",
  description: "An agent specialized in searching the web and using its knowledge to find and provide information according to Building a Second Brain (BASB) principles.",
  instructions: await promptLoader("search-agent"),
  model: "google/gemini-2.5-flash-lite",
  tools: {
    webSearch: google.tools.googleSearch({
      mode: "MODE_DYNAMIC",
    }),
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
  defaultOptions: {
    maxSteps: 15, // Allow multiple steps for comprehensive searches
  },
});