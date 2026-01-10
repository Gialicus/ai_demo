import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";

const PLANS_DIR = path.resolve(__dirname, "../../../plans");

export const savePlanTool = createTool({
  id: "save-plan",
  description: "Save a plan in markdown format. Useful for storing intermediate or final versions of plans during iteration.",
  inputSchema: z.object({
    planId: z
      .string()
      .nonempty()
      .describe("Unique identifier for the plan. This will be used as part of the filename."),
    title: z
      .string()
      .nonempty()
      .describe("The title of the plan."),
    markdown: z
      .string()
      .nonempty()
      .describe("The complete plan content in markdown format."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { planId, title, markdown } = inputData;
      const sanitizedPlanId = planId.replace(/[^a-zA-Z0-9-_]/g, "_");
      const fileName = `plan_${sanitizedPlanId}_${Date.now()}.md`;
      const filePath = path.join(PLANS_DIR, fileName);
      
      await fs.mkdir(PLANS_DIR, { recursive: true });
      
      // Add metadata header to the plan file
      const planContent = `# ${title}\n\n**Plan ID:** ${planId}\n**Created:** ${new Date().toISOString()}\n\n---\n\n${markdown}`;
      
      await fs.writeFile(filePath, planContent, "utf-8");
      return `Successfully saved plan "${title}" with ID "${planId}" to ${fileName}`;
    } catch (error: any) {
      return `Error saving plan: ${error.message}`;
    }
  },
});
