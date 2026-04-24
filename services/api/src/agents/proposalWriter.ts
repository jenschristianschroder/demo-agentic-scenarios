// ─── Proposal Writer Agent ───────────────────────────────────────────────────
// Drafts a business-ready sales proposal based on all specialist agent outputs.
// Uses RAG retrieval for proposal templates and company info, then Azure OpenAI
// for natural language generation.

import type {
  CustomerRequirements,
  ProductCandidate,
  PricingResult,
  SupportAssessment,
} from '../types.js';
import { getOpenAIClient } from '../azureClients.js';
import { retrieveDocuments, formatAsContext } from './searchRetriever.js';

const SYSTEM_PROMPT = `You are a Proposal Writer Agent for Contoso Electronics.

Your job is to draft a complete, professional sales proposal based on the analysis from specialist agents and the proposal template from the knowledge base.

Follow the proposal template structure from the knowledge base. The proposal MUST include ALL of these sections:

1. **Executive Summary** — 2-3 sentences summarizing the recommendation
2. **Customer Requirements Summary** — restate what the customer needs
3. **Recommended Solution** — full product details with specs, and why it fits
4. **Pricing Breakdown** — unit price, volume discount, total, budget comparison
5. **Warranty & Support** — warranty type, duration, on-site availability, support channels
6. **Alternative Option** — if an alternative product was evaluated
7. **Trade-offs & Considerations** — any concerns or caveats
8. **Recommended Accessories** — relevant add-ons for the deployment
9. **Next Steps** — call to action with contact info and proposal validity

Use the company boilerplate and contact information from the knowledge base.
Use Markdown formatting with headers (##), bold, and bullet points.
Keep the proposal between 400-600 words.
Use DKK amounts with thousands separators.
End with a clear call to action.

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

  // ── RAG: retrieve proposal template, product details, and company info ──
  const searchQuery = `sales proposal template ${recommendedProduct.name} company contact warranty pricing`;
  const docs = await retrieveDocuments(searchQuery, 10);
  const knowledgeContext = formatAsContext(docs);

  const context = `
${knowledgeContext}

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
