import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";

const NOTES_DIR = path.resolve(__dirname, "../../../notes");

export const listNotesTool = createTool({
  id: "list-notes",
  description: "List all available notes with optional filters. Returns metadata about notes including ID, title, creation date, and update date if available.",
  inputSchema: z.object({
    titleFilter: z
      .string()
      .optional()
      .describe("Optional filter to search notes by title (partial match)."),
    noteIdFilter: z
      .string()
      .optional()
      .describe("Optional filter to search notes by ID (partial match)."),
    maxResults: z
      .number()
      .optional()
      .default(50)
      .describe("Maximum number of results to return. Default is 50."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { titleFilter, noteIdFilter, maxResults = 50 } = inputData;
      
      await fs.mkdir(NOTES_DIR, { recursive: true });
      
      // Read all note files
      const files = await fs.readdir(NOTES_DIR);
      const noteFiles = files.filter((file) => file.startsWith("note_") && file.endsWith(".md"));
      
      if (noteFiles.length === 0) {
        return "No notes found in the notes directory.";
      }
      
      // Parse metadata from each note file
      const notesMetadata: Array<{
        noteId: string;
        title: string;
        createdAt: string;
        updatedAt?: string;
        fileName: string;
      }> = [];
      
      for (const file of noteFiles) {
        try {
          const filePath = path.join(NOTES_DIR, file);
          const content = await fs.readFile(filePath, "utf-8");
          const lines = content.split("\n");
          
          const metadataEndIndex = lines.findIndex((line) => line.trim() === "---");
          if (metadataEndIndex === -1) continue;
          
          const metadataLines = lines.slice(0, metadataEndIndex);
          
          let noteId = "";
          let title = "";
          let createdAt = "";
          let updatedAt: string | undefined;
          
          for (const line of metadataLines) {
            if (line.includes("**Note ID:**")) {
              noteId = line.split("**Note ID:**")[1].trim();
            } else if (line.includes("**Created:**")) {
              createdAt = line.split("**Created:**")[1].trim();
            } else if (line.includes("**Updated:**")) {
              updatedAt = line.split("**Updated:**")[1].trim();
            } else if (line.startsWith("# ")) {
              title = line.substring(2).trim();
            }
          }
          
          // Apply filters
          if (noteIdFilter && !noteId.toLowerCase().includes(noteIdFilter.toLowerCase())) {
            continue;
          }
          if (titleFilter && !title.toLowerCase().includes(titleFilter.toLowerCase())) {
            continue;
          }
          
          if (noteId && title) {
            notesMetadata.push({
              noteId,
              title,
              createdAt,
              updatedAt,
              fileName: file,
            });
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
      
      // Sort by creation date (most recent first)
      notesMetadata.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      
      // Limit results
      const limitedNotes = notesMetadata.slice(0, maxResults);
      
      if (limitedNotes.length === 0) {
        return `No notes found matching the specified filters. Total notes available: ${noteFiles.length}`;
      }
      
      // Format output
      const notesList = limitedNotes
        .map((note, index) => {
          const updatedInfo = note.updatedAt ? `\n  Updated: ${note.updatedAt}` : "";
          return `${index + 1}. **${note.title}**\n   ID: ${note.noteId}\n   Created: ${note.createdAt}${updatedInfo}\n   File: ${note.fileName}`;
        })
        .join("\n\n");
      
      return `Found ${limitedNotes.length} note(s)${noteFiles.length > limitedNotes.length ? ` (showing ${limitedNotes.length} of ${noteFiles.length} total)` : ""}:\n\n${notesList}`;
    } catch (error: any) {
      return `Error listing notes: ${error.message}`;
    }
  },
});
