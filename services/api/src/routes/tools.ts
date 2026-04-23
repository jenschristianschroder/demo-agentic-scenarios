import { Router } from 'express';
import type { ToolRequest } from '../types.js';
import { runToolAgent } from '../agents/toolAgent.js';

export const toolsRouter = Router();

/**
 * POST /api/tools/run
 * Runs the tool-use agent with function calling.
 * Response is streamed as Server-Sent Events (SSE).
 */
toolsRouter.post('/run', (req, res) => {
  const body = req.body as ToolRequest;

  // ── Input validation ─────────────────────────────────────────────────
  if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  if (body.prompt.length > 2000) {
    res.status(400).json({ error: 'prompt must be 2000 characters or less' });
    return;
  }

  const creativityLevel = clamp(body.creativityLevel ?? 0.3, 0, 1);

  // ── Set up SSE headers ───────────────────────────────────────────────
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  runToolAgent(body.prompt.trim(), creativityLevel, res).catch((err) => {
    console.error('Tool agent error:', err);
    const errorEvent = JSON.stringify({
      type: 'error',
      step: 'reasoning',
      timestamp: new Date().toISOString(),
      data: { message: err instanceof Error ? err.message : 'Internal error' },
    });
    res.write(`data: ${errorEvent}\n\n`);
    res.write('data: [DONE]\n\n');
    res.end();
  });
});

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
