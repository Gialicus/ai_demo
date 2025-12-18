import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { fastembed } from "@mastra/fastembed";
import { createVectorQueryTool } from "@mastra/rag";

// Create a tool for semantic search over the paper embeddings
const vectorQueryTool = createVectorQueryTool({
  vectorStoreName: "sqlVector",
  indexName: "papers",
  model: fastembed,
});

export const summaryAgent = new Agent({
  id: "summaryAgent",
  name: "Summary Agent",
  instructions: `You are a helpful summary assistant that analyzes academic papers and technical documents.
    Use the provided vector query tool to find relevant information from your knowledge base,
    and provide accurate, well-supported answers based on the retrieved content.
    Focus on the specific content available in the tool and acknowledge if you cannot find sufficient information to answer a question.
    Base your responses only on the content provided, not on general knowledge.`,
  model: "google/gemini-2.5-flash",
  tools: {
    vectorQueryTool,
  },
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
