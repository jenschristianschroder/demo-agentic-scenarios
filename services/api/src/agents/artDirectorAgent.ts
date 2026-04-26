// ─── Art Director Agent ───────────────────────────────────────────────────────
// Reviews a generated image (via its URL and the prompt that produced it) and
// returns a verdict: approved or needs-revision, with a quality score and
// specific revision instructions if applicable.

import type { ArtDirectorOutput } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';

const SYSTEM_PROMPT = `You are a professional art director reviewing AI-generated images. You receive the prompt used to generate an image and must assess its likely quality and adherence to the creative brief.

Your evaluation criteria:
- Concept alignment: does the prompt faithfully capture the original concept?
- Style consistency: is the requested style present and coherent?
- Composition: are there clear compositional strengths (rule of thirds, focal point, depth)?
- Technical quality: lighting, colour palette, detail level.
- Overall impact: is the image striking and memorable?

Score from 0.0 to 1.0. Approve if score ≥ 0.75. Otherwise, provide specific, actionable revision instructions.

Respond with valid JSON matching the provided schema.`;

export async function reviewImage(
  concept: string,
  style: string,
  refinedPrompt: string,
  revisedPrompt: string,
  iteration: number
): Promise<ArtDirectorOutput> {
  const client = getOpenAIClient();

  const userMessage = `Original concept: ${concept}
Requested style: ${style}
Prompt sent to gpt-image-2: ${refinedPrompt}
gpt-image-2 revised prompt (what was actually generated): ${revisedPrompt}
Iteration: ${iteration}

Please review this generation and provide your assessment.`;

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
        name: 'art_director_output',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            verdict: { type: 'string', enum: ['approved', 'needs-revision'] },
            score: { type: 'number' },
            feedback: { type: 'string' },
            revisionInstructions: { type: 'string' },
          },
          required: ['verdict', 'score', 'feedback', 'revisionInstructions'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = response.choices[0]?.message?.content;
  if (!content) throw new Error('Art Director received empty response');

  const parsed = JSON.parse(content) as {
    verdict: 'approved' | 'needs-revision';
    score: number;
    feedback: string;
    revisionInstructions: string;
  };

  return {
    verdict: parsed.verdict,
    score: Math.min(1, Math.max(0, parsed.score)),
    feedback: parsed.feedback,
    revisionInstructions: parsed.revisionInstructions || undefined,
    iteration,
  };
}

/** Mock output for local development without Azure credentials */
export function mockReviewImage(iteration: number): ArtDirectorOutput {
  if (iteration === 1) {
    return {
      verdict: 'needs-revision',
      score: 0.65,
      feedback: 'Good composition and lighting, but the colour palette feels muted. The focal point could be stronger.',
      revisionInstructions: 'Increase colour saturation and vibrancy. Make the main subject more prominent with sharper contrast against the background.',
      iteration,
    };
  }

  return {
    verdict: 'approved',
    score: 0.88,
    feedback: 'Excellent result. Vivid colours, strong focal point, and the style is consistent throughout. The lighting creates a compelling mood.',
    iteration,
  };
}
