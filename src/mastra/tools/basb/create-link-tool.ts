import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";
import { NOTES_DIR } from "../../constants/paths";
import { findMatchingFiles, readMarkdownFile, parseFileMetadata, getFileContent, FileMetadata } from "../../utils/file-operations";
import { sanitizeId } from "../../utils/sanitization";
import { noteIdSchema } from "../../schemas/note-schemas";

/**
 * Helper function to build note content with metadata
 */
function buildNoteContent(metadata: FileMetadata, content: string): string {
  const metadataLines = [`# ${metadata.title}`];
  if (metadata.id) {
    metadataLines.push(`**Note ID:** ${metadata.id}`);
  }
  if (metadata.createdAt) {
    metadataLines.push(`**Created:** ${metadata.createdAt}`);
  }
  metadataLines.push(`**Updated:** ${new Date().toISOString()}`);
  metadataLines.push("---");
  
  return `${metadataLines.join("\n")}\n${content}`;
}

export const createLinkTool = createTool({
  id: "create-link",
  description: "Create a bidirectional link between two notes. Links are stored in both notes' metadata and content sections.",
  inputSchema: z.object({
    sourceNoteId: noteIdSchema.describe("The ID of the source note (where the link is being created from)."),
    targetNoteId: noteIdSchema.describe("The ID of the target note (where the link points to)."),
    linkType: z
      .enum(["related", "references", "builds-on", "part-of", "example-of"])
      .optional()
      .default("related")
      .describe("Type of relationship: 'related' (general relation), 'references' (source references target), 'builds-on' (source builds on target), 'part-of' (source is part of target), 'example-of' (source is example of target)."),
    description: z
      .string()
      .optional()
      .describe("Optional description of the relationship between the notes."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { sourceNoteId, targetNoteId, linkType = "related", description } = inputData;
      
      // Find both note files using utility
      const sourceFiles = await findMatchingFiles(NOTES_DIR, "note", sourceNoteId);
      const targetFiles = await findMatchingFiles(NOTES_DIR, "note", targetNoteId);
      
      if (sourceFiles.length === 0) {
        return `Error: Source note with ID "${sourceNoteId}" not found.`;
      }
      if (targetFiles.length === 0) {
        return `Error: Target note with ID "${targetNoteId}" not found.`;
      }
      
      // Get most recent files (already sorted by findMatchingFiles)
      const sourceFile = sourceFiles[0];
      const targetFile = targetFiles[0];
      
      if (sourceFile === targetFile) {
        return `Error: Cannot link a note to itself.`;
      }
      
      const sourcePath = path.join(NOTES_DIR, sourceFile);
      const targetPath = path.join(NOTES_DIR, targetFile);
      
      // Read both notes using utility
      const sourceContent = await readMarkdownFile(sourcePath);
      const targetContent = await readMarkdownFile(targetPath);
      
      // Parse metadata using utility
      const targetMetadata = parseFileMetadata(targetContent, "Note ID");
      const targetTitle = targetMetadata.title || targetNoteId;
      
      // Get content sections
      const sourceContentLines = getFileContent(sourceContent).split("\n");
      const targetContentLines = getFileContent(targetContent).split("\n");
      
      // Check if "Related Notes" section exists
      let relatedNotesIndex = -1;
      for (let i = 0; i < sourceContentLines.length; i++) {
        if (sourceContentLines[i].trim().toLowerCase().startsWith("## related notes")) {
          relatedNotesIndex = i;
          break;
        }
      }
      
      const linkLine = `- [${targetTitle}](note:${targetNoteId}) (${linkType})${description ? ` - ${description}` : ""}`;
      
      if (relatedNotesIndex === -1) {
        // Add new "Related Notes" section
        sourceContentLines.unshift("", "## Related Notes", "", linkLine);
      } else {
        // Add to existing section (after the header, before next section)
        let insertIndex = relatedNotesIndex + 1;
        while (insertIndex < sourceContentLines.length && 
               !sourceContentLines[insertIndex].trim().startsWith("##")) {
          insertIndex++;
        }
        sourceContentLines.splice(insertIndex, 0, linkLine);
      }
      
      // Parse source metadata
      const sourceMetadata = parseFileMetadata(sourceContent, "Note ID");
      const extractedSourceNoteId = sourceMetadata.id || sourceNoteId;
      const sourceTitle = sourceMetadata.title;
      const sourceTitleForLink = sourceTitle;
      
      // Check if "Related Notes" section exists in target
      let targetRelatedNotesIndex = -1;
      for (let i = 0; i < targetContentLines.length; i++) {
        if (targetContentLines[i].trim().toLowerCase().startsWith("## related notes")) {
          targetRelatedNotesIndex = i;
          break;
        }
      }
      
      const reverseLinkLine = `- [${sourceTitleForLink}](note:${extractedSourceNoteId}) (${linkType})${description ? ` - ${description}` : ""}`;
      
      if (targetRelatedNotesIndex === -1) {
        targetContentLines.unshift("", "## Related Notes", "", reverseLinkLine);
      } else {
        let insertIndex = targetRelatedNotesIndex + 1;
        while (insertIndex < targetContentLines.length && 
               !targetContentLines[insertIndex].trim().startsWith("##")) {
          insertIndex++;
        }
        targetContentLines.splice(insertIndex, 0, reverseLinkLine);
      }
      
      // Parse target metadata
      const extractedTargetNoteId = targetMetadata.id || targetNoteId;
      const extractedTargetTitle = targetTitle;
      
      // Build updated content for both notes
      const sourceUpdatedContent = buildNoteContent(sourceMetadata, sourceContentLines.join("\n"));
      const targetUpdatedContent = buildNoteContent(targetMetadata, targetContentLines.join("\n"));
      
      await fs.writeFile(sourcePath, sourceUpdatedContent, "utf-8");
      await fs.writeFile(targetPath, targetUpdatedContent, "utf-8");
      
      return `Successfully created bidirectional link between "${extractedSourceNoteId}" and "${extractedTargetNoteId}" with relationship type "${linkType}". Both notes have been updated.`;
    } catch (error: any) {
      return `Error creating link: ${error.message}`;
    }
  },
});