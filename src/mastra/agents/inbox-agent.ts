import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { distillAgent } from "./distill-agent";
import { promptLoader } from "../loader/prompt-loader";

export const inboxAgent = new Agent({
  id: "inboxAgent",
  name: "Inbox Agent",
  description: "An agent specialized in Inbox Processing, classifying captured items according to PARA and organizing them automatically according to BASB principles.",
  instructions: await promptLoader("inbox-agent"),
  model: "google/gemini-2.5-flash-lite",
  agents: {
    distillAgent,
  },
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