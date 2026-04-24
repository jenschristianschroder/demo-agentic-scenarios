// ─── Compatibility Agent ─────────────────────────────────────────────────────
// Checks protocol compatibility between all recommended devices using RAG + LLM.

import type { DeviceRecommendation, CompatibilityResult } from '../../types.js';
import { getOpenAIClient } from '../../azureClients.js';
import { retrieveDocuments, formatAsContext } from '../searchRetriever.js';

const SYSTEM_PROMPT = `You are a Compatibility Agent for Contoso Electronics Smart Home division.

Your job is to check the protocol compatibility between recommended smart home devices based on the knowledge base.

For each device, determine:
- protocols: list of supported protocols
- matterSupport: does it support Matter 1.2?
- threadSupport: does it support Thread 1.3?
- zigbeeSupport: does it support Zigbee 3.0?
- wifiSupport: does it support Wi-Fi?
- hubRequired: does this device need a hub to operate?
- compatibleWith: list of other devices in the bundle it can communicate with directly
- issues: any compatibility problems found

Key rules:
- Zigbee and Thread devices REQUIRE a hub (like Contoso Home Hub 7)
- Matter devices work with any Matter-compatible hub
- Wi-Fi devices connect directly to the router and do not need a hub
- If a hub is included in the bundle, Zigbee/Thread devices are compatible
- All devices must have at least one common protocol with the hub

Respond with valid JSON matching the provided schema.`;

export async function checkCompatibility(
  devices: DeviceRecommendation[]
): Promise<CompatibilityResult[]> {
  const client = getOpenAIClient();

  const deviceNames = devices.map(d => d.name).join(', ');
  const searchQuery = `${deviceNames} compatibility protocol Matter Thread Zigbee`;
  const docs = await retrieveDocuments(searchQuery, 10);
  const knowledgeContext = formatAsContext(docs);

  const deviceList = devices.map(d =>
    `- ${d.name} (${d.category}): protocols: ${d.protocols.join(', ')}`
  ).join('\n');

  const userMessage = `Check compatibility between these devices:

${deviceList}
${knowledgeContext}

Assess protocol compatibility for each device and identify any issues.`;

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
        name: 'compatibility_results',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            results: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  deviceName: { type: 'string' },
                  protocols: { type: 'array', items: { type: 'string' } },
                  matterSupport: { type: 'boolean' },
                  threadSupport: { type: 'boolean' },
                  zigbeeSupport: { type: 'boolean' },
                  wifiSupport: { type: 'boolean' },
                  hubRequired: { type: 'boolean' },
                  compatibleWith: { type: 'array', items: { type: 'string' } },
                  issues: { type: 'array', items: { type: 'string' } },
                },
                required: ['deviceName', 'protocols', 'matterSupport', 'threadSupport', 'zigbeeSupport', 'wifiSupport', 'hubRequired', 'compatibleWith', 'issues'],
                additionalProperties: false,
              },
            },
          },
          required: ['results'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Compatibility Agent received empty response');

  const parsed = JSON.parse(content) as { results: CompatibilityResult[] };
  return parsed.results;
}
