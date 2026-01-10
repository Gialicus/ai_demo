import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";

const NOTES_DIR = path.resolve(__dirname, "../../../notes");

export const createLinkTool = createTool({
  id: "create-link",
  description: "Create a bidirectional link between two notes. Links are stored in both notes' metadata and content sections.",
  inputSchema: z.object({
    sourceNoteId: z
      .string()
      .nonempty()
      .describe("The ID of the source note (where the link is being created from)."),
    targetNoteId: z
      .string()
      .nonempty()
      .describe("The ID of the target note (where the link points to)."),
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
      const sanitizedSourceId = sourceNoteId.replace(/[^a-zA-Z0-9-_]/g, "_");
      const sanitizedTargetId = targetNoteId.replace(/[^a-zA-Z0-9-_]/g, "_");
      
      await fs.mkdir(NOTES_DIR, { recursive: true });
      
      // Find both note files
      const files = await fs.readdir(NOTES_DIR);
      const noteFiles = files.filter((file) => file.startsWith("note_") && file.endsWith(".md"));
      
      const sourceFiles = noteFiles.filter((file) => file.includes(sanitizedSourceId));
      const targetFiles = noteFiles.filter((file) => file.includes(sanitizedTargetId));
      
      if (sourceFiles.length === 0) {
        return `Error: Source note with ID "${sourceNoteId}" not found.`;
      }
      if (targetFiles.length === 0) {
        return `Error: Target note with ID "${targetNoteId}" not found.`;
      }
      
      // Get most recent files
      sourceFiles.sort().reverse();
      targetFiles.sort().reverse();
      const sourceFile = sourceFiles[0];
      const targetFile = targetFiles[0];
      
      if (sourceFile === targetFile) {
        return `Error: Cannot link a note to itself.`;
      }
      
      const sourcePath = path.join(NOTES_DIR, sourceFile);
      const targetPath = path.join(NOTES_DIR, targetFile);
      
      // Read both notes
      const sourceContent = await fs.readFile(sourcePath, "utf-8");
      const targetContent = await fs.readFile(targetPath, "utf-8");
      
      // Parse source note
      const sourceLines = sourceContent.split("\n");
      const sourceMetadataEndIndex = sourceLines.findIndex((line) => line.trim() === "---");
      
      if (sourceMetadataEndIndex === -1) {
        return `Error: Source note format is invalid. Cannot find metadata separator.`;
      }
      
      // Parse target note to get its title
      const targetLines = targetContent.split("\n");
      const targetMetadataEndIndex = targetLines.findIndex((line) => line.trim() === "---");
      let targetTitle = targetNoteId;
      
      if (targetMetadataEndIndex !== -1) {
        const targetMetadataLines = targetLines.slice(0, targetMetadataEndIndex);
        for (const line of targetMetadataLines) {
          if (line.startsWith("# ")) {
            targetTitle = line.substring(2).trim();
            break;
          }
        }
      }
      
      // Add link to source note
      const sourceMetadataLines = sourceLines.slice(0, sourceMetadataEndIndex);
      const sourceContentLines = sourceLines.slice(sourceMetadataEndIndex + 1);
      
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
      
      // Update source note metadata
      let extractedSourceNoteId = sourceNoteId;
      let sourceTitle = "";
      let sourceCreatedAt = new Date().toISOString();
      let sourceUpdatedAt = new Date().toISOString();
      
      for (const line of sourceMetadataLines) {
        if (line.includes("**Note ID:**")) {
          extractedSourceNoteId = line.split("**Note ID:**")[1].trim();
        } else if (line.includes("**Created:**")) {
          sourceCreatedAt = line.split("**Created:**")[1].trim();
        } else if (line.includes("**Updated:**")) {
          // Keep existing updated time, we'll override
        } else if (line.startsWith("# ")) {
          sourceTitle = line.substring(2).trim();
        }
      }
      
      const updatedSourceContent = `${sourceLines.slice(0, sourceMetadataEndIndex).join("\n")}\n**Updated:** ${sourceUpdatedAt}\n---\n${sourceContentLines.join("\n")}`;
      await fs.writeFile(sourcePath, updatedSourceContent, "utf-8");
      
      // Also add reverse link to target note (simpler, just in content)
      const targetMetadataLines = targetLines.slice(0, targetMetadataEndIndex);
      const targetContentLines = targetLines.slice(targetMetadataEndIndex + 1);
      
      // Get source title
      let sourceTitleForLink = extractedSourceNoteId;
      for (const line of sourceMetadataLines) {
        if (line.startsWith("# ")) {
          sourceTitleForLink = line.substring(2).trim();
          break;
        }
      }
      
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
      
      // Update target note metadata
      let extractedTargetNoteId = targetNoteId;
      let extractedTargetTitle = targetTitle;
      let targetCreatedAt = new Date().toISOString();
      let targetUpdatedAt = new Date().toISOString();
      
      for (const line of targetMetadataLines) {
        if (line.includes("**Note ID:**")) {
          extractedTargetNoteId = line.split("**Note ID:**")[1].trim();
        } else if (line.includes("**Created:**")) {
          targetCreatedAt = line.split("**Created:**")[1].trim();
        } else if (line.includes("**Updated:**")) {
          // Keep existing, we'll override
        } else if (line.startsWith("# ")) {
          extractedTargetTitle = line.substring(2).trim();
        }
      }
      
      const updatedTargetContent = `${targetLines.slice(0, targetMetadataEndIndex).join("\n")}\n**Updated:** ${targetUpdatedAt}\n---\n${targetContentLines.join("\n")}`;
      await fs.writeFile(targetPath, updatedTargetContent, "utf-8");
      
      return `Successfully created bidirectional link between "${extractedSourceNoteId}" and "${extractedTargetNoteId}" with relationship type "${linkType}". Both notes have been updated.`;
    } catch (error: any) {
      return `Error creating link: ${error.message}`;
    }
  },
});