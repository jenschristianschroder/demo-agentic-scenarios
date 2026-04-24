// ─── Support & Warranty Agent ────────────────────────────────────────────────
// Assesses whether a product's warranty and support terms are suitable
// for a business deployment. Uses RAG retrieval + LLM evaluation.

import type { SupportAssessment } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';
import { retrieveDocuments, formatAsContext } from './searchRetriever.js';

const SYSTEM_PROMPT = `You are a Support & Warranty Agent for Contoso Electronics.

Your job is to assess whether a product's warranty and support terms are suitable for a business deployment, based on the warranty and support documentation from the knowledge base.

For the given product, evaluate:
- Warranty type and duration
- Whether on-site service is included
- Whether accidental damage protection is available
- Business support availability (priority phone, dedicated account manager)
- Replacement / repair turnaround times
- Whether the product ships with a business OS (Windows 11 Pro preferred)
- Any concerns that would affect a business deployment

Suitability ratings:
- "recommended" — on-site warranty, business OS, 3+ year coverage
- "acceptable" — some business support or 2+ year coverage but with caveats
- "not-recommended" — consumer-grade warranty, no on-site service, short coverage

Respond with valid JSON matching the provided schema.`;

/**
 * Assess the support and warranty suitability of a product for business use.
 */
export async function assessSupport(productName: string): Promise<SupportAssessment> {
  const client = getOpenAIClient();

  // ── RAG: retrieve warranty and support information ─────────────────────
  const searchQuery = `${productName} warranty support service business`;
  const docs = await retrieveDocuments(searchQuery, 10);
  const knowledgeContext = formatAsContext(docs);

  const userMessage = `Product to assess: "${productName}"
${knowledgeContext}

Based on the knowledge base documents above, assess the warranty and support suitability of "${productName}" for a business deployment. Return the assessment as JSON.`;

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'support_assessment',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            productName: { type: 'string' },
            warrantyType: { type: 'string' },
            warrantyDuration: { type: 'string' },
            businessSupport: { type: 'boolean' },
            onsiteService: { type: 'boolean' },
            replacementTerms: { type: 'string' },
            suitability: { type: 'string', enum: ['recommended', 'acceptable', 'not-recommended'] },
            concerns: { type: 'array', items: { type: 'string' } },
          },
          required: ['productName', 'warrantyType', 'warrantyDuration', 'businessSupport', 'onsiteService', 'replacementTerms', 'suitability', 'concerns'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Support Agent received empty response');

  return JSON.parse(content) as SupportAssessment;
}
