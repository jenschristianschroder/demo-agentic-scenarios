// ─── Privacy/Safety Agent ────────────────────────────────────────────────────
// Reviews each recommended device for privacy and safety concerns using RAG + LLM.
// Can approve, conditionally approve, or reject devices.

import type { DeviceRecommendation, PrivacyAssessment } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';
import { retrieveDocuments, formatAsContext } from './searchRetriever.js';

const SYSTEM_PROMPT = `You are a Privacy/Safety Agent for Contoso Electronics Smart Home division.

Your job is to review each recommended device for privacy and safety concerns based on the knowledge base documentation.

For each device, assess:
- hasCamera: does it have a camera?
- hasMicrophone: does it have a microphone?
- hasHardwareMuteSwitch: is there a PHYSICAL/HARDWARE mute switch that electrically disconnects the microphone? (software mute does NOT count)
- hasPrivacyShutter: is there a PHYSICAL privacy shutter that covers the camera lens?
- localProcessing: can the device operate with local-only processing (no cloud)?
- privacyRating: "approved" (all privacy controls present), "conditional" (acceptable with specific conditions), or "rejected" (unacceptable privacy risk)
- conditions: list of conditions that must be met for conditional approval (e.g., "Privacy shutter must remain closed when not in use")
- concerns: any privacy concerns found

Rules:
- Devices with cameras MUST have a hardware privacy shutter to be approved
- Devices with microphones MUST have a hardware mute switch to be approved
- If a device has both camera and microphone with hardware controls, it can be approved
- Sensor-only devices (no camera, no microphone) are automatically approved
- If privacy level is "high", be extra strict

Respond with valid JSON matching the provided schema.`;

export async function reviewPrivacy(
  device: DeviceRecommendation,
  privacyLevel: string
): Promise<PrivacyAssessment> {
  const client = getOpenAIClient();

  const searchQuery = `${device.name} privacy camera microphone mute switch shutter`;
  const docs = await retrieveDocuments(searchQuery, 10);
  const knowledgeContext = formatAsContext(docs);

  const userMessage = `Review the privacy and safety features of this device:

Device: ${device.name}
Category: ${device.category}
Key Features: ${device.keyFeatures}
Privacy Features Listed: ${device.privacyFeatures.join(', ')}
Customer Privacy Level: ${privacyLevel}
${knowledgeContext}

Based on the knowledge base, assess the privacy suitability of this device.`;

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
        name: 'privacy_assessment',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            deviceName: { type: 'string' },
            hasCamera: { type: 'boolean' },
            hasMicrophone: { type: 'boolean' },
            hasHardwareMuteSwitch: { type: 'boolean' },
            hasPrivacyShutter: { type: 'boolean' },
            localProcessing: { type: 'boolean' },
            privacyRating: { type: 'string', enum: ['approved', 'conditional', 'rejected'] },
            conditions: { type: 'array', items: { type: 'string' } },
            concerns: { type: 'array', items: { type: 'string' } },
          },
          required: ['deviceName', 'hasCamera', 'hasMicrophone', 'hasHardwareMuteSwitch', 'hasPrivacyShutter', 'localProcessing', 'privacyRating', 'conditions', 'concerns'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Privacy Agent received empty response');

  return JSON.parse(content) as PrivacyAssessment;
}
