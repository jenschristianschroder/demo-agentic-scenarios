// ─── Generator Agent ─────────────────────────────────────────────────────────
// Produces draft content from a prompt with configurable creativity.
// When Azure OpenAI is configured, delegates to the model.
// Falls back to mock generation for local development without Azure credentials.

import type { GeneratorOutput, FactualClaim } from '../types.js';
import { isAzureConfigured } from '../azureClients.js';

/**
 * Generate draft content and extract factual claims.
 *
 * @param prompt - The user's original prompt or revision instructions
 * @param creativityLevel - 0 (precise) to 1 (creative / hallucination-prone)
 * @param iteration - Current iteration number
 * @param previousDraft - Previous draft text when revising
 * @param revisionInstructions - Instructions from the fact-checker on what to fix
 */
export async function runGenerator(
  prompt: string,
  creativityLevel: number,
  iteration: number,
  previousDraft?: string,
  revisionInstructions?: string
): Promise<GeneratorOutput> {
  if (isAzureConfigured()) {
    return runAzureGenerator(prompt, creativityLevel, iteration, previousDraft, revisionInstructions);
  }
  return runMockGenerator(prompt, creativityLevel, iteration, previousDraft, revisionInstructions);
}

// ─── Azure OpenAI implementation (seam for real integration) ─────────────────

async function runAzureGenerator(
  prompt: string,
  creativityLevel: number,
  iteration: number,
  previousDraft?: string,
  revisionInstructions?: string
): Promise<GeneratorOutput> {
  // TODO: Integrate with Azure OpenAI SDK
  // - Use getOpenAIConfig() for endpoint/deployment/credential
  // - Set temperature = creativityLevel
  // - System prompt should instruct the model to:
  //   1. Write factual content
  //   2. Return structured JSON with draftText and claims array
  //   3. If revising, incorporate the revision instructions
  // - Use Azure AI Search for RAG grounding
  console.log('Azure generator not yet implemented — falling back to mock');
  return runMockGenerator(prompt, creativityLevel, iteration, previousDraft, revisionInstructions);
}

// ─── Mock implementation for local dev ───────────────────────────────────────

async function runMockGenerator(
  prompt: string,
  creativityLevel: number,
  iteration: number,
  _previousDraft?: string,
  revisionInstructions?: string
): Promise<GeneratorOutput> {
  // Simulate processing delay
  await delay(800 + Math.random() * 600);

  const isRevision = iteration > 1 && revisionInstructions;

  // Higher creativity → more "hallucinated" claims
  const hallucinate = creativityLevel > 0.5;

  const claims: FactualClaim[] = [
    {
      id: `claim-${iteration}-1`,
      text: 'Denmark generates over 50% of its electricity from wind power.',
    },
    {
      id: `claim-${iteration}-2`,
      text: 'The Danish island of Samsø became 100% renewable energy powered by 2007.',
    },
    {
      id: `claim-${iteration}-3`,
      text: hallucinate && !isRevision
        ? 'Denmark was the first country to build a nuclear fusion reactor in 2019.'
        : 'Denmark has set a target to reduce greenhouse gas emissions by 70% by 2030.',
    },
  ];

  const draftText = isRevision
    ? `[Revised draft — iteration ${iteration}] Based on the prompt "${prompt}", here is an updated summary incorporating fact-check feedback: ${claims.map((c) => c.text).join(' ')}`
    : `Based on the prompt "${prompt}", here is a summary: ${claims.map((c) => c.text).join(' ')}`;

  return {
    draftText,
    claims,
    iteration,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
