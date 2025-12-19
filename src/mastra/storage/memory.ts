import { Memory } from "@mastra/memory";
import { storage } from "./storage";
import { vector } from "./vector";
import { fastembed } from "@mastra/fastembed";

export const defaultMemory = new Memory({
  embedder: fastembed,
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
