import { readFile } from "fs/promises";
import { join } from "node:path";



export const promptLoader = async (name: string): Promise<string> => {
  const promptPath = join(__dirname, "./prompts", `${name}.md`);
  
  try {
    const file = await readFile(promptPath, "utf-8");
    return file;
  } catch (error) {
    throw new Error(`Prompt "${name}" not found at ${promptPath}: ${error}`);
  }
};