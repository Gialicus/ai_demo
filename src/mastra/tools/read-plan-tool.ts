import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";

const PLANS_DIR = path.resolve(__dirname, "../../../plans");

export const readPlanTool = createTool({
  id: "read-plan",
  description: "Read an existing plan by its ID or search pattern. Returns the plan content and metadata.",
  inputSchema: z.object({
    planId: z
      .string()
      .nonempty()
      .describe("The unique identifier of the plan to read. Can be partial - will find the most recent match."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { planId } = inputData;
      const sanitizedPlanId = planId.replace(/[^a-zA-Z0-9-_]/g, "_");
      
      await fs.mkdir(PLANS_DIR, { recursive: true });
      
      // Read all files in the plans directory
      const files = await fs.readdir(PLANS_DIR);
      const planFiles = files.filter((file) => file.startsWith("plan_") && file.endsWith(".md"));
      
      if (planFiles.length === 0) {
        return `No plans found in the plans directory.`;
      }
      
      // Find files matching the planId (partial match)
      const matchingFiles = planFiles.filter((file) => file.includes(sanitizedPlanId));
      
      if (matchingFiles.length === 0) {
        return `No plan found with ID "${planId}". Available plans: ${planFiles.length} total.`;
      }
      
      // Sort by filename (which includes timestamp) to get the most recent
      matchingFiles.sort().reverse();
      const mostRecentFile = matchingFiles[0];
      const filePath = path.join(PLANS_DIR, mostRecentFile);
      
      // Read and return the plan content
      const content = await fs.readFile(filePath, "utf-8");
      
      return `Plan found: ${mostRecentFile}\n\n${content}`;
    } catch (error: any) {
      return `Error reading plan: ${error.message}`;
    }
  },
});
