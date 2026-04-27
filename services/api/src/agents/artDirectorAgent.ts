// ─── Art Director Agent ───────────────────────────────────────────────────────
// Reviews a generated image using GPT-4o vision capabilities. Compares the
// output against the original concept, prompt, and optional reference image.
// Returns a verdict: approved or needs-revision, with a quality score and
// specific revision instructions if applicable.

import type { ArtDirectorOutput } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';
import type { ChatCompletionContentPart } from 'openai/resources/chat/completions.js';

const SYSTEM_PROMPT = `You are a professional art director reviewing AI-generated images. You receive the generated image and must assess its quality and adherence to the creative brief.

Your evaluation criteria:
- Concept alignment: does the image faithfully capture the original concept?
- Style consistency: is the requested style present and coherent?
- Composition: are there clear compositional strengths (rule of thirds, focal point, depth)?
- Technical quality: lighting, colour palette, detail level.
- Overall impact: is the image striking and memorable?
- Reference alignment: if a reference image was provided, assess how well the generated image incorporates elements, style, or composition from the reference as intended by the user's concept.

Score from 0.0 to 1.0. Approve if score ≥ 0.75. Otherwise, provide specific, actionable revision instructions.

Respond with valid JSON matching the provided schema.`;

export async function reviewImage(
  concept: string,
  style: string,
  refinedPrompt: string,
  revisedPrompt: string,
  iteration: number,
  generatedImageBase64?: string,
  referenceImageBase64?: string
): Promise<ArtDirectorOutput> {
  const client = getOpenAIClient();

  let textMessage = `Original concept: ${concept}
Requested style: ${style}
Prompt sent to gpt-image-2: ${refinedPrompt}
gpt-image-2 revised prompt (what was actually generated): ${revisedPrompt}
Iteration: ${iteration}`;

  if (referenceImageBase64) {
    textMessage += `\n\nA reference image was provided by the user. Please compare the generated image against both the concept and the reference image. Assess how well the generated image incorporates or draws inspiration from the reference.`;
  }

  textMessage += '\n\nPlease review this generation and provide your assessment.';

  // Build content parts with vision support
  const contentParts: ChatCompletionContentPart[] = [
    { type: 'text', text: textMessage },
  ];

  // Include generated image for visual review if available
  if (generatedImageBase64) {
    const imageUrl = generatedImageBase64.startsWith('data:')
      ? generatedImageBase64
      : `data:image/png;base64,${generatedImageBase64}`;
    contentParts.push({
      type: 'image_url',
      image_url: { url: imageUrl, detail: 'high' },
    });
  }

  // Include reference image for comparison if available
  if (referenceImageBase64) {
    const refUrl = referenceImageBase64.startsWith('data:')
      ? referenceImageBase64
      : `data:image/png;base64,${referenceImageBase64}`;
    contentParts.push({
      type: 'image_url',
      image_url: { url: refUrl, detail: 'high' },
    });
  }

  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    temperature: 0.3,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: contentParts },
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
