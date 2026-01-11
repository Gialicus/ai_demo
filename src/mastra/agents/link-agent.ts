import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { promptLoader } from "../loader/prompt-loader";

export const linkAgent = new Agent({
  id: "linkAgent",
  name: "Link Agent",
  description: "An agent specialized in Connection Making, identifying relationships between notes, creating bidirectional links, and building Maps of Content (MOC) according to BASB principles.",
  instructions: await promptLoader("link-agent"),
  model: "google/gemini-2.5-flash-lite",
  tools: {},
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