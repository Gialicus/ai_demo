import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";
import { NOTES_DIR } from "../constants/paths";
import { sanitizeId } from "../utils/sanitization";
import { noteIdSchema, noteTitleSchema, noteContentSchema } from "../schemas/note-schemas";

export const saveNoteTool = createTool({
  id: "save-note",
  description: "Save a note in markdown format. Useful for storing notes, intermediate results, or any text content.",
  inputSchema: z.object({
    noteId: noteIdSchema,
    title: noteTitleSchema,
    content: noteContentSchema,
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { noteId, title, content } = inputData;
      const sanitizedNoteId = sanitizeId(noteId);
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
