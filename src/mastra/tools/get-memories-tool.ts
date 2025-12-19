import { createTool } from "@mastra/core/tools";
import z from "zod";

export const getMemoriesTool = createTool({
  id: "getMemoriesTool",
  description: "Get the memories of the agent",
  inputSchema: z.object({
    agentId: z.string(),
    question: z.string(),
  }),
  outputSchema: z.string(),
  execute: async ({ agentId, question }, ctx) => {
    const agent = ctx?.mastra?.getAgentById(agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    const memory = await agent.getMemory();
    const listThreads = await memory?.listThreadsByResourceId({
      resourceId: agentId,
      perPage: 1,
    });
    const [thread] = listThreads?.threads ?? [];
    if (!thread) {
      throw new Error("Thread not found");
    }

    const response = await agent.generate(question, {
      memory: {
        resource: thread.resourceId,
        thread: thread.id,
      },
    });

    return response.text;
  },
});
