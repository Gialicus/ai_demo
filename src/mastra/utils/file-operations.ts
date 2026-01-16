import fs from "fs/promises";
import path from "node:path";
import { sanitizeId } from "./sanitization";

export interface FileMetadata {
  id: string;
  title: string;
  createdAt?: string;
  updatedAt?: string;
  archived?: string;
  category?: string;
}

/**
 * Finds matching files in a directory by prefix and ID pattern.
 * Files are expected to follow the pattern: {prefix}_{id}_{timestamp}.md
 * 
 * @param dir - Directory to search in
 * @param prefix - File prefix (e.g., "note", "plan")
 * @param id - ID to search for (can be partial match)
 * @returns Array of matching file names, sorted by most recent first
 */
export async function findMatchingFiles(
  dir: string,
  prefix: string,
  id: string
): Promise<string[]> {
  await fs.mkdir(dir, { recursive: true });
  
  const files = await fs.readdir(dir);
  const sanitizedId = sanitizeId(id);
  const matchingFiles = files.filter(
    (file) => file.startsWith(`${prefix}_`) && 
              file.endsWith(".md") && 
              file.includes(sanitizedId)
  );
  
  // Sort by filename (most recent first, as timestamp is in filename)
  return matchingFiles.sort().reverse();
}

/**
 * Reads a markdown file and returns its content.
 * 
 * @param filePath - Path to the markdown file
 * @returns The file content as a string
 */
export async function readMarkdownFile(filePath: string): Promise<string> {
  return await fs.readFile(filePath, "utf-8");
}

/**
 * Parses metadata from markdown file content.
 * Expects format:
 * ```
 * # Title
 * 
 * **ID Field:** value
 * **Created:** ISO date
 * ...
 * 
 * ---
 * 
 * Content...
 * ```
 * 
 * @param content - Markdown file content
 * @param idFieldName - Name of the ID field (e.g., "Note ID", "Plan ID")
 * @returns Parsed metadata object
 */
export function parseFileMetadata(
  content: string,
  idFieldName: string = "Note ID"
): FileMetadata {
  const lines = content.split("\n");
  const metadataEndIndex = lines.findIndex((line) => line.trim() === "---");
  
  const metadata: FileMetadata = {
    id: "",
    title: "",
  };
  
  const metadataLines = metadataEndIndex !== -1 
    ? lines.slice(0, metadataEndIndex)
    : lines;
  
  for (const line of metadataLines) {
    // Extract title from # header
    if (line.startsWith("# ")) {
      metadata.title = line.substring(2).trim();
    }
    
    // Extract ID
    const idPattern = new RegExp(`\\*\\*${idFieldName}:\\*\\*\\s*(.+)`, "i");
    const idMatch = line.match(idPattern);
    if (idMatch) {
      metadata.id = idMatch[1].trim();
      
      // Extract category from ID prefix if present
      if (metadata.id.startsWith("project_")) {
        metadata.category = "project";
      } else if (metadata.id.startsWith("area_")) {
        metadata.category = "area";
      } else if (metadata.id.startsWith("resource_")) {
        metadata.category = "resource";
      } else if (metadata.id.startsWith("archive_")) {
        metadata.category = "archive";
      }
    }
    
    // Extract dates
    const createdMatch = line.match(/\*\*Created:\*\*\s*(.+)/i);
    if (createdMatch) {
      metadata.createdAt = createdMatch[1].trim();
    }
    
    const updatedMatch = line.match(/\*\*Updated:\*\*\s*(.+)/i);
    if (updatedMatch) {
      metadata.updatedAt = updatedMatch[1].trim();
    }
    
    const archivedMatch = line.match(/\*\*Archived:\*\*\s*(.+)/i);
    if (archivedMatch) {
      metadata.archived = archivedMatch[1].trim();
    }
  }
  
  return metadata;
}

/**
 * Gets the content section of a markdown file (everything after the metadata separator ---).
 * 
 * @param content - Markdown file content
 * @returns The content section as a string
 */
export function getFileContent(content: string): string {
  const lines = content.split("\n");
  const metadataEndIndex = lines.findIndex((line) => line.trim() === "---");
  
  if (metadataEndIndex === -1) {
    return content;
  }
  
  return lines.slice(metadataEndIndex + 1).join("\n").trim();
}
