import { createWorkflow, createStep } from "@mastra/core/workflows";
import { z } from "zod";

// Input schema - prompt utente
const codeInputSchema = z.object({
  prompt: z.string().describe("User prompt to process through CODE cycle (Capture, Organize, Distill, Express)"),
});

// Output schema - risultato finale
const codeOutputSchema = z.object({
  noteId: z.string().optional().describe("ID of the captured/processed note"),
  captured: z.boolean().describe("Whether content was successfully captured"),
  organized: z.boolean().describe("Whether content was successfully organized"),
  distilled: z.boolean().describe("Whether content was successfully distilled"),
  expressed: z.boolean().describe("Whether content was successfully expressed"),
  output: z.string().describe("Final output from Express phase"),
});

// Capture Step - Cattura il prompt utente
const captureStep = createStep({
  id: "capture",
  description: "Capture phase: Save user prompt as a note with PARA classification",
  inputSchema: codeInputSchema,
  outputSchema: z.object({
    noteId: z.string().optional(),
    captured: z.boolean(),
    text: z.string(),
  }),
  execute: async ({ inputData, mastra }) => {
    const { prompt } = inputData;
    const agent = mastra.getAgent("secondBrainAgent");
    
    const capturePrompt = `CAPTURE phase: Capture the following information from the user prompt. Save it as a note with appropriate PARA classification (project_, area_, resource_, archive_, or inbox_ if uncertain). Focus on capturing what resonates - information that is surprising, useful, or personally meaningful.

User prompt: ${prompt}

Instructions:
1. Determine if this should be captured (filter out noise)
2. Classify according to PARA method
3. Create a well-organized note with clear title and structured content
4. Use saveNoteTool to save the note
5. Return the noteId and confirmation that capture was successful`;

    const result = await agent.generate(capturePrompt);
    
    // Estrai noteId dal testo
    const noteIdMatch = result.text?.match(/noteId[:\s]+([^\s\n]+)/i) || 
                       result.text?.match(/ID[:\s]+([^\s\n]+)/i) ||
                       result.text?.match(/note[:\s]+([^\s\n]+)/i);
    const noteId = noteIdMatch?.[1];
    
    return {
      noteId: noteId || undefined,
      captured: result.text?.toLowerCase().includes("captured") || 
                result.text?.toLowerCase().includes("saved") ||
                noteId !== undefined,
      text: result.text || "",
    };
  },
});

// Organize Step - Organizza la note secondo PARA
const organizeStep = createStep({
  id: "organize",
  description: "Organize phase: Organize the captured note according to PARA method",
  inputSchema: z.object({
    noteId: z.string().optional(),
    captured: z.boolean(),
    text: z.string(),
  }),
  outputSchema: z.object({
    noteId: z.string().optional(),
    organized: z.boolean(),
    text: z.string(),
  }),
  execute: async ({ inputData, mastra, getStepResult }) => {
    const captureResult = getStepResult(captureStep);
    const noteId = inputData.noteId || captureResult?.noteId;
    
    if (!noteId) {
      return {
        noteId: undefined,
        organized: false,
        text: "Cannot organize: noteId not found",
      };
    }
    
    const agent = mastra.getAgent("secondBrainAgent");
    
    const organizePrompt = `ORGANIZE phase: Organize the note with ID "${noteId}" according to PARA method (Projects, Areas, Resources, Archives).

Instructions:
1. Read the note using readNoteTool with noteId: "${noteId}"
2. Verify PARA classification is correct (project_, area_, resource_, archive_)
3. If needed, update the note with updateNoteTool to improve organization
4. Search for related notes using listNotesTool to find connections
5. Create bidirectional links using createLinkTool if relationships are found
6. Create MOC using createMocTool if the topic warrants it
7. Return confirmation that organization was successful`;

    const result = await agent.generate(organizePrompt);
    
    return {
      noteId,
      organized: result.text?.toLowerCase().includes("organized") ||
                result.text?.toLowerCase().includes("updated") ||
                result.text?.toLowerCase().includes("linked") ||
                result.text?.toLowerCase().includes("success"),
      text: result.text || "",
    };
  },
});

// Distill Step - Sintetizza la note
const distillStep = createStep({
  id: "distill",
  description: "Distill phase: Create progressive summaries for the note",
  inputSchema: z.object({
    noteId: z.string().optional(),
    organized: z.boolean(),
    text: z.string(),
  }),
  outputSchema: z.object({
    noteId: z.string().optional(),
    distilled: z.boolean(),
    text: z.string(),
  }),
  execute: async ({ inputData, mastra, getStepResult }) => {
    const captureResult = getStepResult(captureStep);
    const noteId = inputData.noteId || captureResult?.noteId;
    
    if (!noteId) {
      return {
        noteId: undefined,
        distilled: false,
        text: "Cannot distill: noteId not found",
      };
    }
    
    const agent = mastra.getAgent("secondBrainAgent");
    
    const distillPrompt = `DISTILL phase: Create progressive summaries for the note with ID "${noteId}" (highlights, executive summary, sparklines).

Instructions:
1. Read the note using readNoteTool with noteId: "${noteId}"
2. Extract key highlights (sparklines) - the most important insights
3. Create an executive summary with main concepts and insights
4. Update the note using updateNoteTool to add progressive summarization sections:
   - Highlights section (key sparklines)
   - Executive Summary section
   - Full content (preserve original)
5. Use webSearch tool if needed to gather additional context
6. Return confirmation that distillation was successful`;

    const result = await agent.generate(distillPrompt);
    
    return {
      noteId,
      distilled: result.text?.toLowerCase().includes("distilled") ||
                result.text?.toLowerCase().includes("summary") ||
                result.text?.toLowerCase().includes("updated") ||
                result.text?.toLowerCase().includes("success"),
      text: result.text || "",
    };
  },
});

// Express Step - Trasforma in output concreti
const expressStep = createStep({
  id: "express",
  description: "Express phase: Transform knowledge into concrete outputs",
  inputSchema: z.object({
    noteId: z.string().optional(),
    distilled: z.boolean(),
    text: z.string(),
  }),
  outputSchema: z.object({
    noteId: z.string().optional(),
    expressed: z.boolean(),
    output: z.string(),
  }),
  execute: async ({ inputData, mastra, getStepResult, getInitData }) => {
    const captureResult = getStepResult(captureStep);
    const noteId = inputData.noteId || captureResult?.noteId;
    const originalPrompt = getInitData().prompt;
    
    const agent = mastra.getAgent("secondBrainAgent");
    
    const expressPrompt = `EXPRESS phase: Transform the knowledge from note "${noteId}" into concrete outputs that address the user's original prompt.

Original user prompt: ${originalPrompt}

Instructions:
1. Read the note using readNoteTool with noteId: "${noteId}"
2. Read the distilled summary (highlights and executive summary)
3. Use webSearch tool if needed to gather additional information
4. Create a comprehensive output that addresses the user's original prompt
5. If the task requires planning, use savePlanTool to create a plan
6. If multiple related notes exist, use listNotesTool to gather context
7. Combine insights to create valuable output
8. Return the final output that expresses the knowledge in a useful format`;

    const result = await agent.generate(expressPrompt);
    
    return {
      noteId,
      expressed: result.text !== undefined && result.text.length > 0,
      output: result.text || "Output generated successfully",
    };
  },
});

// Final step - Formatta l'output finale
const formatOutputStep = createStep({
  id: "format-output",
  description: "Format final output combining all CODE phases",
  inputSchema: z.object({
    noteId: z.string().optional(),
    expressed: z.boolean(),
    output: z.string(),
  }),
  outputSchema: codeOutputSchema,
  execute: async ({ inputData, getStepResult }) => {
    const captureResult = getStepResult(captureStep);
    const organizeResult = getStepResult(organizeStep);
    const distillResult = getStepResult(distillStep);
    const expressResult = getStepResult(expressStep);
    
    const noteId = inputData.noteId || captureResult?.noteId;
    
    return {
      noteId: noteId || undefined,
      captured: captureResult?.captured || false,
      organized: organizeResult?.organized || false,
      distilled: distillResult?.distilled || false,
      expressed: expressResult?.expressed || inputData.expressed || false,
      output: expressResult?.output || inputData.output || "Output generated successfully",
    };
  },
});

// CODE Workflow
export const codeWorkflow = createWorkflow({
  id: "code-workflow",
  description: "Implements Building a Second Brain CODE method (Capture, Organize, Distill, Express) by Tiago Forte",
  inputSchema: codeInputSchema,
  outputSchema: codeOutputSchema,
})
  .then(captureStep)
  .then(organizeStep)
  .then(distillStep)
  .then(expressStep)
  .then(formatOutputStep);

codeWorkflow.commit();
