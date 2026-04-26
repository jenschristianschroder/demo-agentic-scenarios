import { Router } from 'express';
import type { SpotifyRequest } from '../types.js';
import { runSpotifyAgent } from '../agents/spotifyAgent.js';

export const spotifyRouter = Router();

/**
 * POST /api/spotify/run
 * Runs the Spotify playlist agent with function calling.
 * Requires a valid Spotify access token from the frontend (PKCE flow).
 * Response is streamed as Server-Sent Events (SSE).
 */
spotifyRouter.post('/run', (req, res) => {
  const body = req.body as SpotifyRequest;

  // ── Input validation ─────────────────────────────────────────────────
  if (!body.prompt || typeof body.prompt !== 'string' || body.prompt.trim().length === 0) {
    res.status(400).json({ error: 'prompt is required' });
    return;
  }

  if (body.prompt.length > 2000) {
    res.status(400).json({ error: 'prompt must be 2000 characters or less' });
    return;
  }

  if (!body.accessToken || typeof body.accessToken !== 'string' || body.accessToken.trim().length === 0) {
    res.status(401).json({ error: 'accessToken is required — connect to Spotify first' });
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

  runSpotifyAgent(body.prompt.trim(), creativityLevel, body.accessToken.trim(), res).catch((err) => {
    console.error('Spotify agent error:', err);
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
