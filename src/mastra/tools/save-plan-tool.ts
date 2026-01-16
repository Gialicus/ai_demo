import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";
import { PLANS_DIR } from "../constants/paths";
import { sanitizeId } from "../utils/sanitization";
import { planIdSchema, planTitleSchema, planContentSchema } from "../schemas/plan-schemas";

export const savePlanTool = createTool({
  id: "save-plan",
  description: "Save a plan in markdown format. Useful for storing intermediate or final versions of plans during iteration.",
  inputSchema: z.object({
    planId: planIdSchema,
    title: planTitleSchema,
    content: planContentSchema,
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { planId, title, content } = inputData;
      const sanitizedPlanId = sanitizeId(planId);
      const fileName = `plan_${sanitizedPlanId}_${Date.now()}.md`;
      const filePath = path.join(PLANS_DIR, fileName);
      
      await fs.mkdir(PLANS_DIR, { recursive: true });
      
      // Add metadata header to the plan file
      const planContent = `# ${title}\n\n**Plan ID:** ${planId}\n**Created:** ${new Date().toISOString()}\n\n---\n\n${content}`;
      
      await fs.writeFile(filePath, planContent, "utf-8");
      return `Successfully saved plan "${title}" with ID "${planId}" to ${fileName}`;
    } catch (error: any) {
      return `Error saving plan: ${error.message}`;
    }
  },
});
