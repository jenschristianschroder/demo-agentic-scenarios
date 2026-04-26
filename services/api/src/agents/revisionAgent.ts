// ─── Revision Agent ──────────────────────────────────────────────────────────
// Rewrites draft content by replacing unsupported claims with verified facts
// from the knowledge base. Distinct from the generator: it focuses solely on
// correcting factual errors while preserving the original structure and tone.

import type { RevisionOutput, FactualClaim } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';

const SYSTEM_PROMPT = `You are a revision agent in a multi-agent fact-checking pipeline.

Your ONLY job is to rewrite a draft, replacing unsupported claims with verified facts from the knowledge base.

IMPORTANT RULES:
- Keep the overall structure, tone, and style of the original draft.
- Replace ONLY the unsupported claims with correct information from the knowledge base.
- Do NOT add new claims that are not backed by the knowledge base.
- For each change you make, provide a brief human-readable description in changesApplied.
- Format each changesApplied entry like: "Replaced '<old claim>' with '<new fact>'"
- If a claim has no replacement in the knowledge base, remove it and note the removal.

Respond with valid JSON matching the provided schema.`;

/**
 * Revise draft content by replacing unsupported claims with knowledge-base facts.
 */
export async function runRevisionAgent(
  draftText: string,
  unsupportedClaims: FactualClaim[],
  revisionInstructions: string,
  iteration: number,
  knowledgeContext: string
): Promise<RevisionOutput> {
  const client = getOpenAIClient();

  const claimsList = unsupportedClaims
    .map((c) => `- [${c.id}] "${c.text}" — Evidence: ${c.evidence ?? 'none'}`)
    .join('\n');

  const userMessage = `Original draft:\n---\n${draftText}\n---\n\nUnsupported claims to fix:\n${claimsList}\n\nRevision instructions:\n${revisionInstructions}\n${knowledgeContext}\n\nRewrite the draft, replacing the unsupported claims with verified facts. Keep everything else intact.`;

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
        name: 'revision_output',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            revisedText: { type: 'string' },
            changesApplied: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['revisedText', 'changesApplied'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Revision agent received empty response from Azure OpenAI');
  }

  const parsed = JSON.parse(content) as { revisedText: string; changesApplied: string[] };

  return {
    revisedText: parsed.revisedText,
    changesApplied: parsed.changesApplied,
    iteration,
  };
}
