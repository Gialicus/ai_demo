import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import { PLANS_DIR } from "../constants/paths";
import { findMatchingFiles, readMarkdownFile } from "../utils/file-operations";
import { planIdSchema } from "../schemas/plan-schemas";

export const readPlanTool = createTool({
  id: "read-plan",
  description: "Read an existing plan by its ID or search pattern. Returns the plan content and metadata.",
  inputSchema: z.object({
    planId: planIdSchema.describe("The unique identifier of the plan to read. Can be partial - will find the most recent match."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { planId } = inputData;
      
      // Find matching files using utility
      const matchingFiles = await findMatchingFiles(PLANS_DIR, "plan", planId);
      
      if (matchingFiles.length === 0) {
        // Check if directory exists and has files
        const files = await (await import("fs/promises")).readdir(PLANS_DIR).catch(() => []);
        const planFiles = files.filter((file: string) => file.startsWith("plan_") && file.endsWith(".md"));
        return `No plan found with ID "${planId}". Available plans: ${planFiles.length} total.`;
      }
      
      // Get most recent file (already sorted by findMatchingFiles)
      const mostRecentFile = matchingFiles[0];
      const filePath = path.join(PLANS_DIR, mostRecentFile);
      
      // Read and return the plan content
      const content = await readMarkdownFile(filePath);
      
      return `Plan found: ${mostRecentFile}\n\n${content}`;
    } catch (error: any) {
      return `Error reading plan: ${error.message}`;
    }
  },
});
