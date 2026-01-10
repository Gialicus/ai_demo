import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";

const NOTES_DIR = path.resolve(__dirname, "../../../notes");

export const saveNoteTool = createTool({
  id: "save-note",
  description: "Save a note in markdown format. Useful for storing notes, intermediate results, or any text content.",
  inputSchema: z.object({
    noteId: z
      .string()
      .nonempty()
      .describe("Unique identifier for the note. This will be used as part of the filename."),
    title: z
      .string()
      .nonempty()
      .describe("The title of the note."),
    content: z
      .string()
      .nonempty()
      .describe("The markdown content of the note."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { noteId, title, content } = inputData;
      const sanitizedNoteId = noteId.replace(/[^a-zA-Z0-9-_]/g, "_");
      const fileName = `note_${sanitizedNoteId}_${Date.now()}.md`;
      const filePath = path.join(NOTES_DIR, fileName);
      
      await fs.mkdir(NOTES_DIR, { recursive: true });
      
      // Add metadata header to the note file
      const noteContent = `# ${title}\n\n**Note ID:** ${noteId}\n**Created:** ${new Date().toISOString()}\n\n---\n\n${content}`;
      
      await fs.writeFile(filePath, noteContent, "utf-8");
      return `Successfully saved note "${title}" with ID "${noteId}" to ${fileName}`;
    } catch (error: any) {
      return `Error saving note: ${error.message}`;
    }
  },
});
