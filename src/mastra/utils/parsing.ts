/**
 * Extracts note ID from agent response text using various patterns.
 * Looks for patterns like "noteId: value", "ID: value", "note: value"
 * 
 * @param text - Text to search for note ID
 * @returns Extracted note ID or null if not found
 */
export function extractNoteId(text: string): string | null {
  if (!text) return null;
  
  // Try multiple patterns
  const patterns = [
    /noteId[:\s]+([^\s\n]+)/i,
    /ID[:\s]+([^\s\n]+)/i,
    /note[:\s]+([^\s\n]+)/i,
    /note[_\s]+([^\s\n]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}

/**
 * Extracts topic from agent response text.
 * Looks for patterns like "Topic: value", "Topic: value\nDescription"
 * 
 * @param text - Text to search for topic
 * @returns Extracted topic or null if not found
 */
export function extractTopic(text: string): string | null {
  if (!text) return null;
  
  // Try to find "Topic: ..." pattern
  const topicMatch = text.match(/Topic[:\s]+(.+?)(?:\n|Description|$)/i);
  if (topicMatch && topicMatch[1]) {
    return topicMatch[1].trim();
  }
  
  // Fallback: use first non-empty line
  const lines = text.split("\n").map(line => line.trim()).filter(line => line.length > 0);
  if (lines.length > 0) {
    return lines[0];
  }
  
  return null;
}

/**
 * Extracts description from agent response text.
 * Looks for patterns like "Description: value"
 * 
 * @param text - Text to search for description
 * @returns Extracted description or null if not found
 */
export function extractDescription(text: string): string | null {
  if (!text) return null;
  
  const descMatch = text.match(/Description[:\s]+(.+?)(?:\n|$)/i);
  if (descMatch && descMatch[1]) {
    return descMatch[1].trim();
  }
  
  return null;
}

/**
 * Extracts MOC ID from text response.
 * Looks for patterns like "ID: value", "moc_value", etc.
 * 
 * @param text - Text to search for MOC ID
 * @returns Extracted MOC ID or null if not found
 */
export function extractMocId(text: string): string | null {
  if (!text) return null;
  
  const patterns = [
    /ID[:\s]+([^\s\n]+)/i,
    /moc[_\s]+([^\s\n]+)/i,
  ];
  
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim();
    }
  }
  
  return null;
}
