import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";
import { PLANS_DIR } from "../constants/paths";
import { findMatchingFiles, readMarkdownFile, parseFileMetadata, getFileContent } from "../utils/file-operations";
import { planIdSchema, planTitleSchema, planContentSchema } from "../schemas/plan-schemas";

export const updatePlanTool = createTool({
  id: "update-plan",
  description: "Update an existing plan. You can update the title, content, or both. The plan ID remains unchanged and the updated timestamp is added.",
  inputSchema: z.object({
    planId: planIdSchema.describe("The unique identifier of the plan to update."),
    title: planTitleSchema.optional().describe("New title for the plan. If not provided, the existing title is kept."),
    content: planContentSchema.optional().describe("New content for the plan. If not provided, the existing content is kept."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { planId, title, content } = inputData;
      
      // Find matching files using utility
      const matchingFiles = await findMatchingFiles(PLANS_DIR, "plan", planId);
      
      if (matchingFiles.length === 0) {
        return `No plan found with ID "${planId}" to update.`;
      }
      
      // Get the most recent matching file
      const fileToUpdate = matchingFiles[0];
      const filePath = path.join(PLANS_DIR, fileToUpdate);
      
      // Read existing content
      const existingContent = await readMarkdownFile(filePath);
      
      // Parse existing metadata using utility
      const metadata = parseFileMetadata(existingContent, "Plan ID");
      const existingContentText = getFileContent(existingContent);
      
      // Use provided title or keep existing
      const newTitle = title || metadata.title;
      const newContent = content !== undefined ? content : existingContentText;
      
      // Build updated plan with metadata
      const updatedPlanContent = `# ${newTitle}\n\n**Plan ID:** ${metadata.id || planId}\n**Created:** ${metadata.createdAt || new Date().toISOString()}\n**Updated:** ${new Date().toISOString()}\n\n---\n\n${newContent}`;
      
      // Write updated content
      await fs.writeFile(filePath, updatedPlanContent, "utf-8");
      
      return `Successfully updated plan "${newTitle}" with ID "${metadata.id || planId}". File: ${fileToUpdate}`;
    } catch (error: any) {
      return `Error updating plan: ${error.message}`;
    }
  },
});
