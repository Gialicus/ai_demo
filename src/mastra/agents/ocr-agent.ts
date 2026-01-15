import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { promptLoader } from "../loader/prompt-loader";
import { modelLoader } from "../loader/model-loader";



export const ocrAgent = new Agent({
  id: "ocrAgent",
  name: "OCR Agent",
  description: "An agent specialized in Optical Character Recognition (OCR) that extracts text from documents, images, PDFs, and web pages using AI vision capabilities.",
  instructions: await promptLoader("ocr-agent"),
  model: await modelLoader(),
  tools: {}, // No tools needed, only vision capabilities
  memory: defaultMemory,
  inputProcessors: [
    new UnicodeNormalizer({
      stripControlChars: true,
      collapseWhitespace: false, // Preserve whitespace for OCR accuracy
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
    maxSteps: 5, // OCR should be straightforward, few steps needed
  },
});
