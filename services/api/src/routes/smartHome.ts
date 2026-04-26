import { Router } from 'express';
import type { SmartHomeRequest } from '../types.js';
import { runSmartHomeOrchestrator } from '../agents/smartHome/smartHomeOrchestrator.js';

export const smartHomeRouter = Router();

/**
 * POST /api/smart-home/run
 * Starts the Smart Home Bundle Builder workflow.
 * Response is streamed as Server-Sent Events (SSE).
 */
smartHomeRouter.post('/run', (req, res) => {
  const body = req.body as SmartHomeRequest;

  // ── Input validation ─────────────────────────────────────────────────
  if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  if (body.prompt.length > 2000) {
    res.status(400).json({ error: 'prompt must be 2000 characters or less' });
    return;
  }

  const creativityLevel = Math.min(1, Math.max(0, body.creativityLevel ?? 0.5));

  // ── Set up SSE headers ───────────────────────────────────────────────
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const request: SmartHomeRequest = {
    prompt: body.prompt.trim(),
    creativityLevel,
  };

  runSmartHomeOrchestrator(request, res).catch((err) => {
    console.error('Smart Home Bundle error:', err);
    const errorEvent = JSON.stringify({
      type: 'error',
      step: 'user-request',
      timestamp: new Date().toISOString(),
      data: { message: err instanceof Error ? err.message : 'Internal error' },
    });
    res.write(`data: ${errorEvent}\n\n`);
    res.end();
  });
});
