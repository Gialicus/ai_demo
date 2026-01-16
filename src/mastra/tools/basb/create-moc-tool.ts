import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";
import { saveNoteTool } from "../notes/save-note-tool";
import { NOTES_DIR } from "../../constants/paths";
import { findMatchingFiles, readMarkdownFile, parseFileMetadata } from "../../utils/file-operations";
import { sanitizeId } from "../../utils/sanitization";

export const createMocTool = createTool({
  id: "create-moc",
  description: "Create a Map of Content (MOC) note that organizes related notes by topic. A MOC is a special note that acts as an index or table of contents for a group of related notes.",
  inputSchema: z.object({
    topic: z
      .string()
      .nonempty()
      .describe("The topic or theme for the Map of Content (e.g., 'Machine Learning', 'Project Management', 'Personal Finance')."),
    noteIds: z
      .array(z.string())
      .min(1)
      .describe("Array of note IDs to include in the MOC."),
    description: z
      .string()
      .optional()
      .describe("Optional description explaining the purpose of this MOC."),
    category: z
      .enum(["project", "area", "resource", "archive"])
      .optional()
      .default("resource")
      .describe("PARA category for the MOC. Defaults to 'resource' as MOCs are typically reference material."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { topic, noteIds, description, category = "resource" } = inputData;
      const sanitizedTopic = sanitizeId(topic).toLowerCase();
      const mocId = `moc_${category}_${sanitizedTopic}_${Date.now()}`;
      
      await fs.mkdir(NOTES_DIR, { recursive: true });
      
      const notesInfo: Array<{ id: string; title: string; category?: string }> = [];
      
      // Find and read each note using utilities
      for (const noteId of noteIds) {
        const matchingFiles = await findMatchingFiles(NOTES_DIR, "note", noteId);
        
        if (matchingFiles.length === 0) {
          continue; // Skip notes that don't exist
        }
        
        const noteFile = matchingFiles[0];
        const notePath = path.join(NOTES_DIR, noteFile);
        const noteContent = await readMarkdownFile(notePath);
        
        // Parse metadata using utility
        const metadata = parseFileMetadata(noteContent, "Note ID");
        
        notesInfo.push({
          id: metadata.id || noteId,
          title: metadata.title || noteId,
          category: metadata.category,
        });
      }
      
      if (notesInfo.length === 0) {
        return `Error: None of the specified note IDs were found. Cannot create MOC.`;
      }
      
      // Organize notes by category for better structure
      const notesByCategory: Record<string, Array<{ id: string; title: string }>> = {
        project: [],
        area: [],
        resource: [],
        archive: [],
        uncategorized: [],
      };
      
      for (const note of notesInfo) {
        const cat = note.category || "uncategorized";
        notesByCategory[cat].push({ id: note.id, title: note.title });
      }
      
      // Create MOC content
      const mocTitle = `Map of Content: ${topic}`;
      let mocContent = description ? `${description}\n\n` : "";
      mocContent += `This Map of Content (MOC) organizes related notes about "${topic}".\n\n`;
      mocContent += `**Created:** ${new Date().toISOString()}\n`;
      mocContent += `**Total Notes:** ${notesInfo.length}\n\n`;
      mocContent += "---\n\n";
      mocContent += `## Notes by Category\n\n`;
      
      // Add notes organized by category
      const categoryOrder = ["project", "area", "resource", "archive", "uncategorized"];
      for (const cat of categoryOrder) {
        const notesInCat = notesByCategory[cat];
        if (notesInCat.length > 0) {
          mocContent += `### ${cat.charAt(0).toUpperCase() + cat.slice(1)}\n\n`;
          for (const note of notesInCat) {
            mocContent += `- [${note.title}](note:${note.id})\n`;
          }
          mocContent += "\n";
        }
      }
      
      // Add all notes in a simple list as well
      mocContent += `## All Notes\n\n`;
      for (const note of notesInfo) {
        mocContent += `- [${note.title}](note:${note.id})${note.category ? ` (${note.category})` : ""}\n`;
      }
      
      // Save the MOC note
      const saveResult = await saveNoteTool.execute({
        noteId: mocId,
        title: mocTitle,
        content: mocContent,
      });
      
      // Also update each note to link back to the MOC
      // This would be done by the link agent, but we can add it here too
      // For now, just return success
      
      return `Successfully created Map of Content "${mocTitle}" with ID "${mocId}" containing ${notesInfo.length} note(s). ${saveResult}`;
    } catch (error: any) {
      return `Error creating MOC: ${error.message}`;
    }
  },
});