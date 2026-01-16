/**
 * Sanitizes an ID by replacing invalid characters with underscores.
 * Valid characters are: alphanumeric, dashes, and underscores.
 * 
 * @param id - The ID to sanitize
 * @returns The sanitized ID
 */
export function sanitizeId(id: string): string {
  return id.replace(/[^a-zA-Z0-9-_]/g, "_");
}

/**
 * Sanitizes a filename by replacing invalid characters with underscores.
 * Additionally converts to lowercase for consistency.
 * 
 * @param filename - The filename to sanitize
 * @returns The sanitized filename
 */
export function sanitizeFilename(filename: string): string {
  return sanitizeId(filename).toLowerCase();
}
