// ─── Proposal Writer Agent ───────────────────────────────────────────────────
// Drafts a business-ready sales proposal based on all specialist agent outputs.
// Uses Azure OpenAI for natural language generation.

import type {
  CustomerRequirements,
  ProductCandidate,
  PricingResult,
  SupportAssessment,
} from '../types.js';
import { getOpenAIClient } from '../azureClients.js';

const SYSTEM_PROMPT = `You are a Proposal Writer Agent for Contoso Electronics.

Your job is to draft a professional, concise sales proposal based on the analysis from specialist agents.

The proposal should include:
1. A brief restatement of the customer's needs
2. The recommended product with key specs
3. Pricing breakdown (unit price × quantity = total)
4. Warranty and support summary
5. Any trade-offs or alternatives considered
6. A clear call to action

Keep the tone professional but approachable. Use bullet points for specs.
Format the proposal as clean text ready for a business document.

Respond with valid JSON matching the provided schema.`;

export async function writeProposal(
  requirements: CustomerRequirements,
  recommendedProduct: ProductCandidate,
  pricing: PricingResult,
  support: SupportAssessment,
  alternativeProduct?: ProductCandidate,
  alternativePricing?: PricingResult,
  alternativeSupport?: SupportAssessment,
  tradeOffs?: string[]
): Promise<{ proposalText: string; tradeOffs: string[] }> {
  const client = getOpenAIClient();

  const context = `
Customer Requirements:
- Quantity: ${requirements.quantity}
- Budget: DKK ${requirements.budgetDKK.toLocaleString()}
- Use case: ${requirements.useCase}
- Priorities: ${requirements.priorities.join(', ')}
- Warranty needs: ${requirements.warrantyNeeds}

Recommended Product: ${recommendedProduct.name}
- Category: ${recommendedProduct.category}
- Key specs: ${recommendedProduct.keySpecs}
- Battery: ${recommendedProduct.batteryLife}
- Weight: ${recommendedProduct.weight}
- Warranty: ${recommendedProduct.warranty}

Pricing:
- Unit price: DKK ${pricing.unitPriceDKK.toLocaleString()}
- Quantity: ${pricing.quantity}
- Total: DKK ${pricing.totalDKK.toLocaleString()}
- Budget: DKK ${pricing.budgetDKK.toLocaleString()}
- ${pricing.withinBudget ? 'Within budget' : `Over budget by DKK ${Math.abs(pricing.budgetDelta).toLocaleString()}`}

Support Assessment:
- Warranty: ${support.warrantyType}
- Duration: ${support.warrantyDuration}
- On-site: ${support.onsiteService ? 'Yes' : 'No'}
- Business support: ${support.businessSupport ? 'Yes' : 'No'}
- Suitability: ${support.suitability}
${support.concerns.length > 0 ? `- Concerns: ${support.concerns.join('; ')}` : ''}
${alternativeProduct ? `
Alternative Product: ${alternativeProduct.name}
- Price: DKK ${alternativeProduct.priceDKK.toLocaleString()}
- Battery: ${alternativeProduct.batteryLife}
- Weight: ${alternativeProduct.weight}
- Warranty: ${alternativeProduct.warranty}
${alternativePricing ? `- Total for ${alternativePricing.quantity}: DKK ${alternativePricing.totalDKK.toLocaleString()} (${alternativePricing.withinBudget ? 'within budget' : 'over budget'})` : ''}
${alternativeSupport ? `- Support suitability: ${alternativeSupport.suitability}` : ''}
` : ''}
${tradeOffs && tradeOffs.length > 0 ? `Trade-offs identified: ${tradeOffs.join('; ')}` : ''}`;

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    temperature: 0.5,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Write a sales proposal based on this analysis:\n${context}` },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'proposal_output',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            proposalText: { type: 'string' },
            tradeOffs: { type: 'array', items: { type: 'string' } },
          },
          required: ['proposalText', 'tradeOffs'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Proposal Writer received empty response');

  return JSON.parse(content) as { proposalText: string; tradeOffs: string[] };
}
