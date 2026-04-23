import { Router } from 'express';
import type { RagRequest, RagEvent, RetrievalResult } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';
import { retrieveDocuments, formatAsContext } from '../agents/searchRetriever.js';

export const ragRouter = Router();

function emit(res: any, event: RagEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

/**
 * POST /api/rag/run
 * Runs the RAG pipeline with optional retrieval.
 * Response is streamed as Server-Sent Events (SSE).
 */
ragRouter.post('/run', (req, res) => {
  const body = req.body as RagRequest;

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
  const ragEnabled = body.ragEnabled !== false;
  const prompt = body.prompt.trim();

  // ── Set up SSE headers ───────────────────────────────────────────────
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  runRagPipeline(prompt, ragEnabled, creativityLevel, res).catch((err) => {
    console.error('RAG pipeline error:', err);
    emit(res, {
      type: 'error',
      step: 'generation',
      timestamp: new Date().toISOString(),
      data: { message: err instanceof Error ? err.message : 'Internal error' },
    });
    res.write('data: [DONE]\n\n');
    res.end();
  });
});

async function runRagPipeline(
  prompt: string,
  ragEnabled: boolean,
  creativityLevel: number,
  res: any
): Promise<void> {
  const ts = () => new Date().toISOString();

  // ── Step 1: User Request ─────────────────────────────────────────────
  emit(res, { type: 'step-start', step: 'user-request', timestamp: ts(), data: { prompt } });
  emit(res, { type: 'step-complete', step: 'user-request', timestamp: ts(), data: { prompt } });

  // ── Step 2: Retrieval (only when RAG enabled) ────────────────────────
  let retrievedDocs: RetrievalResult[] = [];

  if (ragEnabled) {
    emit(res, { type: 'step-start', step: 'retrieval', timestamp: ts(), data: null });

    retrievedDocs = await retrieveDocuments(prompt, 5);

    emit(res, { type: 'step-complete', step: 'retrieval', timestamp: ts(), data: retrievedDocs });
  }

  // ── Step 3: Generation ───────────────────────────────────────────────
  emit(res, { type: 'step-start', step: 'generation', timestamp: ts(), data: null });

  const contextBlock = ragEnabled ? formatAsContext(retrievedDocs) : '';

  const systemPrompt = ragEnabled
    ? `You are a helpful assistant. Answer the user's question using ONLY the provided knowledge base documents. If the information is not in the documents, say so clearly. Cite which document you used.\n${contextBlock}`
    : `You are a helpful assistant. Answer the user's question using your general knowledge.`;

  const client = getOpenAIClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

  const completion = await client.chat.completions.create({
    model: deployment,
    temperature: creativityLevel,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
  });

  const responseText = completion.choices[0]?.message?.content ?? '';

  emit(res, { type: 'step-complete', step: 'generation', timestamp: ts(), data: { text: responseText } });

  // ── Step 4: Final Answer ─────────────────────────────────────────────
  emit(res, { type: 'step-start', step: 'final-answer', timestamp: ts(), data: null });
  emit(res, { type: 'step-complete', step: 'final-answer', timestamp: ts(), data: { text: responseText } });

  res.write('data: [DONE]\n\n');
  res.end();
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
