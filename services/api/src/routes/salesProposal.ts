import { Router } from 'express';
import type { ProposalRequest } from '../types.js';
import { runProposalOrchestrator } from '../agents/proposalOrchestrator.js';

export const salesProposalRouter = Router();

/**
 * POST /api/sales-proposal/run
 * Starts the Sales Proposal Team workflow.
 * Response is streamed as Server-Sent Events (SSE).
 */
salesProposalRouter.post('/run', (req, res) => {
  const body = req.body as ProposalRequest;

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

  const request: ProposalRequest = {
    prompt: body.prompt.trim(),
    creativityLevel,
  };

  runProposalOrchestrator(request, res).catch((err) => {
    console.error('Sales Proposal error:', err);
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
