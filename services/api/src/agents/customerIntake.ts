// ─── Customer Intake Agent ───────────────────────────────────────────────────
// Extracts structured requirements from a free-text customer request.
// Uses Azure OpenAI with structured outputs for reliable parsing.

import type { CustomerRequirements } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';

const SYSTEM_PROMPT = `You are a Customer Intake Agent for Contoso Electronics.

Your job is to extract structured requirements from a customer's request for a business laptop purchase.

Extract:
- quantity: number of devices requested
- budgetDKK: total budget in DKK (convert from other currencies if needed; 1 EUR ≈ 7.45 DKK, 1 USD ≈ 6.90 DKK)
- useCase: brief description of how the devices will be used
- priorities: array of key priorities (e.g. "long battery life", "lightweight", "business warranty")
- warrantyNeeds: what level of support/warranty the customer needs
- additionalNotes: any other constraints or preferences

If the customer doesn't specify a value, use reasonable defaults:
- Default budget: DKK 200,000
- Default quantity: 10
- Default warranty: "business support preferred"

Respond with valid JSON matching the provided schema.`;

export async function runCustomerIntake(
  prompt: string,
  creativityLevel: number
): Promise<CustomerRequirements> {
  const client = getOpenAIClient();

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: prompt },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'customer_requirements',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            quantity: { type: 'number' },
            budgetDKK: { type: 'number' },
            useCase: { type: 'string' },
            priorities: { type: 'array', items: { type: 'string' } },
            warrantyNeeds: { type: 'string' },
            additionalNotes: { type: 'string' },
          },
          required: ['quantity', 'budgetDKK', 'useCase', 'priorities', 'warrantyNeeds', 'additionalNotes'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Customer Intake received empty response');

  return JSON.parse(content) as CustomerRequirements;
}
