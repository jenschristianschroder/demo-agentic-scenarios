// ─── Fact-Checker Agent ──────────────────────────────────────────────────────
// Validates generated claims by asking Azure OpenAI to evaluate each claim.
// Uses structured outputs for reliable JSON responses.

import type { FactCheckerOutput, FactualClaim, ClaimStatus } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';

const SYSTEM_PROMPT = `You are a fact-checker agent in a multi-agent content pipeline.

Your job is to evaluate a list of factual claims for accuracy. For each claim, determine:
- "supported": the claim is factually accurate based on your knowledge
- "unsupported": the claim is factually incorrect or fabricated
- "uncertain": you cannot confidently verify or refute the claim

Also provide:
- A brief evidence string for each claim explaining your reasoning
- An overall score from 0.0 to 1.0 (proportion of supported claims)
- A verdict: "approved" if all claims are supported, "needs-revision" if some are unsupported, "rejected" if most are unsupported
- If verdict is not "approved", provide revisionInstructions explaining what needs to be fixed
- A list of evidenceReferences (brief source descriptions for supported claims)

Respond with valid JSON matching the provided schema.`;

/**
 * Fact-check a list of claims using Azure OpenAI.
 */
export async function runFactChecker(
  claims: FactualClaim[],
  draftText: string
): Promise<FactCheckerOutput> {
  const client = getOpenAIClient();

  const userMessage = `Draft text:\n---\n${draftText}\n---\n\nClaims to verify:\n${claims.map((c) => `- [${c.id}] ${c.text}`).join('\n')}`;

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
        name: 'fact_checker_output',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            verdict: {
              type: 'string',
              enum: ['approved', 'needs-revision', 'rejected'],
            },
            score: { type: 'number' },
            claims: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  text: { type: 'string' },
                  status: {
                    type: 'string',
                    enum: ['supported', 'unsupported', 'uncertain'],
                  },
                  evidence: { type: 'string' },
                },
                required: ['id', 'text', 'status', 'evidence'],
                additionalProperties: false,
              },
            },
            revisionInstructions: { type: ['string', 'null'] },
            evidenceReferences: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['verdict', 'score', 'claims', 'revisionInstructions', 'evidenceReferences'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Fact-checker received empty response from Azure OpenAI');
  }

  const parsed = JSON.parse(content) as {
    verdict: 'approved' | 'needs-revision' | 'rejected';
    score: number;
    claims: { id: string; text: string; status: ClaimStatus; evidence: string }[];
    revisionInstructions: string | null;
    evidenceReferences: string[];
  };

  const checkedClaims: FactualClaim[] = parsed.claims.map((c) => ({
    id: c.id,
    text: c.text,
    status: c.status,
    evidence: c.evidence,
  }));

  return {
    verdict: parsed.verdict,
    score: parsed.score,
    claims: checkedClaims,
    revisionInstructions: parsed.revisionInstructions ?? undefined,
    evidenceReferences: parsed.evidenceReferences,
  };
}
