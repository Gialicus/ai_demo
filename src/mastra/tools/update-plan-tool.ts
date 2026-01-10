import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";

const PLANS_DIR = path.resolve(__dirname, "../../../plans");

export const updatePlanTool = createTool({
  id: "update-plan",
  description: "Update an existing plan. You can update the title, content, or both. The plan ID remains unchanged and the updated timestamp is added.",
  inputSchema: z.object({
    planId: z
      .string()
      .nonempty()
      .describe("The unique identifier of the plan to update."),
    title: z
      .string()
      .optional()
      .describe("New title for the plan. If not provided, the existing title is kept."),
    content: z
      .string()
      .optional()
      .describe("New content for the plan. If not provided, the existing content is kept."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { planId, title, content } = inputData;
      const sanitizedPlanId = planId.replace(/[^a-zA-Z0-9-_]/g, "_");
      
      await fs.mkdir(PLANS_DIR, { recursive: true });
      
      // Find the plan file
      const files = await fs.readdir(PLANS_DIR);
      const planFiles = files.filter((file) => file.startsWith("plan_") && file.endsWith(".md"));
      const matchingFiles = planFiles.filter((file) => file.includes(sanitizedPlanId));
      
      if (matchingFiles.length === 0) {
        return `No plan found with ID "${planId}" to update.`;
      }
      
      // Get the most recent matching file
      matchingFiles.sort().reverse();
      const fileToUpdate = matchingFiles[0];
      const filePath = path.join(PLANS_DIR, fileToUpdate);
      
      // Read existing content
      const existingContent = await fs.readFile(filePath, "utf-8");
      
      // Parse existing metadata
      const lines = existingContent.split("\n");
      const metadataEndIndex = lines.findIndex((line) => line.trim() === "---");
      
      if (metadataEndIndex === -1) {
        return `Error: Plan file format is invalid. Cannot find metadata separator.`;
      }
      
      const metadataLines = lines.slice(0, metadataEndIndex);
      const existingContentLines = lines.slice(metadataEndIndex + 1);
      
      // Extract existing metadata
      let existingPlanId = planId;
      let existingTitle = title || "";
      let createdAt = new Date().toISOString();
      
      for (const line of metadataLines) {
        if (line.includes("**Plan ID:**")) {
          existingPlanId = line.split("**Plan ID:**")[1].trim();
        } else if (line.includes("**Created:**")) {
          createdAt = line.split("**Created:**")[1].trim();
        } else if (line.startsWith("# ")) {
          existingTitle = line.substring(2).trim();
        }
      }
      
      // Use provided title or keep existing
      const newTitle = title || existingTitle;
      const newContent = content !== undefined ? content : existingContentLines.join("\n").trim();
      
      // Build updated plan with metadata
      const updatedPlanContent = `# ${newTitle}\n\n**Plan ID:** ${existingPlanId}\n**Created:** ${createdAt}\n**Updated:** ${new Date().toISOString()}\n\n---\n\n${newContent}`;
      
      // Write updated content
      await fs.writeFile(filePath, updatedPlanContent, "utf-8");
      
      return `Successfully updated plan "${newTitle}" with ID "${existingPlanId}". File: ${fileToUpdate}`;
    } catch (error: any) {
      return `Error updating plan: ${error.message}`;
    }
  },
});
