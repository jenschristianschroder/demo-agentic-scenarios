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
  ImageProgressData,
} from '../types.js';
import { getImageClient, getImageDeployment } from '../azureClients.js';
import { engineerPrompt } from '../agents/promptEngineerAgent.js';
import { reviewImage } from '../agents/artDirectorAgent.js';
import { toFile } from 'openai';

export const imageGenRouter = Router();

const VALID_SIZES: ImageSize[] = ['1024x1024', '1536x1024', '1024x1536', 'auto'];
const VALID_QUALITIES: ImageQuality[] = ['low', 'medium', 'high', 'auto'];
const MAX_REVISIONS = 3;

function emit(res: Response, event: ImageGenEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function now(): string {
  return new Date().toISOString();
}

/**
 * Convert a base64 data URL or raw base64 string to a Buffer.
 * Validates the input and throws a descriptive error on failure.
 */
function base64ToBuffer(base64: string): Buffer {
  const raw = base64.includes(',') ? base64.split(',')[1] : base64;
  const buf = Buffer.from(raw, 'base64');
  if (buf.length === 0) {
    throw new Error('Invalid reference image: decoded buffer is empty');
  }
  return buf;
}

/**
 * Extract the MIME type from a base64 data URL (e.g. 'data:image/jpeg;base64,...').
 * Falls back to 'image/png' if the prefix is missing or unrecognised.
 */
function extractMimeType(dataUrl: string): { mime: string; ext: string } {
  const match = dataUrl.match(/^data:(image\/\w+);base64,/);
  if (match) {
    const mime = match[1];
    const ext = mime === 'image/jpeg' ? 'jpg' : mime.replace('image/', '');
    return { mime, ext };
  }
  return { mime: 'image/png', ext: 'png' };
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
  const referenceImageBase64 = body.referenceImageBase64 || undefined;

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
    referenceImageBase64,
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
  referenceImageBase64: string | undefined,
  res: Response
): Promise<void> {
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

    const promptOutput: PromptEngineerOutput = await engineerPrompt(
      concept,
      style,
      creativityLevel,
      revisionInstructions,
      iteration,
      !!referenceImageBase64
    );

    emit(res, { type: 'step-complete', step: 'prompt-engineer', timestamp: now(), data: promptOutput });

    lastRefinedPrompt = promptOutput.refinedPrompt;

    // ── Step 3: Image Generation ───────────────────────────────────────
    emit(res, { type: 'step-start', step: 'image-generation', timestamp: now(), data: null });

    const imageClient = getImageClient();
    const deployment = getImageDeployment();
    const genStart = Date.now();

    let imageOutput: ImageGenerationOutput;

    if (referenceImageBase64) {
      // Use images.edit when a reference image is provided
      const imageBuffer = base64ToBuffer(referenceImageBase64);
      const { mime, ext } = extractMimeType(referenceImageBase64);
      const imageFile = await toFile(imageBuffer, `reference.${ext}`, { type: mime });

      const result = await imageClient.images.edit({
        model: deployment,
        image: imageFile,
        prompt: promptOutput.refinedPrompt,
        n: 1,
        size: size === 'auto' ? undefined : size,
        quality,
      });

      const generationDurationMs = Date.now() - genStart;
      const imageData = result.data?.[0];

      if (!imageData?.b64_json) {
        throw new Error('gpt-image-2 edit returned no image data');
      }

      imageOutput = {
        imageUrl: `data:image/png;base64,${imageData.b64_json}`,
        revisedPrompt: imageData.revised_prompt || promptOutput.refinedPrompt,
        generationDurationMs,
        iteration,
      };
    } else {
      // Use images.generate for text-only generation (with streaming)
      const stream = await imageClient.images.generate({
        model: deployment,
        prompt: promptOutput.refinedPrompt,
        n: 1,
        size,
        quality,
        stream: true,
        partial_images: 3,
      });

      let finalB64 = '';
      const revisedPrompt = promptOutput.refinedPrompt;

      for await (const event of stream) {
        if (event.type === 'image_generation.partial_image') {
          const progressData: ImageProgressData = {
            partialImageUrl: `data:image/png;base64,${event.b64_json}`,
            partialImageIndex: event.partial_image_index,
            iteration,
          };
          emit(res, {
            type: 'image-progress',
            step: 'image-generation',
            timestamp: now(),
            data: progressData,
          });
        } else if (event.type === 'image_generation.completed') {
          finalB64 = event.b64_json;
        }
      }

      const generationDurationMs = Date.now() - genStart;

      if (!finalB64) {
        throw new Error('gpt-image-2 returned no image data');
      }

      imageOutput = {
        imageUrl: `data:image/png;base64,${finalB64}`,
        revisedPrompt,
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

    const artOutput: ArtDirectorOutput = await reviewImage(
      concept,
      style,
      promptOutput.refinedPrompt,
      imageOutput.revisedPrompt,
      iteration,
      lastImageUrl,
      referenceImageBase64
    );

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
