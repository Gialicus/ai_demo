import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";
import { PLANS_DIR } from "../constants/paths";
import { findMatchingFiles, readMarkdownFile, parseFileMetadata } from "../utils/file-operations";
import { planIdSchema } from "../schemas/plan-schemas";

export const deletePlanTool = createTool({
  id: "delete-plan",
  description: "Delete a plan by its ID. This action is permanent and cannot be undone.",
  inputSchema: z.object({
    planId: planIdSchema.describe("The unique identifier of the plan to delete."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { planId } = inputData;
      
      // Find matching files using utility
      const matchingFiles = await findMatchingFiles(PLANS_DIR, "plan", planId);
      
      if (matchingFiles.length === 0) {
        return `No plan found with ID "${planId}" to delete.`;
      }
      
      // Get the most recent matching file
      const fileToDelete = matchingFiles[0];
      const filePath = path.join(PLANS_DIR, fileToDelete);
      
      // Read plan title before deleting (for confirmation message)
      let planTitle = "Unknown";
      try {
        const content = await readMarkdownFile(filePath);
        const metadata = parseFileMetadata(content, "Plan ID");
        planTitle = metadata.title || planTitle;
      } catch {
        // If we can't read, continue with deletion anyway
      }
      
      // Delete the file
      await fs.unlink(filePath);
      
      return `Successfully deleted plan "${planTitle}" with ID "${planId}" (file: ${fileToDelete}).`;
    } catch (error: any) {
      return `Error deleting plan: ${error.message}`;
    }
  },
});
