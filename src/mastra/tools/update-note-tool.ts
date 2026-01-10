import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";

const NOTES_DIR = path.resolve(__dirname, "../../../notes");

export const updateNoteTool = createTool({
  id: "update-note",
  description: "Update an existing note. You can update the title, content, or both. The note ID remains unchanged and the updated timestamp is added.",
  inputSchema: z.object({
    noteId: z
      .string()
      .nonempty()
      .describe("The unique identifier of the note to update."),
    title: z
      .string()
      .optional()
      .describe("New title for the note. If not provided, the existing title is kept."),
    content: z
      .string()
      .optional()
      .describe("New content for the note. If not provided, the existing content is kept."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { noteId, title, content } = inputData;
      const sanitizedNoteId = noteId.replace(/[^a-zA-Z0-9-_]/g, "_");
      
      await fs.mkdir(NOTES_DIR, { recursive: true });
      
      // Find the note file
      const files = await fs.readdir(NOTES_DIR);
      const noteFiles = files.filter((file) => file.startsWith("note_") && file.endsWith(".md"));
      const matchingFiles = noteFiles.filter((file) => file.includes(sanitizedNoteId));
      
      if (matchingFiles.length === 0) {
        return `No note found with ID "${noteId}" to update.`;
      }
      
      // Get the most recent matching file
      matchingFiles.sort().reverse();
      const fileToUpdate = matchingFiles[0];
      const filePath = path.join(NOTES_DIR, fileToUpdate);
      
      // Read existing content
      const existingContent = await fs.readFile(filePath, "utf-8");
      
      // Parse existing metadata
      const lines = existingContent.split("\n");
      const metadataEndIndex = lines.findIndex((line) => line.trim() === "---");
      
      if (metadataEndIndex === -1) {
        return `Error: Note file format is invalid. Cannot find metadata separator.`;
      }
      
      const metadataLines = lines.slice(0, metadataEndIndex);
      const existingContentLines = lines.slice(metadataEndIndex + 1);
      
      // Extract existing metadata
      let existingNoteId = noteId;
      let existingTitle = title || "";
      let createdAt = new Date().toISOString();
      
      for (const line of metadataLines) {
        if (line.includes("**Note ID:**")) {
          existingNoteId = line.split("**Note ID:**")[1].trim();
        } else if (line.includes("**Created:**")) {
          createdAt = line.split("**Created:**")[1].trim();
        } else if (line.startsWith("# ")) {
          existingTitle = line.substring(2).trim();
        }
      }
      
      // Use provided title or keep existing
      const newTitle = title || existingTitle;
      const newContent = content !== undefined ? content : existingContentLines.join("\n").trim();
      
      // Build updated note with metadata
      const updatedNoteContent = `# ${newTitle}\n\n**Note ID:** ${existingNoteId}\n**Created:** ${createdAt}\n**Updated:** ${new Date().toISOString()}\n\n---\n\n${newContent}`;
      
      // Write updated content
      await fs.writeFile(filePath, updatedNoteContent, "utf-8");
      
      return `Successfully updated note "${newTitle}" with ID "${existingNoteId}". File: ${fileToUpdate}`;
    } catch (error: any) {
      return `Error updating note: ${error.message}`;
    }
  },
});
