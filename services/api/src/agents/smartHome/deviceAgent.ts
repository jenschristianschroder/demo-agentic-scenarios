// ─── Device Agent ────────────────────────────────────────────────────────────
// Recommends smart home devices based on customer needs using RAG + LLM.

import type { HomeNeeds, DeviceRecommendation } from '../../types.js';
import { getOpenAIClient } from '../../azureClients.js';
import { retrieveDocuments, formatAsContext } from '../searchRetriever.js';

const SYSTEM_PROMPT = `You are a Device Agent for Contoso Electronics Smart Home division.

Your job is to recommend smart home devices from the Contoso product catalog based on the customer's needs.

Consider:
- Space type and size (small apartment needs fewer devices than a house)
- Budget constraints
- Privacy requirements (if high privacy, highlight devices with hardware mute switches, privacy shutters, local processing)
- Customer priorities (automation, security, energy monitoring, etc.)

For each recommended device, include:
- name: exact product name from the catalog
- category: device category
- priceDKK: price in DKK
- keyFeatures: brief description of key features
- protocols: list of supported protocols (e.g., ["Wi-Fi 6", "Zigbee 3.0", "Thread 1.3", "Matter 1.2"])
- privacyFeatures: list of privacy-relevant features
- reason: why this device fits the customer's needs

Recommend a practical set of devices. For a small apartment, typically:
- 1 hub, 1 sensor kit, and optionally lighting or plugs

Respond with valid JSON matching the provided schema.`;

export async function recommendDevices(needs: HomeNeeds): Promise<DeviceRecommendation[]> {
  const client = getOpenAIClient();

  const searchQuery = `smart home ${needs.spaceType} ${needs.priorities.join(' ')} ${needs.privacyLevel} privacy`;
  const docs = await retrieveDocuments(searchQuery, 10);
  const knowledgeContext = formatAsContext(docs);

  const userMessage = `Customer Needs:
- Space: ${needs.spaceType} (${needs.spaceSize})
- Privacy level: ${needs.privacyLevel}
- Budget: DKK ${needs.budgetDKK.toLocaleString()}
- Priorities: ${needs.priorities.join(', ')}
- Notes: ${needs.additionalNotes}
${knowledgeContext}

Based on the product catalog above, recommend the best devices for this customer.`;

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
        name: 'device_recommendations',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            devices: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  category: { type: 'string' },
                  priceDKK: { type: 'number' },
                  keyFeatures: { type: 'string' },
                  protocols: { type: 'array', items: { type: 'string' } },
                  privacyFeatures: { type: 'array', items: { type: 'string' } },
                  reason: { type: 'string' },
                },
                required: ['name', 'category', 'priceDKK', 'keyFeatures', 'protocols', 'privacyFeatures', 'reason'],
                additionalProperties: false,
              },
            },
          },
          required: ['devices'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Device Agent received empty response');

  const parsed = JSON.parse(content) as { devices: DeviceRecommendation[] };
  return parsed.devices;
}
