import { createStep, createWorkflow } from '@mastra/core/workflows';
import { z } from 'zod';

// Schema per il flusso completo
const captureOutputSchema = z.object({
  noteId: z.string().describe('ID of the captured note'),
  title: z.string().describe('Title of the captured note'),
  content: z.string().describe('Content of the captured note'),
  captured: z.boolean().describe('Whether content was captured'),
});

const organizeOutputSchema = captureOutputSchema.extend({
  organized: z.boolean().describe('Whether content was organized'),
  category: z.enum(['project', 'area', 'resource', 'archive', 'inbox']).optional().describe('PARA category assigned'),
});

const distillOutputSchema = organizeOutputSchema.extend({
  distilled: z.boolean().describe('Whether content was distilled'),
  hasSummary: z.boolean().optional().describe('Whether progressive summarization was added'),
});

const linkOutputSchema = distillOutputSchema.extend({
  linked: z.boolean().describe('Whether content was linked'),
  linksCount: z.number().optional().describe('Number of links created'),
});

const expressOutputSchema = linkOutputSchema.extend({
  expressed: z.boolean().optional().describe('Whether expression phase was completed'),
  planId: z.string().optional().describe('ID of created plan if any'),
  executionResult: z.string().optional().describe('Result of execution if any'),
});

const reviewOutputSchema = z.object({
  reviewed: z.boolean().describe('Whether review was completed'),
  report: z.string().describe('Review report'),
  archivedCount: z.number().optional().describe('Number of items archived'),
  reclassifiedCount: z.number().optional().describe('Number of items reclassified'),
});

// Input schema principale
const workflowInputSchema = z.object({
  content: z.string().describe('Content to capture (note, idea, request)'),
  category: z.enum(['project', 'area', 'resource', 'inbox']).optional().describe('PARA category (optional, will be auto-detected)'),
  action: z.enum(['capture', 'organize', 'distill', 'link', 'express', 'review', 'full']).optional().default('full').describe('Action to perform (default: full CODE cycle)'),
  noteId: z.string().optional().describe('Existing note ID (for distill/link operations)'),
  title: z.string().optional().describe('Title for the note (optional, will be generated if not provided)'),
  skipSteps: z.array(z.enum(['organize', 'distill', 'link', 'express'])).optional().describe('Steps to skip in the workflow'),
});

// Step 1: Capture
const captureStep = createStep({
  id: 'capture',
  description: 'Capture information, ideas, or requests and save them as a note',
  inputSchema: workflowInputSchema,
  outputSchema: captureOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const agent = mastra?.getAgent('secondBrainAgent');
    if (!agent) {
      throw new Error('Second Brain Agent not found');
    }

    // Se abbiamo già un noteId, leggiamo la nota esistente
    if (inputData.noteId) {
      const readNoteTool = mastra?.getTool('read-note');
      if (readNoteTool && typeof readNoteTool.execute === 'function') {
        const noteContentResult = await readNoteTool.execute({ noteId: inputData.noteId });
        const noteContent = typeof noteContentResult === 'string' ? noteContentResult : String(noteContentResult);
        if (!noteContent.startsWith('Error') && !noteContent.startsWith('No note')) {
          // Estrai noteId e title dal contenuto
          const lines = noteContent.split('\n');
          let noteId = inputData.noteId;
          let title = inputData.title || 'Untitled';
          
          for (const line of lines) {
            if (line.includes('**Note ID:**')) {
              noteId = line.split('**Note ID:**')[1].trim();
            } else if (line.startsWith('# ')) {
              title = line.substring(2).trim();
            }
          }
          
          return {
            noteId,
            title,
            content: noteContent,
            captured: true,
          };
        }
      }
    }

    // Cattura nuova informazione
    const prompt = inputData.title 
      ? `Capture the following information as a note with title "${inputData.title}":\n\n${inputData.content}`
      : `Capture the following information as a note:\n\n${inputData.content}\n\nGenerate an appropriate title based on the content.`;

    const response = await agent.generate([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    // Estrai noteId dal risultato o genera uno
    const responseText = response.text;
    const noteIdMatch = responseText.match(/note[_-]?id[:\s]+([a-zA-Z0-9_-]+)/i);
    const noteId = noteIdMatch ? noteIdMatch[1] : `captured_${Date.now()}`;
    
    // Estrai title dal risultato
    const titleMatch = responseText.match(/(?:title|#)\s*:?\s*([^\n]+)/i);
    const title = titleMatch ? titleMatch[1].trim() : (inputData.title || 'Captured Note');

    return {
      noteId,
      title,
      content: inputData.content,
      captured: true,
    };
  },
});

// Step 2: Organize
const organizeStep = createStep({
  id: 'organize',
  description: 'Organize captured note according to PARA method',
  inputSchema: captureOutputSchema,
  outputSchema: organizeOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const agent = mastra?.getAgent('inboxAgent');
    if (!agent) {
      // Se inboxAgent non è disponibile, usa secondBrainAgent
      const secondBrainAgent = mastra?.getAgent('secondBrainAgent');
      if (!secondBrainAgent) {
        throw new Error('No organizing agent found');
      }
      
      // Organizzazione semplice con secondBrainAgent
      const prompt = `Organize the following note according to PARA method. Determine if it should be a project, area, resource, or archive. Update the note ID with the appropriate prefix (project_, area_, resource_, or archive_):\n\nNote ID: ${inputData.noteId}\nTitle: ${inputData.title}\n\nContent: ${inputData.content}`;
      
      await secondBrainAgent.generate([
        {
          role: 'user',
          content: prompt,
        },
      ]);

      return {
        ...inputData,
        organized: true,
        category: 'inbox' as const,
      };
    }

    // Usa inboxAgent per organizzare
    const prompt = `Process and organize the following note according to PARA method. Classify it as project, area, resource, or archive, and update the note ID with the appropriate prefix:\n\nNote ID: ${inputData.noteId}\nTitle: ${inputData.title}\n\nContent: ${inputData.content}`;

    const response = await agent.generate([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    // Estrai categoria dal risultato
    const responseText = response.text.toLowerCase();
    let category: 'project' | 'area' | 'resource' | 'archive' | 'inbox' = 'inbox';
    if (responseText.includes('project')) category = 'project';
    else if (responseText.includes('area')) category = 'area';
    else if (responseText.includes('resource')) category = 'resource';
    else if (responseText.includes('archive')) category = 'archive';

    return {
      ...inputData,
      organized: true,
      category,
    };
  },
});

// Step 3: Distill
const distillStep = createStep({
  id: 'distill',
  description: 'Apply progressive summarization to the note',
  inputSchema: organizeOutputSchema,
  outputSchema: distillOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const agent = mastra?.getAgent('distillAgent');
    if (!agent) {
      throw new Error('Distill Agent not found');
    }

    const prompt = `Apply progressive summarization to the following note. Extract highlights (sparklines), create an executive summary, and update the note with a progressive summarization section:\n\nNote ID: ${inputData.noteId}\nTitle: ${inputData.title}\n\nContent: ${inputData.content}`;

    const response = await agent.generate([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    // Verifica se la distillazione è stata applicata
    const hasSummary = response.text.toLowerCase().includes('highlights') || 
                       response.text.toLowerCase().includes('summary') ||
                       response.text.toLowerCase().includes('distilled');

    return {
      ...inputData,
      distilled: true,
      hasSummary,
    };
  },
});

// Step 4: Link
const linkStep = createStep({
  id: 'link',
  description: 'Create connections between the note and related notes',
  inputSchema: distillOutputSchema,
  outputSchema: linkOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const agent = mastra?.getAgent('linkAgent');
    if (!agent) {
      // Se linkAgent non è disponibile, salta questo step
      return {
        ...inputData,
        linked: false,
        linksCount: 0,
      };
    }

    const prompt = `Identify relationships between the following note and other notes in the system. Create bidirectional links to related notes:\n\nNote ID: ${inputData.noteId}\nTitle: ${inputData.title}\n\nContent: ${inputData.content}`;

    const response = await agent.generate([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    // Estrai numero di link creati dal risultato
    const responseText = response.text;
    const linkMatches = responseText.match(/(\d+)\s+link/i);
    const linksCount = linkMatches ? parseInt(linkMatches[1], 10) : 0;

    return {
      ...inputData,
      linked: true,
      linksCount,
    };
  },
});

// Step 5: Express
const expressStep = createStep({
  id: 'express',
  description: 'Create plans or execute actions based on the organized note',
  inputSchema: linkOutputSchema,
  outputSchema: expressOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    // Express step è opzionale - solo se la nota richiede un piano o azioni
    // Per ora, restituiamo senza creare piani automaticamente
    // L'utente può richiedere esplicitamente la creazione di un piano

    return {
      ...inputData,
      expressed: false,
    };
  },
});

// Step 6: Review (opzionale, standalone)
const reviewStep = createStep({
  id: 'review',
  description: 'Perform weekly/monthly review of the second brain system',
  inputSchema: z.object({
    reviewType: z.enum(['weekly', 'monthly']).optional().default('weekly').describe('Type of review to perform'),
  }),
  outputSchema: reviewOutputSchema,
  execute: async ({ inputData, mastra }) => {
    if (!inputData) {
      throw new Error('Input data not found');
    }

    const agent = mastra?.getAgent('reviewAgent');
    if (!agent) {
      throw new Error('Review Agent not found');
    }

    const prompt = `Perform a ${inputData.reviewType || 'weekly'} review of the second brain system. Identify completed projects to archive, inactive areas, and outdated resources. Generate a comprehensive review report.`;

    const response = await agent.generate([
      {
        role: 'user',
        content: prompt,
      },
    ]);

    // Estrai statistiche dal report
    const reportText = response.text;
    const archivedMatch = reportText.match(/(\d+)\s+(?:items?|projects?|areas?)\s+(?:archived|to archive)/i);
    const reclassifiedMatch = reportText.match(/(\d+)\s+(?:items?)\s+(?:reclassified|moved)/i);

    return {
      reviewed: true,
      report: reportText,
      archivedCount: archivedMatch ? parseInt(archivedMatch[1], 10) : 0,
      reclassifiedCount: reclassifiedMatch ? parseInt(reclassifiedMatch[1], 10) : 0,
    };
  },
});

// Workflow principale: CODE completo
const secondBrainWorkflow = createWorkflow({
  id: 'second-brain-workflow',
  inputSchema: workflowInputSchema,
  outputSchema: expressOutputSchema,
})
  .then(captureStep)
  .then(organizeStep)
  .then(distillStep)
  .then(linkStep)
  .then(expressStep);

// Workflow per solo review
const secondBrainReviewWorkflow = createWorkflow({
  id: 'second-brain-review-workflow',
  inputSchema: z.object({
    reviewType: z.enum(['weekly', 'monthly']).optional().default('weekly'),
  }),
  outputSchema: reviewOutputSchema,
})
  .then(reviewStep);

secondBrainWorkflow.commit();
secondBrainReviewWorkflow.commit();

export { secondBrainWorkflow, secondBrainReviewWorkflow };