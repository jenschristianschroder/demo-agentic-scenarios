import { Router } from 'express';
import type { OrchestrationRequest } from '../types.js';
import { runOrchestrator, runRagFailureOrchestrator } from '../agents/orchestrator.js';

export const orchestrationRouter = Router();

/**
 * POST /api/orchestration/run
 * Starts the multi-agent orchestration workflow.
 * Response is streamed as Server-Sent Events (SSE).
 */
orchestrationRouter.post('/run', (req, res) => {
  const body = req.body as OrchestrationRequest;

  // ── Input validation ─────────────────────────────────────────────────
  if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  if (body.prompt.length > 2000) {
    res.status(400).json({ error: 'prompt must be 2000 characters or less' });
    return;
  }

  const creativityLevel = clamp(body.creativityLevel ?? 0.7, 0, 1);
  const acceptanceThreshold = clamp(body.acceptanceThreshold ?? 0.8, 0, 1);
  const maxIterations = clamp(Math.round(body.maxIterations ?? 3), 1, 10);
  const workflowMode = body.workflowMode === 'auto-revise' ? 'auto-revise' : 'review-after-first';
  const generatorKnowledgeSource = body.generatorKnowledgeSource !== false;
  const scenario = body.scenario === 'rag-failure-recovery' ? 'rag-failure-recovery' : 'default';

  // ── Set up SSE headers ───────────────────────────────────────────────
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const request: OrchestrationRequest = {
    prompt: body.prompt.trim(),
    creativityLevel,
    workflowMode,
    acceptanceThreshold,
    maxIterations,
    generatorKnowledgeSource,
    scenario,
  };

  // Choose orchestrator based on scenario
  const orchestrate = scenario === 'rag-failure-recovery'
    ? runRagFailureOrchestrator
    : runOrchestrator;

  // Run the orchestrator — it writes SSE events directly to the response
  orchestrate(request, res).catch((err) => {
    console.error('Orchestration error:', err);
    const errorEvent = JSON.stringify({
      type: 'error',
      step: 'orchestrator',
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
