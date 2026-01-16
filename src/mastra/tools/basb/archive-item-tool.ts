import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";
import { updateNoteTool } from "../notes/update-note-tool";
import { updatePlanTool } from "../plans/update-plan-tool";
import { readNoteTool } from "../notes/read-note-tool";
import { readPlanTool } from "../plans/read-plan-tool";

const NOTES_DIR = path.resolve(__dirname, "../../../notes");
const PLANS_DIR = path.resolve(__dirname, "../../../plans");

export const archiveItemTool = createTool({
  id: "archive-item",
  description: "Archive a note or plan by changing its PARA prefix to 'archive_' and adding metadata about when and why it was archived. Supports both notes and plans.",
  inputSchema: z.object({
    itemId: z
      .string()
      .nonempty()
      .describe("The ID of the note or plan to archive."),
    itemType: z
      .enum(["note", "plan"])
      .describe("Type of item to archive: 'note' or 'plan'."),
    reason: z
      .string()
      .optional()
      .describe("Optional reason for archiving (e.g., 'Project completed', 'No longer relevant', 'Outdated')."),
    keepOriginalPrefix: z
      .boolean()
      .optional()
      .default(false)
      .describe("If true, keeps the original prefix in addition to adding 'archive_' prefix (e.g., 'archive_project_'). If false, replaces prefix with 'archive_'."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { itemId, itemType, reason, keepOriginalPrefix = false } = inputData;
      
      if (itemType === "note") {
        // Read the note first to get its current content
        const noteContentResult = await readNoteTool.execute({ noteId: itemId });
        const noteContent = typeof noteContentResult === "string" ? noteContentResult : String(noteContentResult);
        
        if (noteContent.startsWith("Error") || noteContent.startsWith("No note found")) {
          return `Error: Note with ID "${itemId}" not found.`;
        }
        
        // Parse the note to get its current prefix
        const sanitizedNoteId = itemId.replace(/[^a-zA-Z0-9-_]/g, "_");
        await fs.mkdir(NOTES_DIR, { recursive: true });
        
        const files = await fs.readdir(NOTES_DIR);
        const noteFiles = files.filter((file) => file.startsWith("note_") && file.endsWith(".md"));
        const matchingFiles = noteFiles.filter((file) => file.includes(sanitizedNoteId));
        
        if (matchingFiles.length === 0) {
          return `Error: Note with ID "${itemId}" not found.`;
        }
        
        matchingFiles.sort().reverse();
        const fileToArchive = matchingFiles[0];
        const filePath = path.join(NOTES_DIR, fileToArchive);
        
        // Read existing content
        const existingContent = await fs.readFile(filePath, "utf-8");
        const lines = existingContent.split("\n");
        const metadataEndIndex = lines.findIndex((line) => line.trim() === "---");
        
        if (metadataEndIndex === -1) {
          return `Error: Note file format is invalid. Cannot find metadata separator.`;
        }
        
        const metadataLines = lines.slice(0, metadataEndIndex);
        const contentLines = lines.slice(metadataEndIndex + 1);
        
        // Extract existing metadata
        let existingNoteId = itemId;
        let existingTitle = "";
        let createdAt = new Date().toISOString();
        let updatedAt = new Date().toISOString();
        
        for (const line of metadataLines) {
          if (line.includes("**Note ID:**")) {
            existingNoteId = line.split("**Note ID:**")[1].trim();
          } else if (line.includes("**Created:**")) {
            createdAt = line.split("**Created:**")[1].trim();
          } else if (line.includes("**Updated:**")) {
            updatedAt = line.split("**Updated:**")[1].trim();
          } else if (line.startsWith("# ")) {
            existingTitle = line.substring(2).trim();
          }
        }
        
        // Determine new ID based on keepOriginalPrefix
        let newNoteId = existingNoteId;
        if (!existingNoteId.startsWith("archive_")) {
          if (keepOriginalPrefix) {
            // Extract original prefix if any (project_, area_, resource_)
            const prefixMatch = existingNoteId.match(/^(project_|area_|resource_|inbox_)(.+)$/);
            if (prefixMatch) {
              newNoteId = `archive_${prefixMatch[1]}${prefixMatch[2]}`;
            } else {
              newNoteId = `archive_${existingNoteId}`;
            }
          } else {
            // Remove any prefix and add archive_
            const withoutPrefix = existingNoteId.replace(/^(project_|area_|resource_|inbox_)/, "");
            newNoteId = `archive_${withoutPrefix}`;
          }
        }
        
        // Build updated metadata with archive information
        const archiveMetadata = [
          `# ${existingTitle}`,
          `**Note ID:** ${newNoteId}`,
          `**Created:** ${createdAt}`,
          `**Updated:** ${updatedAt}`,
          `**Archived:** ${new Date().toISOString()}`,
          reason ? `**Archive Reason:** ${reason}` : null,
          "---",
        ].filter(Boolean).join("\n");
        
        // Add archive section to content
        let updatedContent = contentLines.join("\n");
        if (!updatedContent.includes("## Archive Status")) {
          const archiveSection = `\n\n## Archive Status\n\n**Archived on:** ${new Date().toISOString()}\n${reason ? `**Reason:** ${reason}\n` : ""}This item has been archived and is no longer active. It is kept for reference purposes.\n`;
          updatedContent = archiveSection + updatedContent;
        }
        
        // Update note content
        const updatedNoteContent = `${archiveMetadata}\n${updatedContent}`;
        await fs.writeFile(filePath, updatedNoteContent, "utf-8");
        
        // If the ID changed, we need to update it using updateNoteTool
        if (newNoteId !== existingNoteId) {
          // Read the file content again and update the ID in metadata
          const finalContent = await fs.readFile(filePath, "utf-8");
          const finalLines = finalContent.split("\n");
          const finalMetadataEndIndex = finalLines.findIndex((line) => line.trim() === "---");
          
          if (finalMetadataEndIndex !== -1) {
            const finalMetadataLines = finalLines.slice(0, finalMetadataEndIndex);
            const finalContentLines = finalLines.slice(finalMetadataEndIndex + 1);
            
            // Update the Note ID line
            const updatedMetadataLines = finalMetadataLines.map((line) => {
              if (line.includes("**Note ID:**")) {
                return `**Note ID:** ${newNoteId}`;
              }
              return line;
            });
            
            // Update the title if it starts with #
            const updatedTitleLines = updatedMetadataLines.map((line) => {
              if (line.startsWith("# ")) {
                return `# ${existingTitle}`;
              }
              return line;
            });
            
            const finalNoteContent = `${updatedTitleLines.join("\n")}\n---\n${finalContentLines.join("\n")}`;
            await fs.writeFile(filePath, finalNoteContent, "utf-8");
          }
        }
        
        return `Successfully archived note "${existingTitle}" with ID "${newNoteId}". ${reason ? `Reason: ${reason}` : ""}`;
        
      } else if (itemType === "plan") {
        // Read the plan first
        const planContentResult = await readPlanTool.execute({ planId: itemId });
        const planContent = typeof planContentResult === "string" ? planContentResult : String(planContentResult);
        
        if (planContent.startsWith("Error") || planContent.startsWith("No plan found")) {
          return `Error: Plan with ID "${itemId}" not found.`;
        }
        
        // Similar process for plans
        const sanitizedPlanId = itemId.replace(/[^a-zA-Z0-9-_]/g, "_");
        await fs.mkdir(PLANS_DIR, { recursive: true });
        
        const files = await fs.readdir(PLANS_DIR);
        const planFiles = files.filter((file) => file.startsWith("plan_") && file.endsWith(".md"));
        const matchingFiles = planFiles.filter((file) => file.includes(sanitizedPlanId));
        
        if (matchingFiles.length === 0) {
          return `Error: Plan with ID "${itemId}" not found.`;
        }
        
        matchingFiles.sort().reverse();
        const fileToArchive = matchingFiles[0];
        const filePath = path.join(PLANS_DIR, fileToArchive);
        
        // Read existing content
        const existingContent = await fs.readFile(filePath, "utf-8");
        const lines = existingContent.split("\n");
        const metadataEndIndex = lines.findIndex((line) => line.trim() === "---");
        
        if (metadataEndIndex === -1) {
          return `Error: Plan file format is invalid. Cannot find metadata separator.`;
        }
        
        const metadataLines = lines.slice(0, metadataEndIndex);
        const contentLines = lines.slice(metadataEndIndex + 1);
        
        // Extract existing metadata
        let existingPlanId = itemId;
        let existingTitle = "";
        let createdAt = new Date().toISOString();
        let updatedAt = new Date().toISOString();
        
        for (const line of metadataLines) {
          if (line.includes("**Plan ID:**")) {
            existingPlanId = line.split("**Plan ID:**")[1].trim();
          } else if (line.includes("**Created:**")) {
            createdAt = line.split("**Created:**")[1].trim();
          } else if (line.includes("**Updated:**")) {
            updatedAt = line.split("**Updated:**")[1].trim();
          } else if (line.startsWith("# ")) {
            existingTitle = line.substring(2).trim();
          }
        }
        
        // Determine new ID
        let newPlanId = existingPlanId;
        if (!existingPlanId.startsWith("archive_")) {
          if (keepOriginalPrefix) {
            const prefixMatch = existingPlanId.match(/^(project_|area_|resource_|inbox_)(.+)$/);
            if (prefixMatch) {
              newPlanId = `archive_${prefixMatch[1]}${prefixMatch[2]}`;
            } else {
              newPlanId = `archive_${existingPlanId}`;
            }
          } else {
            const withoutPrefix = existingPlanId.replace(/^(project_|area_|resource_|inbox_)/, "");
            newPlanId = `archive_${withoutPrefix}`;
          }
        }
        
        // Build updated metadata
        const archiveMetadata = [
          `# ${existingTitle}`,
          `**Plan ID:** ${newPlanId}`,
          `**Created:** ${createdAt}`,
          `**Updated:** ${updatedAt}`,
          `**Archived:** ${new Date().toISOString()}`,
          reason ? `**Archive Reason:** ${reason}` : null,
          "---",
        ].filter(Boolean).join("\n");
        
        // Add archive section to content
        let updatedContent = contentLines.join("\n");
        if (!updatedContent.includes("## Archive Status")) {
          const archiveSection = `\n\n## Archive Status\n\n**Archived on:** ${new Date().toISOString()}\n${reason ? `**Reason:** ${reason}\n` : ""}This plan has been archived and is no longer active. It is kept for reference purposes.\n`;
          updatedContent = archiveSection + updatedContent;
        }
        
        // Update plan content
        const updatedPlanContent = `${archiveMetadata}\n${updatedContent}`;
        await fs.writeFile(filePath, updatedPlanContent, "utf-8");
        
        // Update using updatePlanTool if ID changed
        if (newPlanId !== existingPlanId) {
          const finalContent = await fs.readFile(filePath, "utf-8");
          const finalLines = finalContent.split("\n");
          const finalMetadataEndIndex = finalLines.findIndex((line) => line.trim() === "---");
          
          if (finalMetadataEndIndex !== -1) {
            const finalMetadataLines = finalLines.slice(0, finalMetadataEndIndex);
            const finalContentLines = finalLines.slice(finalMetadataEndIndex + 1);
            
            const updatedMetadataLines = finalMetadataLines.map((line) => {
              if (line.includes("**Plan ID:**")) {
                return `**Plan ID:** ${newPlanId}`;
              }
              return line;
            });
            
            const updatedTitleLines = updatedMetadataLines.map((line) => {
              if (line.startsWith("# ")) {
                return `# ${existingTitle}`;
              }
              return line;
            });
            
            const finalPlanContent = `${updatedTitleLines.join("\n")}\n---\n${finalContentLines.join("\n")}`;
            await fs.writeFile(filePath, finalPlanContent, "utf-8");
          }
        }
        
        return `Successfully archived plan "${existingTitle}" with ID "${newPlanId}". ${reason ? `Reason: ${reason}` : ""}`;
        
      } else {
        return `Error: Invalid item type. Must be 'note' or 'plan'.`;
      }
    } catch (error: any) {
      return `Error archiving item: ${error.message}`;
    }
  },
});