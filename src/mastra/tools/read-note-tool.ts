import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import { NOTES_DIR } from "../constants/paths";
import { findMatchingFiles, readMarkdownFile } from "../utils/file-operations";
import { noteIdSchema } from "../schemas/note-schemas";

export const readNoteTool = createTool({
  id: "read-note",
  description: "Read an existing note by its ID or search pattern. Returns the note content and metadata.",
  inputSchema: z.object({
    noteId: noteIdSchema.describe("The unique identifier of the note to read. Can be partial - will find the most recent match."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { noteId } = inputData;
      
      // Find matching files using utility
      const matchingFiles = await findMatchingFiles(NOTES_DIR, "note", noteId);
      
      if (matchingFiles.length === 0) {
        // Check if directory exists and has files
        const files = await (await import("fs/promises")).readdir(NOTES_DIR).catch(() => []);
        const noteFiles = files.filter((file: string) => file.startsWith("note_") && file.endsWith(".md"));
        return `No note found with ID "${noteId}". Available notes: ${noteFiles.length} total.`;
      }
      
      // Get most recent file (already sorted by findMatchingFiles)
      const mostRecentFile = matchingFiles[0];
      const filePath = path.join(NOTES_DIR, mostRecentFile);
      
      // Read and return the note content
      const content = await readMarkdownFile(filePath);
      
      return `Note found: ${mostRecentFile}\n\n${content}`;
    } catch (error: any) {
      return `Error reading note: ${error.message}`;
    }
  },
});
