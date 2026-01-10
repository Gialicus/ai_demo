import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import path from "node:path";
import fs from "fs/promises";

const PLANS_DIR = path.resolve(__dirname, "../../../plans");

export const listPlansTool = createTool({
  id: "list-plans",
  description: "List all available plans with optional filters. Returns metadata about plans including ID, title, creation date, and update date if available.",
  inputSchema: z.object({
    titleFilter: z
      .string()
      .optional()
      .describe("Optional filter to search plans by title (partial match)."),
    planIdFilter: z
      .string()
      .optional()
      .describe("Optional filter to search plans by ID (partial match)."),
    maxResults: z
      .number()
      .optional()
      .default(50)
      .describe("Maximum number of results to return. Default is 50."),
  }),
  outputSchema: z.string().nonempty(),
  execute: async (inputData) => {
    try {
      const { titleFilter, planIdFilter, maxResults = 50 } = inputData;
      
      await fs.mkdir(PLANS_DIR, { recursive: true });
      
      // Read all plan files
      const files = await fs.readdir(PLANS_DIR);
      const planFiles = files.filter((file) => file.startsWith("plan_") && file.endsWith(".md"));
      
      if (planFiles.length === 0) {
        return "No plans found in the plans directory.";
      }
      
      // Parse metadata from each plan file
      const plansMetadata: Array<{
        planId: string;
        title: string;
        createdAt: string;
        updatedAt?: string;
        fileName: string;
      }> = [];
      
      for (const file of planFiles) {
        try {
          const filePath = path.join(PLANS_DIR, file);
          const content = await fs.readFile(filePath, "utf-8");
          const lines = content.split("\n");
          
          const metadataEndIndex = lines.findIndex((line) => line.trim() === "---");
          if (metadataEndIndex === -1) continue;
          
          const metadataLines = lines.slice(0, metadataEndIndex);
          
          let planId = "";
          let title = "";
          let createdAt = "";
          let updatedAt: string | undefined;
          
          for (const line of metadataLines) {
            if (line.includes("**Plan ID:**")) {
              planId = line.split("**Plan ID:**")[1].trim();
            } else if (line.includes("**Created:**")) {
              createdAt = line.split("**Created:**")[1].trim();
            } else if (line.includes("**Updated:**")) {
              updatedAt = line.split("**Updated:**")[1].trim();
            } else if (line.startsWith("# ")) {
              title = line.substring(2).trim();
            }
          }
          
          // Apply filters
          if (planIdFilter && !planId.toLowerCase().includes(planIdFilter.toLowerCase())) {
            continue;
          }
          if (titleFilter && !title.toLowerCase().includes(titleFilter.toLowerCase())) {
            continue;
          }
          
          if (planId && title) {
            plansMetadata.push({
              planId,
              title,
              createdAt,
              updatedAt,
              fileName: file,
            });
          }
        } catch (error) {
          // Skip files that can't be read
          continue;
        }
      }
      
      // Sort by creation date (most recent first)
      plansMetadata.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return dateB - dateA;
      });
      
      // Limit results
      const limitedPlans = plansMetadata.slice(0, maxResults);
      
      if (limitedPlans.length === 0) {
        return `No plans found matching the specified filters. Total plans available: ${planFiles.length}`;
      }
      
      // Format output
      const plansList = limitedPlans
        .map((plan, index) => {
          const updatedInfo = plan.updatedAt ? `\n  Updated: ${plan.updatedAt}` : "";
          return `${index + 1}. **${plan.title}**\n   ID: ${plan.planId}\n   Created: ${plan.createdAt}${updatedInfo}\n   File: ${plan.fileName}`;
        })
        .join("\n\n");
      
      return `Found ${limitedPlans.length} plan(s)${planFiles.length > limitedPlans.length ? ` (showing ${limitedPlans.length} of ${planFiles.length} total)` : ""}:\n\n${plansList}`;
    } catch (error: any) {
      return `Error listing plans: ${error.message}`;
    }
  },
});
