import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";

const PLANS_DIR = path.resolve(__dirname, "../../../plans");

export const deletePlanTool = createTool({
  id: "delete-plan",
  description: "Delete a plan by its ID. This action is permanent and cannot be undone.",
  inputSchema: z.object({
    planId: z
      .string()
      .nonempty()
      .describe("The unique identifier of the plan to delete."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { planId } = inputData;
      const sanitizedPlanId = planId.replace(/[^a-zA-Z0-9-_]/g, "_");
      
      await fs.mkdir(PLANS_DIR, { recursive: true });
      
      // Find the plan file
      const files = await fs.readdir(PLANS_DIR);
      const planFiles = files.filter((file) => file.startsWith("plan_") && file.endsWith(".md"));
      const matchingFiles = planFiles.filter((file) => file.includes(sanitizedPlanId));
      
      if (matchingFiles.length === 0) {
        return `No plan found with ID "${planId}" to delete.`;
      }
      
      // Get the most recent matching file (or delete all if multiple matches)
      matchingFiles.sort().reverse();
      const fileToDelete = matchingFiles[0];
      const filePath = path.join(PLANS_DIR, fileToDelete);
      
      // Read plan title before deleting (for confirmation message)
      let planTitle = "Unknown";
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const firstLine = content.split("\n")[0];
        if (firstLine.startsWith("# ")) {
          planTitle = firstLine.substring(2).trim();
        }
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
