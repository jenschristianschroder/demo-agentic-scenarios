// ─── Bundle Agent ────────────────────────────────────────────────────────────
// Produces the final bundle with pricing and a setup plan using RAG + LLM.

import type {
  HomeNeeds,
  DeviceRecommendation,
  PrivacyAssessment,
  CompatibilityResult,
  SmartHomeBundleSummary,
  SmartHomeAgentMessage,
} from '../types.js';
import { getOpenAIClient } from '../azureClients.js';
import { retrieveDocuments, formatAsContext } from './searchRetriever.js';

const SYSTEM_PROMPT = `You are a Bundle Agent for Contoso Electronics Smart Home division.

Your job is to assemble the final smart home bundle with:
1. A bundle name (e.g., "Privacy-First Smart Apartment Bundle")
2. Itemized list with quantities and prices
3. Total price and budget comparison
4. A step-by-step setup plan in Markdown format

The setup plan should include:
- Order of device installation (hub first, then sensors, then peripherals)
- Approximate time for each step
- Privacy configuration steps (enable local processing, close privacy shutter, etc.)
- Testing steps to verify everything works

Check if there's a pre-configured bundle in the knowledge base that matches. If so, use the bundle pricing (which includes a discount). Otherwise, calculate individual prices.

Respond with valid JSON matching the provided schema.`;

export async function assembleBundle(
  needs: HomeNeeds,
  devices: DeviceRecommendation[],
  privacyAssessments: PrivacyAssessment[],
  compatibilityResults: CompatibilityResult[],
  agentMessages: SmartHomeAgentMessage[]
): Promise<SmartHomeBundleSummary> {
  const client = getOpenAIClient();

  const searchQuery = `smart home bundle ${needs.spaceType} setup plan pricing`;
  const docs = await retrieveDocuments(searchQuery, 10);
  const knowledgeContext = formatAsContext(docs);

  const approvedDevices = devices.filter(d => {
    const assessment = privacyAssessments.find(p => p.deviceName === d.name);
    return !assessment || assessment.privacyRating !== 'rejected';
  });

  const hasCompatIssues = compatibilityResults.some(c => c.issues.length > 0);

  const deviceSummary = approvedDevices.map(d => {
    const privacy = privacyAssessments.find(p => p.deviceName === d.name);
    const compat = compatibilityResults.find(c => c.deviceName === d.name);
    return `- ${d.name} (DKK ${d.priceDKK}) — privacy: ${privacy?.privacyRating ?? 'n/a'}, compat issues: ${compat?.issues.length ?? 0}`;
  }).join('\n');

  const userMessage = `Assemble a smart home bundle for this customer:

Space: ${needs.spaceType} (${needs.spaceSize})
Privacy level: ${needs.privacyLevel}
Budget: DKK ${needs.budgetDKK.toLocaleString()}
Priorities: ${needs.priorities.join(', ')}

Approved devices:
${deviceSummary}

Compatibility issues: ${hasCompatIssues ? 'Yes — see details' : 'None'}
${knowledgeContext}

Create the final bundle with itemized pricing and a setup plan.`;

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'bundle_summary',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            bundleName: { type: 'string' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  quantity: { type: 'number' },
                  unitPriceDKK: { type: 'number' },
                  totalPriceDKK: { type: 'number' },
                },
                required: ['name', 'quantity', 'unitPriceDKK', 'totalPriceDKK'],
                additionalProperties: false,
              },
            },
            totalPriceDKK: { type: 'number' },
            budgetDKK: { type: 'number' },
            withinBudget: { type: 'boolean' },
            setupPlan: { type: 'string' },
            privacyOk: { type: 'boolean' },
            compatibilityOk: { type: 'boolean' },
          },
          required: ['bundleName', 'items', 'totalPriceDKK', 'budgetDKK', 'withinBudget', 'setupPlan', 'privacyOk', 'compatibilityOk'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Bundle Agent received empty response');

  const parsed = JSON.parse(content) as Omit<SmartHomeBundleSummary, 'agentMessages'>;
  return { ...parsed, agentMessages };
}
