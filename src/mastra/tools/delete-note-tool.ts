import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";
import { NOTES_DIR } from "../constants/paths";
import { findMatchingFiles, readMarkdownFile, parseFileMetadata } from "../utils/file-operations";
import { noteIdSchema } from "../schemas/note-schemas";

export const deleteNoteTool = createTool({
  id: "delete-note",
  description: "Delete a note by its ID. This action is permanent and cannot be undone.",
  inputSchema: z.object({
    noteId: noteIdSchema.describe("The unique identifier of the note to delete."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { noteId } = inputData;
      
      // Find matching files using utility
      const matchingFiles = await findMatchingFiles(NOTES_DIR, "note", noteId);
      
      if (matchingFiles.length === 0) {
        return `No note found with ID "${noteId}" to delete.`;
      }
      
      // Get the most recent matching file
      const fileToDelete = matchingFiles[0];
      const filePath = path.join(NOTES_DIR, fileToDelete);
      
      // Read note title before deleting (for confirmation message)
      let noteTitle = "Unknown";
      try {
        const content = await readMarkdownFile(filePath);
        const metadata = parseFileMetadata(content, "Note ID");
        noteTitle = metadata.title || noteTitle;
      } catch {
        // If we can't read, continue with deletion anyway
      }
      
      // Delete the file
      await fs.unlink(filePath);
      
      return `Successfully deleted note "${noteTitle}" with ID "${noteId}" (file: ${fileToDelete}).`;
    } catch (error: any) {
      return `Error deleting note: ${error.message}`;
    }
  },
});
