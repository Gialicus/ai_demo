import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { promptLoader } from "../loader/prompt-loader";

export const distillAgent = new Agent({
  id: "distillAgent",
  name: "Distill Agent",
  description: "An agent specialized in Progressive Summarization, implementing BASB principles to extract key insights and create progressive summaries of notes (highlights, executive summary, sparklines).",
  instructions: await promptLoader("distill-agent"),
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