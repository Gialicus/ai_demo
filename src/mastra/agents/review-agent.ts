import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { promptLoader } from "../loader/prompt-loader";

export const reviewAgent = new Agent({
  id: "reviewAgent",
  name: "Review Agent",
  description: "An agent specialized in Weekly/Monthly Reviews, maintaining PARA organization, identifying items to archive, and keeping the second brain clean and organized according to BASB principles.",
  instructions: await promptLoader("review-agent"),
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