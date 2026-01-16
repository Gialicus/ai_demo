import { z } from "zod";

/**
 * Schema for plan ID validation
 */
export const planIdSchema = z
  .string()
  .nonempty()
  .describe("Unique identifier for the plan. This will be used as part of the filename.");

/**
 * Schema for plan title validation
 */
export const planTitleSchema = z
  .string()
  .nonempty()
  .describe("The title of the plan.");

/**
 * Schema for plan content validation
 */
export const planContentSchema = z
  .string()
  .nonempty()
  .describe("The complete plan content in markdown format.");

/**
 * Schema for plan metadata
 */
export const planMetadataSchema = z.object({
  planId: planIdSchema,
  title: planTitleSchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archived: z.string().optional(),
  category: z.enum(["project", "area", "resource", "archive", "inbox"]).optional(),
});

/**
 * Schema for plan input (save/update operations)
 */
export const planInputSchema = z.object({
  planId: planIdSchema,
  title: planTitleSchema,
  content: planContentSchema,
});
