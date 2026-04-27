// ─── Image Generation Route ──────────────────────────────────────────────────
// POST /api/image-gen/run
// Orchestrates: Prompt Engineer → gpt-image-2 → Art Director (optional revision loop)
// Streams progress as Server-Sent Events.

import { Router } from 'express';
import type { Request, Response } from 'express';
import type {
  ImageGenRequest,
  ImageGenEvent,
  PromptEngineerOutput,
  ImageGenerationOutput,
  ArtDirectorOutput,
  ImageGenSummary,
  ImageSize,
  ImageQuality,
} from '../types.js';
import { getImageClient, getImageDeployment, isImageConfigured } from '../azureClients.js';
import { engineerPrompt, mockEngineerPrompt } from '../agents/promptEngineerAgent.js';
import { reviewImage, mockReviewImage } from '../agents/artDirectorAgent.js';

export const imageGenRouter = Router();

const VALID_SIZES: ImageSize[] = ['1024x1024', '1792x1024', '1024x1792'];
const VALID_QUALITIES: ImageQuality[] = ['low', 'medium', 'high', 'auto'];
const MAX_REVISIONS = 3;

// Placeholder image used in mock mode (simple SVG data URL)
const MOCK_IMAGE_URL =
  'data:image/svg+xml;base64,' +
  Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#667eea"/>
      <stop offset="100%" stop-color="#764ba2"/>
    </linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)" rx="24"/>
  <text x="50%" y="45%" font-family="system-ui,sans-serif" font-size="48" fill="white" text-anchor="middle" dominant-baseline="middle">🎨</text>
  <text x="50%" y="60%" font-family="system-ui,sans-serif" font-size="20" fill="rgba(255,255,255,0.8)" text-anchor="middle" dominant-baseline="middle">Mock Image</text>
  <text x="50%" y="70%" font-family="system-ui,sans-serif" font-size="14" fill="rgba(255,255,255,0.6)" text-anchor="middle" dominant-baseline="middle">Configure Azure OpenAI to generate real images</text>
</svg>`
  ).toString('base64');

function emit(res: Response, event: ImageGenEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function now(): string {
  return new Date().toISOString();
}

/**
 * POST /api/image-gen/run
 * Accepts an ImageGenRequest and streams SSE ImageGenEvents.
 */
imageGenRouter.post('/run', (req: Request, res: Response) => {
  const body = req.body as ImageGenRequest;

  // ── Input validation ─────────────────────────────────────────────────
  if (!body.concept || typeof body.concept !== 'string' || body.concept.trim().length === 0) {
    res.status(400).json({ error: 'concept is required' });
    return;
  }

  if (body.concept.length > 2000) {
    res.status(400).json({ error: 'concept must be 2000 characters or less' });
    return;
  }

  const size: ImageSize = VALID_SIZES.includes(body.size) ? body.size : '1024x1024';
  const quality: ImageQuality = VALID_QUALITIES.includes(body.quality) ? body.quality : 'auto';
  const maxRevisions = Math.min(MAX_REVISIONS, Math.max(1, Math.round(body.maxRevisions ?? 1)));
  const artDirectorEnabled = body.artDirectorEnabled === true;
  const creativityLevel = Math.min(1, Math.max(0, body.creativityLevel ?? 0.7));
  const style = (body.style || 'photorealistic').trim();
  const concept = body.concept.trim();

  // ── Set up SSE headers ───────────────────────────────────────────────
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  runImageGenPipeline(
    concept,
    style,
    size,
    quality,
    artDirectorEnabled,
    maxRevisions,
    creativityLevel,
    res
  ).catch((err) => {
    console.error('Image generation error:', err);
    emit(res, {
      type: 'error',
      step: 'user-request',
      timestamp: now(),
      data: { message: err instanceof Error ? err.message : 'Internal error' },
    });
    res.write('data: [DONE]\n\n');
    res.end();
  });
});

async function runImageGenPipeline(
  concept: string,
  style: string,
  size: ImageSize,
  quality: ImageQuality,
  artDirectorEnabled: boolean,
  maxRevisions: number,
  creativityLevel: number,
  res: Response
): Promise<void> {
  const useMock = !isImageConfigured();

  // ── Step 1: User request ─────────────────────────────────────────────
  emit(res, { type: 'step-start', step: 'user-request', timestamp: now(), data: { concept } });
  emit(res, { type: 'step-complete', step: 'user-request', timestamp: now(), data: { concept } });

  let iteration = 1;
  let revisionInstructions: string | undefined;
  let lastImageUrl = '';
  let lastRefinedPrompt = '';
  let lastRevisedPrompt = '';
  let lastArtDirectorOutput: ArtDirectorOutput | undefined;

  while (true) {
    // ── Step 2: Prompt Engineer ────────────────────────────────────────
    emit(res, { type: 'step-start', step: 'prompt-engineer', timestamp: now(), data: null });

    let promptOutput: PromptEngineerOutput;
    if (useMock) {
      promptOutput = mockEngineerPrompt(concept, style, revisionInstructions, iteration);
    } else {
      promptOutput = await engineerPrompt(concept, style, creativityLevel, revisionInstructions, iteration);
    }

    emit(res, { type: 'step-complete', step: 'prompt-engineer', timestamp: now(), data: promptOutput });

    lastRefinedPrompt = promptOutput.refinedPrompt;

    // ── Step 3: Image Generation ───────────────────────────────────────
    emit(res, { type: 'step-start', step: 'image-generation', timestamp: now(), data: null });

    let imageOutput: ImageGenerationOutput;
    if (useMock) {
      imageOutput = {
        imageUrl: MOCK_IMAGE_URL,
        revisedPrompt: promptOutput.refinedPrompt + ' [mock — no Azure credentials configured]',
        generationDurationMs: 0,
        iteration,
      };
    } else {
      const imageClient = getImageClient();
      const deployment = getImageDeployment();
      const genStart = Date.now();

      const imgResponse = await imageClient.images.generate({
        model: deployment,
        prompt: promptOutput.refinedPrompt,
        n: 1,
        size,
        quality,
        response_format: 'b64_json',
      });

      const generationDurationMs = Date.now() - genStart;
      const imageData = imgResponse.data?.[0];
      let imageUrl: string;
      if (imageData?.url) {
        imageUrl = imageData.url;
      } else if (imageData?.b64_json) {
        imageUrl = `data:image/png;base64,${imageData.b64_json}`;
      } else {
        throw new Error('gpt-image-2 returned no image data');
      }

      imageOutput = {
        imageUrl,
        revisedPrompt: imageData.revised_prompt ?? promptOutput.refinedPrompt,
        generationDurationMs,
        iteration,
      };
    }

    emit(res, { type: 'step-complete', step: 'image-generation', timestamp: now(), data: imageOutput });

    lastImageUrl = imageOutput.imageUrl;
    lastRevisedPrompt = imageOutput.revisedPrompt;

    // ── Step 4: Art Director (optional) ───────────────────────────────
    if (!artDirectorEnabled) break;

    emit(res, { type: 'step-start', step: 'art-director', timestamp: now(), data: null });

    let artOutput: ArtDirectorOutput;
    if (useMock) {
      artOutput = mockReviewImage(iteration);
    } else {
      artOutput = await reviewImage(
        concept,
        style,
        promptOutput.refinedPrompt,
        imageOutput.revisedPrompt,
        iteration
      );
    }

    emit(res, { type: 'step-complete', step: 'art-director', timestamp: now(), data: artOutput });

    lastArtDirectorOutput = artOutput;

    if (artOutput.verdict === 'approved' || iteration >= maxRevisions) {
      break;
    }

    // Art director wants revisions — loop
    revisionInstructions = artOutput.revisionInstructions;
    iteration++;
  }

  // ── Step 5: Final image ────────────────────────────────────────────
  const summary: ImageGenSummary = {
    finalImageUrl: lastImageUrl,
    finalPrompt: lastRevisedPrompt || lastRefinedPrompt,
    totalIterations: iteration,
    artDirectorScore: lastArtDirectorOutput?.score,
    artDirectorFeedback: lastArtDirectorOutput?.feedback,
  };

  emit(res, { type: 'step-start', step: 'final-image', timestamp: now(), data: null });
  emit(res, { type: 'step-complete', step: 'final-image', timestamp: now(), data: summary });
  emit(res, { type: 'run-complete', step: 'final-image', timestamp: now(), data: summary });

  res.write('data: [DONE]\n\n');
  res.end();
}
