// ─── Product Specialist Agent ────────────────────────────────────────────────
// Searches the Contoso product catalog using RAG (Azure AI Search) and then
// has the LLM evaluate and rank candidates against customer requirements.

import type { CustomerRequirements, ProductCandidate } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';
import { retrieveDocuments, formatAsContext } from './searchRetriever.js';

const SYSTEM_PROMPT = `You are a Product Specialist Agent for Contoso Electronics.

Your job is to evaluate product information from the knowledge base and rank candidates based on how well they match the customer's requirements.

For each product found in the knowledge base, evaluate:
- Battery life fit (does it meet the customer's needs?)
- Weight and portability
- Operating system (Windows 11 Pro preferred for business)
- Warranty and support level
- Price vs per-unit budget
- Overall suitability for the stated use case

Exclude tablets (Android devices) — only recommend laptops.

Return an array of product candidates sorted by fit score (highest first).
Each candidate must include: name, category, priceDKK, keySpecs, batteryLife, weight, warranty, fitScore (0-15), and fitReason.

Respond with valid JSON matching the provided schema.`;

/**
 * Find candidate products using RAG retrieval + LLM evaluation.
 */
export async function findProductCandidates(reqs: CustomerRequirements): Promise<ProductCandidate[]> {
  const client = getOpenAIClient();

  // ── RAG: retrieve product information from Azure AI Search ─────────────
  const searchQuery = `${reqs.useCase} laptop ${reqs.priorities.join(' ')} business`;
  const docs = await retrieveDocuments(searchQuery, 10);
  const knowledgeContext = formatAsContext(docs);

  const perUnitBudget = Math.floor(reqs.budgetDKK / reqs.quantity);

  const userMessage = `Customer Requirements:
- Quantity: ${reqs.quantity}
- Total budget: DKK ${reqs.budgetDKK.toLocaleString()}
- Per-unit budget: DKK ${perUnitBudget.toLocaleString()}
- Use case: ${reqs.useCase}
- Priorities: ${reqs.priorities.join(', ')}
- Warranty needs: ${reqs.warrantyNeeds}
- Additional notes: ${reqs.additionalNotes}
${knowledgeContext}

Based on the knowledge base documents above, identify all matching laptop products and evaluate them against the customer requirements. Return the candidates sorted by fit score.`;

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    temperature: 0.2,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'product_candidates',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            candidates: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  priceDKK: { type: 'number' },
                  keySpecs: { type: 'string' },
                  batteryLife: { type: 'string' },
                  weight: { type: 'string' },
                  warranty: { type: 'string' },
                  fitScore: { type: 'number' },
                  fitReason: { type: 'string' },
                },
                required: ['name', 'category', 'priceDKK', 'keySpecs', 'batteryLife', 'weight', 'warranty', 'fitScore', 'fitReason'],
                additionalProperties: false,
              },
            },
          },
          required: ['candidates'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Product Specialist received empty response');

  const parsed = JSON.parse(content) as { candidates: ProductCandidate[] };
  return parsed.candidates.sort((a, b) => b.fitScore - a.fitScore);
}
