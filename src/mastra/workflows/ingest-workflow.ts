import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import { MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import { fastembed } from "@mastra/fastembed";
import { vector } from "../storage/vector";
import { saveNoteTool } from "../tools/save-note-tool";

// Input schema
const ingestInputSchema = z.object({
  url: z.string().describe("URL of the document to ingest"),
  indexName: z.string().optional().default("documents").describe("Name of the vector index to use"),
  saveAsNote: z.boolean().optional().default(false).describe("Whether to save the document as a note in Second Brain"),
  chunkOptions: z.object({
    strategy: z.enum(["recursive", "fixed"]).optional().default("recursive"),
    maxSize: z.number().optional().default(512),
    overlap: z.number().optional().default(50),
    separators: z.array(z.string()).optional().default(["\\n\\n", "\\n", " "]),
  }).optional(),
  paraCategory: z.enum(["project_", "area_", "resource_", "archive_", "inbox_"]).optional().default("resource_").describe("PARA category if saving as note"),
});

// Output schema
const ingestOutputSchema = z.object({
  documentId: z.string().describe("Unique identifier for the processed document"),
  chunksCount: z.number().describe("Number of chunks created"),
  embeddingsCount: z.number().describe("Number of embeddings generated"),
  noteId: z.string().optional().describe("ID of the note if saved as note"),
  indexName: z.string().describe("Name of the vector index used"),
});

// Step 1: Download document from URL
const downloadStep = createStep({
  id: "download",
  description: "Download document from URL",
  inputSchema: ingestInputSchema,
  outputSchema: z.object({
    url: z.string(),
    content: z.string(),
    contentType: z.string(),
    documentId: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { url } = inputData;
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
      }
      
      const contentType = response.headers.get("content-type") || "";
      let content: string;
      
      // Determine content type and prepare for OCR agent
      if (contentType.includes("application/pdf") || 
          contentType.includes("image/") ||
          url.match(/\.(pdf|png|jpg|jpeg|gif|bmp|webp)$/i)) {
        // For PDF and images, convert to base64 for OCR agent
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const mimeType = contentType || (url.match(/\.pdf$/i) ? "application/pdf" : "image/png");
        content = `BASE64_${mimeType}:${buffer.toString("base64")}`;
      } else if (contentType.includes("text/html") || url.endsWith(".html")) {
        // For HTML, pass URL directly to OCR agent
        content = `URL:${url}`;
      } else {
        // For plain text, we can pass directly or use OCR agent
        const textContent = await response.text();
        // If it's already text, we can use it directly, but still pass through OCR for consistency
        content = `TEXT:${textContent}`;
      }
      
      // Generate document ID from URL
      const documentId = `doc_${url.replace(/[^a-zA-Z0-9]/g, "_").substring(0, 50)}_${Date.now()}`;
      
      return {
        url,
        content,
        contentType,
        documentId,
      };
    } catch (error: any) {
      throw new Error(`Error downloading document from ${url}: ${error.message}`);
    }
  },
});

// Step 2: Extract text from document using OCR agent
const extractTextStep = createStep({
  id: "extract-text",
  description: "Extract text from document using OCR agent (supports PDF, images, HTML, and plain text)",
  inputSchema: z.object({
    url: z.string(),
    content: z.string(),
    contentType: z.string(),
    documentId: z.string(),
  }),
  outputSchema: z.object({
    text: z.string(),
    documentId: z.string(),
    url: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { content, contentType, url, documentId } = inputData;
    
    const ocrAgent = mastra.getAgent("ocrAgent");
    
    // Prepare input for OCR agent based on content type
    let ocrPrompt: string;
    
    if (content.startsWith("BASE64_")) {
      // Extract mime type and base64 data
      const match = content.match(/^BASE64_([^:]+):(.+)$/);
      if (!match) {
        throw new Error("Invalid base64 format");
      }
      const [, mimeType, base64Data] = match;
      
      // For base64 documents (PDF, images), pass to OCR agent
      // Note: The agent will need to handle base64 in the prompt or we need to use a different approach
      // For now, we'll pass it as a data URL in the prompt
      ocrPrompt = `Extract all text from this ${mimeType} document. The document is provided as base64 data.

Document URL: ${url}
Document ID: ${documentId}
Content Type: ${mimeType}

Please extract ALL readable text from this document, preserving structure and formatting when possible. Return only the extracted text, without explanations or summaries.

Base64 data: ${base64Data.substring(0, 100)}... (truncated for prompt, full data available)`;
      
      // For vision models, we might need to pass the image differently
      // For now, we'll use the URL approach if available, or pass base64 in a way the model can process
      // If the document is accessible via URL, prefer that
      if (url && !url.startsWith("data:")) {
        ocrPrompt = `Extract all text from this document. 

Document URL: ${url}
Document Type: ${mimeType}
Document ID: ${documentId}

Please extract ALL readable text from this document, preserving structure and formatting when possible. Return only the extracted text, without explanations or summaries.

If you cannot access the URL directly, I can provide the document content in another format.`;
      }
    } else if (content.startsWith("URL:")) {
      // For HTML/URL documents, pass URL directly
      const documentUrl = content.replace("URL:", "");
      ocrPrompt = `Extract all text from this web page/document.

Document URL: ${documentUrl}
Document ID: ${documentId}

Please extract ALL visible text content from this document, removing HTML tags but preserving text structure (headings, paragraphs, lists). Return only the extracted text, without explanations or summaries.`;
    } else if (content.startsWith("TEXT:")) {
      // For plain text, extract directly (but still pass through OCR for consistency/cleaning)
      const textContent = content.replace("TEXT:", "");
      ocrPrompt = `Extract and clean the text from this document. The document is already in text format, but please ensure it's properly formatted and structured.

Document URL: ${url}
Document ID: ${documentId}

Text content:
${textContent.substring(0, 10000)}${textContent.length > 10000 ? "\n\n... (truncated)" : ""}

Please return the cleaned and properly formatted text, preserving structure.`;
    } else {
      // Fallback: treat as plain text
      ocrPrompt = `Extract all text from this document.

Document URL: ${url}
Document ID: ${documentId}
Content Type: ${contentType}

Please extract ALL readable text from this document. Return only the extracted text.`;
    }
    
    // Call OCR agent
    const result = await ocrAgent.generate(ocrPrompt);
    
    // Extract text from result
    let text = result.text || "";
    
    // Clean up result - remove any error prefixes
    if (text.startsWith("ERROR:")) {
      throw new Error(text);
    }
    
    // If result is empty or too short, it might be an error
    if (!text || text.trim().length === 0) {
      throw new Error("OCR agent returned empty text. The document might be unreadable or in an unsupported format.");
    }
    
    return {
      text: text.trim(),
      documentId,
      url,
    };
  },
});

// Step 3: Chunk the text
const chunkStep = createStep({
  id: "chunk",
  description: "Chunk text using MDocument",
  inputSchema: z.object({
    text: z.string(),
    documentId: z.string(),
    url: z.string(),
  }),
  outputSchema: z.object({
    chunks: z.array(z.object({
      text: z.string(),
    })),
    documentId: z.string(),
    url: z.string(),
  }),
  execute: async ({ inputData, getInitData }) => {
    const { text, documentId, url } = inputData;
    const initData = getInitData();
    const chunkOptions = initData.chunkOptions || {
      strategy: "recursive" as const,
      maxSize: 512,
      overlap: 50,
      separators: ["\n\n", "\n", " "],
    };
    
    // Create document and chunk it
    const doc = MDocument.fromText(text);
    const chunks = await doc.chunk({
      strategy: chunkOptions.strategy || "recursive",
      maxSize: chunkOptions.maxSize || 512,
      overlap: chunkOptions.overlap || 50,
      separators: chunkOptions.separators || ["\n\n", "\n", " "],
    });
    
    return {
      chunks: chunks.map((chunk) => ({
        text: chunk.text,
      })),
      documentId,
      url,
    };
  },
});

// Step 4: Generate embeddings
const embedStep = createStep({
  id: "embed",
  description: "Generate embeddings using fastembed",
  inputSchema: z.object({
    chunks: z.array(z.object({
      text: z.string(),
    })),
    documentId: z.string(),
    url: z.string(),
  }),
  outputSchema: z.object({
    embeddings: z.array(z.array(z.number())),
    chunks: z.array(z.object({
      text: z.string(),
    })),
    documentId: z.string(),
    url: z.string(),
  }),
  execute: async ({ inputData }) => {
    const { chunks, documentId, url } = inputData;
    
    if (chunks.length === 0) {
      throw new Error("No chunks to embed");
    }
    
    // Generate embeddings
    const { embeddings } = await embedMany({
      model: fastembed,
      values: chunks.map((chunk) => chunk.text),
    });
    
    if (!embeddings || embeddings.length === 0) {
      throw new Error("Failed to generate embeddings");
    }
    
    return {
      embeddings,
      chunks,
      documentId,
      url,
    };
  },
});

// Step 5: Store embeddings in vector store
const storeStep = createStep({
  id: "store",
  description: "Store embeddings in vector store",
  inputSchema: z.object({
    embeddings: z.array(z.array(z.number())),
    chunks: z.array(z.object({
      text: z.string(),
    })),
    documentId: z.string(),
    url: z.string(),
  }),
  outputSchema: z.object({
    documentId: z.string(),
    chunksCount: z.number(),
    embeddingsCount: z.number(),
    indexName: z.string(),
  }),
  execute: async ({ inputData, getInitData }) => {
    const { embeddings, chunks, documentId, url } = inputData;
    const initData = getInitData();
    const indexName = initData.indexName || "documents";
    
    // Check if index exists, create if not
    try {
      // Try to create index (will fail silently if exists)
      await vector.createIndex({
        indexName,
        dimension: 384, // fastembed dimension
      });
    } catch (error) {
      // Index might already exist, continue
    }
    
    // Store embeddings with metadata
    await vector.upsert({
      indexName,
      vectors: embeddings,
      metadata: chunks.map((chunk, idx) => ({
        text: chunk.text,
        documentId,
        source: url,
        chunkIndex: idx,
        timestamp: new Date().toISOString(),
      })),
    });
    
    return {
      documentId,
      chunksCount: chunks.length,
      embeddingsCount: embeddings.length,
      indexName,
    };
  },
});

// Step 6: Save as note (optional)
const saveNoteStep = createStep({
  id: "save-note",
  description: "Save document as note in Second Brain (optional)",
  inputSchema: z.object({
    documentId: z.string(),
    chunksCount: z.number(),
    embeddingsCount: z.number(),
    indexName: z.string(),
  }),
  outputSchema: z.object({
    documentId: z.string(),
    chunksCount: z.number(),
    embeddingsCount: z.number(),
    indexName: z.string(),
    noteId: z.string().optional(),
  }),
  execute: async ({ inputData, getStepResult, getInitData }) => {
    const initData = getInitData();
    
    // Only save as note if requested
    if (!initData.saveAsNote) {
      return {
        ...inputData,
        noteId: undefined,
      };
    }
    
    const extractResult = getStepResult(extractTextStep);
    const { text, url } = extractResult;
    
    // Extract title from URL or first line of text
    const title = url.split("/").pop()?.replace(/\.[^/.]+$/, "") || 
                  text.split("\n")[0].substring(0, 100) || 
                  "Ingested Document";
    
    // Create note content
    const noteContent = `# ${title}

**Source URL:** ${url}
**Document ID:** ${inputData.documentId}
**Index:** ${inputData.indexName}
**Chunks:** ${inputData.chunksCount}
**Embeddings:** ${inputData.embeddingsCount}
**Ingested:** ${new Date().toISOString()}

---

## Content

${text.substring(0, 5000)}${text.length > 5000 ? "\n\n... (truncated)" : ""}
`;
    
    // Generate note ID with PARA prefix
    const paraCategory = initData.paraCategory || "resource_";
    const noteId = `${paraCategory}${inputData.documentId}`;
    
    // Save note
    const result = await saveNoteTool.execute({
      noteId,
      title: `${title} (Ingested)`,
      content: noteContent,
    });
    
    // Extract noteId from result if possible
    const noteIdMatch = typeof result === "string" 
      ? result.match(/ID[:\s"]+([^\s"]+)/i) 
      : null;
    const savedNoteId = noteIdMatch?.[1] || noteId;
    
    return {
      ...inputData,
      noteId: savedNoteId,
    };
  },
});

// Ingest Workflow
export const ingestWorkflow = createWorkflow({
  id: "ingest-workflow",
  description: "Workflow to ingest documents from URL, extract text, create chunks, generate embeddings, and save to vector store. Optionally saves as note in Second Brain.",
  inputSchema: ingestInputSchema,
  outputSchema: ingestOutputSchema,
})
  .then(downloadStep)
  .then(extractTextStep)
  .then(chunkStep)
  .then(embedStep)
  .then(storeStep)
  .then(saveNoteStep)
  .map(async ({ inputData }) => ({
    documentId: inputData.documentId,
    chunksCount: inputData.chunksCount,
    embeddingsCount: inputData.embeddingsCount,
    indexName: inputData.indexName,
    noteId: inputData.noteId,
  }));

ingestWorkflow.commit();
