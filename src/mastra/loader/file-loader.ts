import { readFile } from "node:fs/promises";
import { LoadedAgent, LoadedAgentSchema } from "./loaded-agent.schema";

export async function fileLoader(path: string): Promise<LoadedAgent[]> {
  try {
    const file = await readFile(path, 'utf8');
    const agents: unknown[] = JSON.parse(file);
    return agents.map((agent: unknown) => LoadedAgentSchema.parse(agent));
  } catch (error) {
    console.error(`Error loading agent from file ${path}: ${error}`);
    throw error;
  }
}