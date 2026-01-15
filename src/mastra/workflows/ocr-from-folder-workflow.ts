import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import fs from "fs/promises";
import path from "node:path";
import { MDocument } from "@mastra/rag";
import { embedMany } from "ai";
import { fastembed } from "@mastra/fastembed";
import { vector } from "../storage/vector";

// Input schema
const ocrFromFolderInputSchema = z.object({
  folderPath: z.string().describe("Path to the folder containing documents to process"),
  indexName: z.string().optional().default("documents").describe("Name of the vector index to use"),
  chunkOptions: z.object({
    strategy: z.enum(["recursive", "fixed"]).optional().default("recursive"),
    maxSize: z.number().optional().default(512),
    overlap: z.number().optional().default(50),
    separators: z.array(z.string()).optional().default(["\\n\\n", "\\n", " "]),
  }).optional(),
});

// Output schema
const ocrFromFolderOutputSchema = z.object({
  processedCount: z.number().describe("Number of documents successfully processed"),
  documents: z.array(z.object({
    documentId: z.string(),
    fileName: z.string(),
    fileType: z.string(),
    noteId: z.string().optional(),
    chunksCount: z.number(),
    embeddingsCount: z.number(),
    codeProcessed: z.boolean(),
    error: z.string().optional(),
  })),
  indexName: z.string(),
});

// Supported file extensions
const SUPPORTED_EXTENSIONS = {
  pdf: [".pdf"],
  image: [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"],
  html: [".html", ".htm"],
  text: [".txt", ".md"],
};

// Step 1: Scan folder for documents
const scanFolderStep = createStep({
  id: "scan-folder",
  description: "Scan folder and find supported documents (PDF, images, HTML, text)",
  inputSchema: ocrFromFolderInputSchema,
  outputSchema: z.object({
    files: z.array(z.object({
      filePath: z.string(),
      fileName: z.string(),
      fileType: z.enum(["pdf", "image", "html", "text"]),
      content: z.string(), // base64 for PDF/images, text for HTML/text
      mimeType: z.string(),
    })),
  }),
  execute: async ({ inputData }) => {
    const { folderPath } = inputData;
    
    // Resolve absolute path
    const absolutePath = path.isAbsolute(folderPath) 
      ? folderPath 
      : path.resolve(process.cwd(), folderPath);
    
    try {
      // Verify folder exists
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        throw new Error(`Path "${folderPath}" is not a directory`);
      }
      
      // Read all files in folder
      const files = await fs.readdir(absolutePath);
      
      // Filter supported document files
      const documentFiles: Array<{
        filePath: string;
        fileName: string;
        fileType: "pdf" | "image" | "html" | "text";
        content: string;
        mimeType: string;
      }> = [];
      
      for (const file of files) {
        const filePath = path.join(absolutePath, file);
        const ext = path.extname(file).toLowerCase();
        
        // Determine file type
        let fileType: "pdf" | "image" | "html" | "text" | null = null;
        let mimeType = "";
        
        if (SUPPORTED_EXTENSIONS.pdf.includes(ext)) {
          fileType = "pdf";
          mimeType = "application/pdf";
        } else if (SUPPORTED_EXTENSIONS.image.includes(ext)) {
          fileType = "image";
          mimeType = `image/${ext.substring(1)}`;
        } else if (SUPPORTED_EXTENSIONS.html.includes(ext)) {
          fileType = "html";
          mimeType = "text/html";
        } else if (SUPPORTED_EXTENSIONS.text.includes(ext)) {
          fileType = "text";
          mimeType = "text/plain";
        }
        
        if (!fileType) {
          continue; // Skip unsupported files
        }
        
        try {
          // Read file content
          let content: string;
          
          if (fileType === "pdf" || fileType === "image") {
            // Read as buffer and convert to base64
            const buffer = await fs.readFile(filePath);
            content = `BASE64_${mimeType}:${buffer.toString("base64")}`;
          } else {
            // Read as text
            content = await fs.readFile(filePath, "utf-8");
          }
          
          documentFiles.push({
            filePath,
            fileName: file,
            fileType,
            content,
            mimeType,
          });
        } catch (error: any) {
          console.warn(`Error reading file ${file}: ${error.message}`);
        }
      }
      
      if (documentFiles.length === 0) {
        throw new Error(`No supported documents found in folder "${folderPath}"`);
      }
      
      return {
        files: documentFiles,
      };
    } catch (error: any) {
      throw new Error(`Error scanning folder "${folderPath}": ${error.message}`);
    }
  },
});

// Step 2: Process each document
const processDocumentStep = createStep({
  id: "process-document",
  description: "Process document: extract text with OCR, create chunks, generate embeddings, save to vector store, and process with CODE cycle",
  inputSchema: z.object({
    files: z.array(z.object({
      filePath: z.string(),
      fileName: z.string(),
      fileType: z.enum(["pdf", "image", "html", "text"]),
      content: z.string(),
      mimeType: z.string(),
    })),
  }),
  outputSchema: z.object({
    documents: z.array(z.object({
      documentId: z.string(),
      fileName: z.string(),
      fileType: z.string(),
      text: z.string(),
      noteId: z.string().optional(),
      chunksCount: z.number(),
      embeddingsCount: z.number(),
      codeProcessed: z.boolean(),
      error: z.string().optional(),
    })),
  }),
  execute: async ({ inputData, mastra, getInitData }) => {
    const { files } = inputData;
    const initData = getInitData();
    const indexName = initData.indexName || "documents";
    const chunkOptions = initData.chunkOptions || {
      strategy: "recursive" as const,
      maxSize: 512,
      overlap: 50,
      separators: ["\n\n", "\n", " "],
    };
    
    const ocrAgent = mastra.getAgent("ocrAgent");
    const secondBrainAgent = mastra.getAgent("secondBrainAgent");
    
    const processedDocuments: Array<{
      documentId: string;
      fileName: string;
      fileType: string;
      text: string;
      noteId?: string;
      chunksCount: number;
      embeddingsCount: number;
      codeProcessed: boolean;
      error?: string;
    }> = [];
    
    // Process each document sequentially
    for (const file of files) {
      try {
        // Generate document ID
        const documentId = `doc_${file.fileName.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`;
        
        // Step 2.1: Extract text using OCR agent
        let text: string;
        try {
          let ocrPrompt: string;
          
          if (file.content.startsWith("BASE64_")) {
            // Extract mime type and base64 data
            const match = file.content.match(/^BASE64_([^:]+):(.+)$/);
            if (!match) {
              throw new Error("Invalid base64 format");
            }
            const [, mimeType, base64Data] = match;
            
            // For base64 documents, pass URL if file is accessible, otherwise use base64
            ocrPrompt = `Extract all text from this ${mimeType} document.

Document: ${file.fileName}
File Path: ${file.filePath}
Document ID: ${documentId}

Please extract ALL readable text from this document, preserving structure and formatting when possible. Return only the extracted text, without explanations or summaries.

The document is provided as base64 data. If you can access the file path directly, use that. Otherwise, process the base64 data.`;
          } else {
            // For text/HTML documents
            ocrPrompt = `Extract all text from this document.

Document: ${file.fileName}
File Path: ${file.filePath}
Document ID: ${documentId}
Content Type: ${file.mimeType}

Please extract ALL visible text content from this document, removing HTML tags but preserving text structure (headings, paragraphs, lists). Return only the extracted text, without explanations or summaries.

Document content:
${file.content.substring(0, 10000)}${file.content.length > 10000 ? "\n\n... (truncated)" : ""}`;
          }
          
          const ocrResult = await ocrAgent.generate(ocrPrompt);
          text = ocrResult.text || "";
          
          if (text.startsWith("ERROR:")) {
            throw new Error(text);
          }
          
          if (!text || text.trim().length === 0) {
            throw new Error("OCR agent returned empty text");
          }
          
          text = text.trim();
        } catch (error: any) {
          processedDocuments.push({
            documentId,
            fileName: file.fileName,
            fileType: file.fileType,
            text: "",
            chunksCount: 0,
            embeddingsCount: 0,
            codeProcessed: false,
            error: `OCR extraction failed: ${error.message}`,
          });
          continue;
        }
        
        // Step 2.2: Create chunks
        let chunks: Array<{ text: string }>;
        try {
          const doc = MDocument.fromText(text);
          const docChunks = await doc.chunk({
            strategy: chunkOptions.strategy || "recursive",
            maxSize: chunkOptions.maxSize || 512,
            overlap: chunkOptions.overlap || 50,
            separators: chunkOptions.separators || ["\n\n", "\n", " "],
          });
          
          chunks = docChunks.map((chunk) => ({
            text: chunk.text,
          }));
        } catch (error: any) {
          processedDocuments.push({
            documentId,
            fileName: file.fileName,
            fileType: file.fileType,
            text,
            chunksCount: 0,
            embeddingsCount: 0,
            codeProcessed: false,
            error: `Chunking failed: ${error.message}`,
          });
          continue;
        }
        
        // Step 2.3: Generate embeddings
        let embeddings: number[][];
        try {
          if (chunks.length === 0) {
            throw new Error("No chunks to embed");
          }
          
          const { embeddings: generatedEmbeddings } = await embedMany({
            model: fastembed,
            values: chunks.map((chunk) => chunk.text),
          });
          
          if (!generatedEmbeddings || generatedEmbeddings.length === 0) {
            throw new Error("Failed to generate embeddings");
          }
          
          embeddings = generatedEmbeddings;
        } catch (error: any) {
          processedDocuments.push({
            documentId,
            fileName: file.fileName,
            fileType: file.fileType,
            text,
            chunksCount: chunks.length,
            embeddingsCount: 0,
            codeProcessed: false,
            error: `Embedding generation failed: ${error.message}`,
          });
          continue;
        }
        
        // Step 2.4: Save embeddings to vector store
        try {
          // Check if index exists, create if not
          try {
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
              fileName: file.fileName,
              fileType: file.fileType,
              filePath: file.filePath,
              chunkIndex: idx,
              timestamp: new Date().toISOString(),
            })),
          });
        } catch (error: any) {
          processedDocuments.push({
            documentId,
            fileName: file.fileName,
            fileType: file.fileType,
            text,
            chunksCount: chunks.length,
            embeddingsCount: embeddings.length,
            codeProcessed: false,
            error: `Vector store save failed: ${error.message}`,
          });
          continue;
        }
        
        // Step 2.5: Process with secondBrainAgent (CODE cycle)
        let noteId: string | undefined;
        let codeProcessed = false;
        try {
          const codePrompt = `Process this document through the complete CODE cycle (Capture, Organize, Distill, Express) according to Building a Second Brain principles.

Document: ${file.fileName}
Document ID: ${documentId}
File Type: ${file.fileType}

Document content:
${text.substring(0, 10000)}${text.length > 10000 ? "\n\n... (truncated for processing)" : ""}

Instructions:
1. CAPTURE: Save this document as a note with appropriate PARA classification (project_, area_, resource_, archive_, or inbox_ if uncertain). Use saveNoteTool to create the note.
2. ORGANIZE: Classify the note according to PARA method. If needed, update the note with updateNoteTool. Search for related notes using listNotesTool and create bidirectional links using createLinkTool if relationships are found.
3. DISTILL: Create progressive summaries for the note (highlights, executive summary, sparklines). Update the note using updateNoteTool to add these sections.
4. EXPRESS: Generate any useful outputs (plans using savePlanTool, reports, summaries, etc.) based on the document content.

Return the noteId of the created/updated note and confirm that the CODE cycle was completed successfully.`;

          const codeResult = await secondBrainAgent.generate(codePrompt);
          
          // Extract noteId from result
          const noteIdMatch = codeResult.text?.match(/noteId[:\s]+([^\s\n]+)/i) || 
                             codeResult.text?.match(/ID[:\s]+([^\s\n]+)/i) ||
                             codeResult.text?.match(/note[:\s]+([^\s\n]+)/i);
          noteId = noteIdMatch?.[1];
          
          codeProcessed = codeResult.text !== undefined && 
                         (codeResult.text.toLowerCase().includes("captured") ||
                          codeResult.text.toLowerCase().includes("organized") ||
                          codeResult.text.toLowerCase().includes("distilled") ||
                          codeResult.text.toLowerCase().includes("expressed") ||
                          codeResult.text.toLowerCase().includes("success") ||
                          noteId !== undefined);
        } catch (error: any) {
          // CODE processing failed, but document was still processed for embeddings
          console.warn(`CODE cycle processing failed for ${file.fileName}: ${error.message}`);
        }
        
        // Document successfully processed
        processedDocuments.push({
          documentId,
          fileName: file.fileName,
          fileType: file.fileType,
          text,
          noteId,
          chunksCount: chunks.length,
          embeddingsCount: embeddings.length,
          codeProcessed,
        });
      } catch (error: any) {
        // General error processing document
        processedDocuments.push({
          documentId: `doc_${file.fileName.replace(/[^a-zA-Z0-9]/g, "_")}_${Date.now()}`,
          fileName: file.fileName,
          fileType: file.fileType,
          text: "",
          chunksCount: 0,
          embeddingsCount: 0,
          codeProcessed: false,
          error: `Processing failed: ${error.message}`,
        });
      }
    }
    
    return {
      documents: processedDocuments,
    };
  },
});

// Step 3: Format output
const formatOutputStep = createStep({
  id: "format-output",
  description: "Format final output with processing results",
  inputSchema: z.object({
    documents: z.array(z.object({
      documentId: z.string(),
      fileName: z.string(),
      fileType: z.string(),
      text: z.string(),
      noteId: z.string().optional(),
      chunksCount: z.number(),
      embeddingsCount: z.number(),
      codeProcessed: z.boolean(),
      error: z.string().optional(),
    })),
  }),
  outputSchema: ocrFromFolderOutputSchema,
  execute: async ({ inputData, getInitData }) => {
    const { documents } = inputData;
    const initData = getInitData();
    const indexName = initData.indexName || "documents";
    
    const processedCount = documents.filter((doc) => !doc.error).length;
    
    return {
      processedCount,
      documents: documents.map((doc) => ({
        documentId: doc.documentId,
        fileName: doc.fileName,
        fileType: doc.fileType,
        noteId: doc.noteId,
        chunksCount: doc.chunksCount,
        embeddingsCount: doc.embeddingsCount,
        codeProcessed: doc.codeProcessed,
        error: doc.error,
      })),
      indexName,
    };
  },
});

// OCR from Folder Workflow
export const ocrFromFolderWorkflow = createWorkflow({
  id: "ocr-from-folder-workflow",
  description: "Workflow that scans a folder, extracts text from documents using OCR agent, creates embeddings, saves to vector store, and processes each document with secondBrainAgent applying complete CODE cycle",
  inputSchema: ocrFromFolderInputSchema,
  outputSchema: ocrFromFolderOutputSchema,
})
  .then(scanFolderStep)
  .then(processDocumentStep)
  .then(formatOutputStep);

ocrFromFolderWorkflow.commit();
