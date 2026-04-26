import { Router } from 'express';
import type { ModelRouterRequest, ModelRouterEvent, ModelRouterResult, ModelRouterRoutingMode } from '../types.js';
import { getModelRouterClient, getModelRouterDeployment } from '../azureClients.js';

export const modelRouterRouter = Router();

const VALID_ROUTING_MODES: ModelRouterRoutingMode[] = ['balanced', 'quality', 'cost'];

function emit(res: any, event: ModelRouterEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * POST /api/model-router/run
 * Runs a single prompt through the model router with the specified routing mode.
 * Response is streamed as Server-Sent Events (SSE).
 */
modelRouterRouter.post('/run', (req, res) => {
  const body = req.body as ModelRouterRequest;

  // ── Input validation ─────────────────────────────────────────────────
  if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  if (body.prompt.length > 2000) {
    res.status(400).json({ error: 'prompt must be 2000 characters or less' });
    return;
  }

  if (!body.routingMode || !VALID_ROUTING_MODES.includes(body.routingMode)) {
    res.status(400).json({ error: 'routingMode must be one of: balanced, quality, cost' });
    return;
  }

  const creativityLevel = clamp(body.creativityLevel ?? 0.7, 0, 1);
  const prompt = body.prompt.trim();
  const routingMode = body.routingMode;

  // ── Set up SSE headers ───────────────────────────────────────────────
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  runModelRouter(prompt, routingMode, creativityLevel, res).catch((err) => {
    console.error('Model router error:', err);
    emit(res, {
      type: 'error',
      step: 'routing',
      timestamp: new Date().toISOString(),
      data: { message: err instanceof Error ? err.message : 'Internal error' },
    });
    res.write('data: [DONE]\n\n');
    res.end();
  });
});

async function runModelRouter(
  prompt: string,
  routingMode: ModelRouterRoutingMode,
  creativityLevel: number,
  res: any
): Promise<void> {
  const ts = () => new Date().toISOString();

  // ── Step 1: User Request ─────────────────────────────────────────────
  emit(res, { type: 'step-start', step: 'user-request', timestamp: ts(), data: { prompt } });
  emit(res, { type: 'step-complete', step: 'user-request', timestamp: ts(), data: { prompt } });

  // ── Step 2: Routing ──────────────────────────────────────────────────
  emit(res, { type: 'step-start', step: 'routing', timestamp: ts(), data: null });

  const startTime = Date.now();

  const client = getModelRouterClient();
  const deployment = getModelRouterDeployment();

  const systemPrompt = buildSystemPrompt(routingMode);

  const completion = await client.chat.completions.create({
    model: deployment,
    temperature: creativityLevel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
  });

  const latencyMs = Date.now() - startTime;
  const responseText = completion.choices[0]?.message?.content ?? '';
  const modelUsed = completion.model || deployment;
  const promptTokens = completion.usage?.prompt_tokens ?? 0;
  const completionTokens = completion.usage?.completion_tokens ?? 0;

  const result: ModelRouterResult = {
    routingMode,
    modelUsed,
    responseText,
    latencyMs,
    promptTokens,
    completionTokens,
  };

  emit(res, { type: 'step-complete', step: 'routing', timestamp: ts(), data: result });

  // ── Step 3: Result ───────────────────────────────────────────────────
  emit(res, { type: 'step-start', step: 'result', timestamp: ts(), data: null });
  emit(res, { type: 'step-complete', step: 'result', timestamp: ts(), data: result });

  res.write('data: [DONE]\n\n');
  res.end();
}

function buildSystemPrompt(routingMode: ModelRouterRoutingMode): string {
  switch (routingMode) {
    case 'quality':
      return 'You are a helpful assistant. Provide the most thorough and accurate answer possible.';
    case 'cost':
      return 'You are a helpful assistant. Provide a concise and accurate answer.';
    case 'balanced':
    default:
      return 'You are a helpful assistant. Provide a clear and accurate answer.';
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
