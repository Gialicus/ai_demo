import { z } from "zod";

/**
 * Schema for note ID field in workflows
 */
export const workflowNoteIdSchema = z
  .string()
  .optional()
  .describe("ID of the captured/processed note");

/**
 * Schema for topic field in workflows
 */
export const workflowTopicSchema = z
  .string()
  .describe("Topic/theme of the MOC (auto-detected from file contents)");

/**
 * Schema for description field in workflows
 */
export const workflowDescriptionSchema = z
  .string()
  .optional()
  .describe("Optional description explaining the purpose");

/**
 * Common status fields for workflow steps
 */
export const workflowStatusSchema = z.object({
  captured: z.boolean().describe("Whether content was successfully captured"),
  organized: z.boolean().describe("Whether content was successfully organized"),
  distilled: z.boolean().describe("Whether content was successfully distilled"),
  expressed: z.boolean().describe("Whether content was successfully expressed"),
});
