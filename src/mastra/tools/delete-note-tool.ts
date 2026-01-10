import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";

const NOTES_DIR = path.resolve(__dirname, "../../../notes");

export const deleteNoteTool = createTool({
  id: "delete-note",
  description: "Delete a note by its ID. This action is permanent and cannot be undone.",
  inputSchema: z.object({
    noteId: z
      .string()
      .nonempty()
      .describe("The unique identifier of the note to delete."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { noteId } = inputData;
      const sanitizedNoteId = noteId.replace(/[^a-zA-Z0-9-_]/g, "_");
      
      await fs.mkdir(NOTES_DIR, { recursive: true });
      
      // Find the note file
      const files = await fs.readdir(NOTES_DIR);
      const noteFiles = files.filter((file) => file.startsWith("note_") && file.endsWith(".md"));
      const matchingFiles = noteFiles.filter((file) => file.includes(sanitizedNoteId));
      
      if (matchingFiles.length === 0) {
        return `No note found with ID "${noteId}" to delete.`;
      }
      
      // Get the most recent matching file (or delete all if multiple matches)
      matchingFiles.sort().reverse();
      const fileToDelete = matchingFiles[0];
      const filePath = path.join(NOTES_DIR, fileToDelete);
      
      // Read note title before deleting (for confirmation message)
      let noteTitle = "Unknown";
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const firstLine = content.split("\n")[0];
        if (firstLine.startsWith("# ")) {
          noteTitle = firstLine.substring(2).trim();
        }
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
