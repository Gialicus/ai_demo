import { MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import { LibSQLVector } from "@mastra/libsql";
import { fastembed } from "@mastra/fastembed";

// // Get the vector store instance from Mastra
const vectorStore = new LibSQLVector({
  id: "memory-vector",
  connectionUrl: "file:/home/gcoletta/esperimenti/ai_demo/.db/mastra.db",
});

// // Create an index for paper chunks
await vectorStore.createIndex({
  indexName: "papers",
  dimension: 384,
});

// Load the paper
const paperUrl = "https://arxiv.org/html/1706.03762";
const response = await fetch(paperUrl);
const paperText = await response.text();

// Create document and chunk it
const doc = MDocument.fromText(paperText);
const chunks = await doc.chunk({
  strategy: "recursive",
  maxSize: 512,
  overlap: 50,
  separators: ["\n\n", "\n", " "],
});

const { embeddings } = await embedMany({
  model: fastembed,
  values: chunks.map((chunk) => chunk.text),
});

// // Store embeddings
await vectorStore.upsert({
  indexName: "papers",
  vectors: embeddings,
  metadata: chunks.map((chunk) => ({
    text: chunk.text,
    source: "transformer-paper",
  })),
});
