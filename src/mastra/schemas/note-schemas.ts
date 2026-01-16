import { z } from "zod";

/**
 * Schema for note ID validation
 */
export const noteIdSchema = z
  .string()
  .nonempty()
  .describe("Unique identifier for the note. This will be used as part of the filename.");

/**
 * Schema for note title validation
 */
export const noteTitleSchema = z
  .string()
  .nonempty()
  .describe("The title of the note.");

/**
 * Schema for note content validation
 */
export const noteContentSchema = z
  .string()
  .nonempty()
  .describe("The markdown content of the note.");

/**
 * Schema for note metadata
 */
export const noteMetadataSchema = z.object({
  noteId: noteIdSchema,
  title: noteTitleSchema,
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  archived: z.string().optional(),
  category: z.enum(["project", "area", "resource", "archive", "inbox"]).optional(),
});

/**
 * Schema for note input (save/update operations)
 */
export const noteInputSchema = z.object({
  noteId: noteIdSchema,
  title: noteTitleSchema,
  content: noteContentSchema,
});
