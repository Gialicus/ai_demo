import { Memory } from "@mastra/memory";
import { storage } from "./storage";
import { vector } from "./vector";

export const defaultMemory = new Memory({
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
});
