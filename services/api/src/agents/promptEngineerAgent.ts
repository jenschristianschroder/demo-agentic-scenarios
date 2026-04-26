// ─── Prompt Engineer Agent ────────────────────────────────────────────────────
// Takes the user's creative concept and style preference, and crafts an
// optimised gpt-image-2 prompt with style notes and composition guidance.

import type { PromptEngineerOutput } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';

const SYSTEM_PROMPT = `You are an expert gpt-image-2 prompt engineer. Your job is to transform a user's creative concept into a highly effective image-generation prompt.

Guidelines:
- Write a single, detailed, vivid prompt optimised for gpt-image-2 (typically 50-150 words).
- Incorporate the requested style naturally into the prompt language.
- Include lighting, atmosphere, colour palette, and compositional details.
- Avoid prohibited content (violence, nudity, real people by name, copyrighted characters).
- If revision instructions are provided, incorporate them precisely.

Respond with valid JSON matching the provided schema.`;

export async function engineerPrompt(
  concept: string,
  style: string,
  creativityLevel: number,
  revisionInstructions?: string,
  iteration: number = 1
): Promise<PromptEngineerOutput> {
  const client = getOpenAIClient();

  const userMessage = revisionInstructions
    ? `Concept: ${concept}\nStyle: ${style}\n\nRevision instructions from art director:\n${revisionInstructions}\n\nPlease revise the prompt accordingly.`
    : `Concept: ${concept}\nStyle: ${style}`;

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    temperature: creativityLevel,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'prompt_engineer_output',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            refinedPrompt: { type: 'string' },
            styleNotes: { type: 'string' },
            compositionNotes: { type: 'string' },
          },
          required: ['refinedPrompt', 'styleNotes', 'compositionNotes'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Prompt Engineer received empty response');

  const parsed = JSON.parse(content) as Omit<PromptEngineerOutput, 'iteration'>;
  return { ...parsed, iteration };
}

/** Mock output for local development without Azure credentials */
export function mockEngineerPrompt(
  concept: string,
  style: string,
  revisionInstructions?: string,
  iteration: number = 1
): PromptEngineerOutput {
  const base = revisionInstructions
    ? `${concept}, revised: ${revisionInstructions}, ${style} style, highly detailed, professional photography, dramatic lighting, cinematic composition, 8K resolution`
    : `${concept}, ${style} style, highly detailed, professional photography, dramatic lighting, cinematic composition, 8K resolution`;

  return {
    refinedPrompt: base,
    styleNotes: `Rendered in ${style} style with careful attention to lighting and texture.`,
    compositionNotes: 'Rule of thirds composition, foreground interest, strong depth of field.',
    iteration,
  };
}
