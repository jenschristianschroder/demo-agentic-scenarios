// ─── Needs Agent ─────────────────────────────────────────────────────────────
// Identifies apartment size, privacy constraints, budget, and priorities
// from the customer's natural-language request. Uses LLM + structured output.

import type { HomeNeeds } from '../../types.js';
import { getOpenAIClient } from '../../azureClients.js';

const SYSTEM_PROMPT = `You are a Needs Agent for Contoso Electronics Smart Home division.

Your job is to parse a customer's smart home request into structured requirements.

Extract:
- spaceType: type of living space (e.g., "small apartment", "house", "studio")
- spaceSize: approximate size if mentioned, or infer from space type (e.g., "50-70 sqm", "unknown")
- privacyLevel: how important privacy is ("high", "medium", "low") — look for keywords like "privacy", "no cameras", "mute", "private"
- budgetDKK: total budget in DKK. If given in EUR, convert at approximately 7.46 DKK/EUR. If not specified, default to 5000
- priorities: list of priorities (e.g., ["privacy", "automation", "security", "energy monitoring"])
- additionalNotes: any other relevant details

Respond with valid JSON matching the provided schema.`;

export async function analyzeNeeds(prompt: string, creativity: number): Promise<HomeNeeds> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    temperature: Math.min(creativity, 0.2),
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'home_needs',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            spaceType: { type: 'string' },
            spaceSize: { type: 'string' },
            privacyLevel: { type: 'string' },
            budgetDKK: { type: 'number' },
            priorities: { type: 'array', items: { type: 'string' } },
            additionalNotes: { type: 'string' },
          },
          required: ['spaceType', 'spaceSize', 'privacyLevel', 'budgetDKK', 'priorities', 'additionalNotes'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Needs Agent received empty response');

  return JSON.parse(content) as HomeNeeds;
}
