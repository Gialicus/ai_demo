import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";
import { NOTES_DIR } from "../constants/paths";
import { findMatchingFiles, readMarkdownFile, parseFileMetadata, getFileContent } from "../utils/file-operations";
import { sanitizeId } from "../utils/sanitization";
import { noteIdSchema, noteTitleSchema, noteContentSchema } from "../schemas/note-schemas";

export const updateNoteTool = createTool({
  id: "update-note",
  description: "Update an existing note. You can update the title, content, or both. The note ID remains unchanged and the updated timestamp is added.",
  inputSchema: z.object({
    noteId: noteIdSchema.describe("The unique identifier of the note to update."),
    title: noteTitleSchema.optional().describe("New title for the note. If not provided, the existing title is kept."),
    content: noteContentSchema.optional().describe("New content for the note. If not provided, the existing content is kept."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { noteId, title, content } = inputData;
      
      // Find matching files using utility
      const matchingFiles = await findMatchingFiles(NOTES_DIR, "note", noteId);
      
      if (matchingFiles.length === 0) {
        return `No note found with ID "${noteId}" to update.`;
      }
      
      // Get the most recent matching file
      const fileToUpdate = matchingFiles[0];
      const filePath = path.join(NOTES_DIR, fileToUpdate);
      
      // Read existing content
      const existingContent = await readMarkdownFile(filePath);
      
      // Parse existing metadata using utility
      const metadata = parseFileMetadata(existingContent, "Note ID");
      const existingContentText = getFileContent(existingContent);
      
      // Use provided title or keep existing
      const newTitle = title || metadata.title;
      const newContent = content !== undefined ? content : existingContentText;
      
      // Build updated note with metadata
      const updatedNoteContent = `# ${newTitle}\n\n**Note ID:** ${metadata.id || noteId}\n**Created:** ${metadata.createdAt || new Date().toISOString()}\n**Updated:** ${new Date().toISOString()}\n\n---\n\n${newContent}`;
      
      // Write updated content
      await fs.writeFile(filePath, updatedNoteContent, "utf-8");
      
      return `Successfully updated note "${newTitle}" with ID "${metadata.id || noteId}". File: ${fileToUpdate}`;
    } catch (error: any) {
      return `Error updating note: ${error.message}`;
    }
  },
});
