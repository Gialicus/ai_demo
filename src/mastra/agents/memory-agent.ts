import { Agent } from "@mastra/core/agent";
import {
  BatchPartsProcessor,
  UnicodeNormalizer,
} from "@mastra/core/processors";
import { defaultMemory } from "../storage/memory";
import { getMemoriesTool } from "../tools/get-memories-tool";



/**
 * Factory function per creare un memory-agent che ricorda solo
 * le conversazioni di un altro agente specifico.
 * 
 * IMPORTANTE: Per far funzionare correttamente il memory-agent,
 * l'agente target deve essere chiamato con un resourceId che corrisponde
 * al pattern: `agent_${targetAgentId}`. In questo modo le conversazioni
 * vengono salvate con quel resourceId e il memory-agent può accedervi.
 * 
 * @param targetAgentId - L'ID dell'agente di cui ricordare le conversazioni
 * @returns Un'istanza di Agent configurata come memory-agent
 */
export function createMemoryAgent(targetAgentId: string): Agent {

  return new Agent({
    id: "memoryAgent_" + targetAgentId,
    name: "memoryAgent_" + targetAgentId,
    description: `An agent that remembers only the conversations of agent ${targetAgentId} with agentId: ${targetAgentId}`,
    instructions: `You are an agent specialized in recalling conversations. 
Your only purpose is to remember and answer questions about the conversations of the agent "${targetAgentId}" with agentId: ${targetAgentId}.
Focus on the specific content available in the tool and acknowledge if you cannot find sufficient information to answer a question.
Base your responses only on the content provided, not on general knowledge.

IMPORTANT RULES:
- You remember ONLY the conversations of the agent "${targetAgentId}" with agentId: ${targetAgentId}
- You do not store any other information or conversations
- When asked a question, answer based ONLY on the stored conversations of the agent "${targetAgentId}" with agentId: ${targetAgentId}
- If you do not have enough information in the stored conversations, clearly say so
- Do not invent information or make assumptions about conversations you have not stored

Your purpose is to be a living archive of the conversations of the agent "${targetAgentId}" with agentId: ${targetAgentId}.`,
    model: "google/gemini-2.5-flash",
    memory: defaultMemory,
    tools: {
      getMemoriesTool,
    },
    inputProcessors: [
      new UnicodeNormalizer({
        stripControlChars: true,
        collapseWhitespace: true,
      }),
    ],
    outputProcessors: [
      new BatchPartsProcessor({
        batchSize: 5,
        maxWaitTime: 100,
        emitOnNonText: true,
      }),
    ],
  });
}
