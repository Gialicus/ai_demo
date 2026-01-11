import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import { noteAgent } from "../agents/note-agent";
import { searchAgent } from "../agents/search-agent";

export const captureWorkflow = createWorkflow({
    id: "captureWorkflow",
    description: "Capture a new note",
    inputSchema: z.object({
        prompt: z.string().describe('The content of the note'),
    }),
    outputSchema: z.object({
        noteId: z.string().describe('The ID of the note'),
    })
}).then(createStep(searchAgent))
    .map(async ({ inputData }) => ({
        prompt: inputData.text,
    }))
    .then(createStep(noteAgent))
.commit()