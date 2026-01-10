import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";

const NOTES_DIR = path.resolve(__dirname, "../../../notes");

export const readNoteTool = createTool({
  id: "read-note",
  description: "Read an existing note by its ID or search pattern. Returns the note content and metadata.",
  inputSchema: z.object({
    noteId: z
      .string()
      .nonempty()
      .describe("The unique identifier of the note to read. Can be partial - will find the most recent match."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { noteId } = inputData;
      const sanitizedNoteId = noteId.replace(/[^a-zA-Z0-9-_]/g, "_");
      
      await fs.mkdir(NOTES_DIR, { recursive: true });
      
      // Read all files in the notes directory
      const files = await fs.readdir(NOTES_DIR);
      const noteFiles = files.filter((file) => file.startsWith("note_") && file.endsWith(".md"));
      
      if (noteFiles.length === 0) {
        return `No notes found in the notes directory.`;
      }
      
      // Find files matching the noteId (partial match)
      const matchingFiles = noteFiles.filter((file) => file.includes(sanitizedNoteId));
      
      if (matchingFiles.length === 0) {
        return `No note found with ID "${noteId}". Available notes: ${noteFiles.length} total.`;
      }
      
      // Sort by filename (which includes timestamp) to get the most recent
      matchingFiles.sort().reverse();
      const mostRecentFile = matchingFiles[0];
      const filePath = path.join(NOTES_DIR, mostRecentFile);
      
      // Read and return the note content
      const content = await fs.readFile(filePath, "utf-8");
      
      return `Note found: ${mostRecentFile}\n\n${content}`;
    } catch (error: any) {
      return `Error reading note: ${error.message}`;
    }
  },
});
