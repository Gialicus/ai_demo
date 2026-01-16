import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";
import fs from "fs/promises";
import path from "node:path";
import { createMocTool } from "../tools/basb/create-moc-tool";
import { getSecondBrainAgent, generateWithAgent } from "./shared/agent-helpers";
import { extractTopic, extractDescription } from "./shared/parsing-helpers";

// Input schema - percorso cartella
const mocFromFolderInputSchema = z.object({
  folderPath: z.string().describe("Path to the folder containing note files to include in the MOC"),
});

// Output schema - risultato finale
const mocFromFolderOutputSchema = z.object({
  mocId: z.string().describe("ID of the created MOC"),
  topic: z.string().describe("Topic/theme of the MOC (auto-detected from file contents)"),
  noteCount: z.number().describe("Number of notes included in the MOC"),
  noteIds: z.array(z.string()).describe("Array of note IDs included in the MOC"),
  description: z.string().optional().describe("Optional description of the MOC"),
});

// Step 1: Scan Folder Step - Legge i file e estrae noteIds
const scanFolderStep = createStep({
  id: "scan-folder",
  description: "Scan folder and extract note IDs from files",
  inputSchema: mocFromFolderInputSchema,
  outputSchema: z.object({
    files: z.array(z.object({
      noteId: z.string(),
      filePath: z.string(),
      content: z.string(),
      title: z.string(),
    })),
  }),
  execute: async ({ inputData }) => {
    const { folderPath } = inputData;
    
    // Risolvi il percorso assoluto
    const absolutePath = path.isAbsolute(folderPath) 
      ? folderPath 
      : path.resolve(process.cwd(), folderPath);
    
    try {
      // Verifica che la cartella esista
      const stats = await fs.stat(absolutePath);
      if (!stats.isDirectory()) {
        throw new Error(`Path "${folderPath}" is not a directory`);
      }
      
      // Leggi tutti i file nella cartella
      const files = await fs.readdir(absolutePath);
      
      // Filtra solo i file .md che iniziano con "note_"
      const noteFiles = files.filter((file) => 
        file.startsWith("note_") && file.endsWith(".md")
      );
      
      if (noteFiles.length === 0) {
        throw new Error(`No note files found in folder "${folderPath}"`);
      }
      
      // Estrai informazioni da ogni file
      const filesInfo = [];
      
      for (const file of noteFiles) {
        const filePath = path.join(absolutePath, file);
        
        try {
          // Leggi il contenuto del file
          const content = await fs.readFile(filePath, "utf-8");
          
          // Estrai noteId dal nome del file (pattern: note_{noteId}_{timestamp}.md)
          // Esempio: note_resource_learn_pizza_cooking_1768159569361.md
          // noteId sarebbe: resource_learn_pizza_cooking
          const fileNameMatch = file.match(/^note_(.+?)_\d+\.md$/);
          let noteId = fileNameMatch ? fileNameMatch[1] : null;
          
          // Se non trovato nel nome, prova a estrarre dal contenuto
          if (!noteId) {
            const contentMatch = content.match(/\*\*Note ID:\*\*\s*([^\s\n]+)/i);
            if (contentMatch) {
              noteId = contentMatch[1];
            } else {
              // Fallback: usa il nome del file senza prefisso e timestamp
              noteId = file.replace(/^note_/, "").replace(/_\d+\.md$/, "").replace(/\.md$/, "");
            }
          }
          
          // Estrai il title dal contenuto (prima riga con #)
          let title = noteId; // Default al noteId
          const lines = content.split("\n");
          for (const line of lines) {
            if (line.trim().startsWith("# ")) {
              title = line.trim().substring(2).trim();
              break;
            }
          }
          
          filesInfo.push({
            noteId,
            filePath,
            content,
            title,
          });
        } catch (error: any) {
          // Salta file che non possono essere letti
          console.warn(`Error reading file ${file}: ${error.message}`);
        }
      }
      
      if (filesInfo.length === 0) {
        throw new Error(`No valid note files could be read from folder "${folderPath}"`);
      }
      
      return {
        files: filesInfo,
      };
    } catch (error: any) {
      throw new Error(`Error scanning folder "${folderPath}": ${error.message}`);
    }
  },
});

// Step 2: Detect Topic Step - Rileva il topic dal contenuto
const detectTopicStep = createStep({
  id: "detect-topic",
  description: "Detect common topic/theme from note contents",
  inputSchema: z.object({
    files: z.array(z.object({
      noteId: z.string(),
      filePath: z.string(),
      content: z.string(),
      title: z.string(),
    })),
  }),
  outputSchema: z.object({
    topic: z.string(),
    description: z.string().optional(),
    files: z.array(z.object({
      noteId: z.string(),
      title: z.string(),
    })),
  }),
  execute: async ({ inputData, mastra }) => {
    const { files } = inputData;
    
    // Prepara un riepilogo dei contenuti per l'analisi
    const notesSummary = files.map((file, index) => 
      `Note ${index + 1}: "${file.title}" (ID: ${file.noteId})\n${file.content.substring(0, 500)}...`
    ).join("\n\n---\n\n");
    
    const agent = getSecondBrainAgent(mastra);
    
    const detectTopicPrompt = `Analyze the following notes and determine a common topic/theme for a Map of Content (MOC). 

The MOC should organize these notes by identifying what they have in common.

Notes to analyze:
${notesSummary}

Instructions:
1. Identify the common topic or theme that connects all these notes
2. Suggest a clear, concise topic name (2-5 words, e.g., "Cooking Recipes", "Machine Learning Basics", "Project Management")
3. Provide a brief description (1-2 sentences) explaining why these notes belong together
4. Return the topic and description in a clear format

Format your response as:
Topic: [topic name]
Description: [brief description]`;

    const resultText = await generateWithAgent(agent, detectTopicPrompt);
    
    // Estrai topic e description dal risultato usando utilities
    const topic = extractTopic(resultText) || "General Notes";
    const description = extractDescription(resultText);
    
    return {
      topic,
      description: description || undefined,
      files: files.map(({ noteId, title }) => ({ noteId, title })),
    };
  },
});

// Step 3: Create MOC Step - Crea il MOC
const createMocStep = createStep({
  id: "create-moc",
  description: "Create MOC using createMocTool",
  inputSchema: z.object({
    topic: z.string(),
    description: z.string().optional(),
    files: z.array(z.object({
      noteId: z.string(),
      title: z.string(),
    })),
  }),
  outputSchema: z.object({
    mocId: z.string(),
    success: z.boolean(),
    topic: z.string(),
    noteIds: z.array(z.string()),
  }),
  execute: async ({ inputData }) => {
    const { topic, description, files } = inputData;
    const noteIds = files.map((f) => f.noteId);
    
    if (noteIds.length === 0) {
      throw new Error("No note IDs to include in MOC");
    }
    
    // Usa direttamente createMocTool invece di mastra.getTool
    const result = await createMocTool.execute({
      topic,
      noteIds,
      description,
      category: "resource", // Default per MOC
    });
    
    // Estrai mocId dal risultato
    const mocIdMatch = typeof result === 'string' 
      ? result.match(/ID[:\s]+([^\s\n]+)/i) || result.match(/moc[_\s]+([^\s\n]+)/i)
      : null;
    
    const mocId = mocIdMatch?.[1] || `moc_resource_${topic.toLowerCase().replace(/[^a-z0-9]+/g, "_")}_${Date.now()}`;
    
    return {
      mocId,
      success: typeof result === 'string' && !result.toLowerCase().includes("error"),
      topic,
      noteIds,
    };
  },
});

// Step 4: Format Output Step - Formatta l'output finale
const formatOutputStep = createStep({
  id: "format-output",
  description: "Format final output",
  inputSchema: z.object({
    mocId: z.string(),
    success: z.boolean(),
    topic: z.string(),
    noteIds: z.array(z.string()),
  }),
  outputSchema: mocFromFolderOutputSchema,
  execute: async ({ inputData, getStepResult }) => {
    const detectTopicResult = getStepResult(detectTopicStep);
    
    return {
      mocId: inputData.mocId,
      topic: inputData.topic,
      noteCount: inputData.noteIds.length,
      noteIds: inputData.noteIds,
      description: detectTopicResult?.description,
    };
  },
});

// MOC from Folder Workflow
export const mocFromFolderWorkflow = createWorkflow({
  id: "moc-from-folder",
  description: "Workflow that scans a folder, extracts note IDs, auto-detects topic from contents, and creates a Map of Content (MOC) organizing all found notes",
  inputSchema: mocFromFolderInputSchema,
  outputSchema: mocFromFolderOutputSchema,
})
  .then(scanFolderStep)
  .then(detectTopicStep)
  .then(createMocStep)
  .then(formatOutputStep);

mocFromFolderWorkflow.commit();
