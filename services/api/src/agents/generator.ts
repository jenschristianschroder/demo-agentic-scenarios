// ─── Generator Agent ─────────────────────────────────────────────────────────
// Produces draft content from a prompt with configurable creativity.
// Uses Azure OpenAI with structured outputs for reliable JSON responses.

import type { GeneratorOutput, FactualClaim } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';

const SYSTEM_PROMPT = `You are a content generator agent in a multi-agent fact-checking pipeline.

Your job is to produce factual, well-written content based on the user's prompt.
Extract every distinct factual claim you make into a separate claim object.

IMPORTANT RULES:
- Each claim must be a single, verifiable factual statement.
- Assign each claim a unique id like "claim-{iteration}-{n}" where iteration is provided and n is sequential starting at 1.
- If you are revising a previous draft, incorporate the revision instructions to fix incorrect claims.
- Do NOT repeat claims that were flagged as unsupported — replace them with correct, verifiable facts.

Respond with valid JSON matching the provided schema.`;

/**
 * Generate draft content and extract factual claims.
 */
export async function runGenerator(
  prompt: string,
  creativityLevel: number,
  iteration: number,
  previousDraft?: string,
  revisionInstructions?: string
): Promise<GeneratorOutput> {
  const client = getOpenAIClient();
  const userMessage = buildUserMessage(prompt, iteration, previousDraft, revisionInstructions);

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
        name: 'generator_output',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            draftText: { type: 'string' },
            claims: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  text: { type: 'string' },
                },
                required: ['id', 'text'],
                additionalProperties: false,
              },
            },
          },
          required: ['draftText', 'claims'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Generator received empty response from Azure OpenAI');
  }

  const parsed = JSON.parse(content) as { draftText: string; claims: { id: string; text: string }[] };

  const claims: FactualClaim[] = parsed.claims.map((c, i) => ({
    id: c.id || `claim-${iteration}-${i + 1}`,
    text: c.text,
  }));

  return {
    draftText: parsed.draftText,
    claims,
    iteration,
  };
}

function buildUserMessage(
  prompt: string,
  iteration: number,
  previousDraft?: string,
  revisionInstructions?: string
): string {
  let message = `Prompt: ${prompt}\nIteration: ${iteration}\n`;

  if (iteration > 1 && previousDraft && revisionInstructions) {
    message += `\nYou are REVISING a previous draft. Here is the previous draft:\n---\n${previousDraft}\n---\n`;
    message += `\nRevision instructions from the fact-checker:\n${revisionInstructions}\n`;
    message += `\nFix the issues identified above. Keep correct claims, replace incorrect ones with verified facts.`;
  } else {
    message += `\nWrite an informative, factual response to this prompt. Use claim IDs starting with "claim-${iteration}-".`;
  }

  return message;
}
