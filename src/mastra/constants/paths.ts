import path from "node:path";

/**
 * Directory path for storing note files
 * Relative to the project root
 */
export const NOTES_DIR = path.resolve(__dirname, "../../../notes");

/**
 * Directory path for storing plan files
 * Relative to the project root
 */
export const PLANS_DIR = path.resolve(__dirname, "../../../plans");
