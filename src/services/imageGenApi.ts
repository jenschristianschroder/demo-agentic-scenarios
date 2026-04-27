import type { ImageGenRequest, ImageGenEvent } from '../types';

/**
 * Run the AI Creative Studio image generation pipeline via SSE.
 * The backend streams ImageGenEvent objects as server-sent events.
 */
export async function runImageGen(
  request: ImageGenRequest,
  onEvent: (event: ImageGenEvent) => void
): Promise<void> {
  console.debug('[ImageGen:SSE] Starting image generation request', {
    concept: request.concept.slice(0, 80),
    style: request.style,
    size: request.size,
    quality: request.quality,
    artDirectorEnabled: request.artDirectorEnabled,
    maxRevisions: request.maxRevisions,
    hasReferenceImage: !!request.referenceImageBase64,
  });

  const response = await fetch('/api/image-gen/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    console.error('[ImageGen:SSE] Request failed', response.status, text);
    throw new Error(`Image generation request failed (${response.status}): ${text}`);
  }

  console.debug('[ImageGen:SSE] SSE connection established');

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';
  let eventCount = 0;
  let receivedDone = false;
  let receivedRunComplete = false;
  let receivedError = false;

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      console.debug('[ImageGen:SSE] Stream ended, total events received:', eventCount);
      break;
    }

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        const json = trimmed.slice(6);
        if (json === '[DONE]') {
          console.debug('[ImageGen:SSE] Received [DONE] signal, total events:', eventCount);
          receivedDone = true;
          return;
        }
        try {
          const event: ImageGenEvent = JSON.parse(json);
          eventCount++;
          console.debug(`[ImageGen:SSE] Event #${eventCount}:`, event.type, event.step, event.timestamp);
          if (event.type === 'run-complete') receivedRunComplete = true;
          if (event.type === 'error') receivedError = true;
          onEvent(event);
        } catch {
          console.warn('[ImageGen:SSE] Skipping malformed SSE line (length:', trimmed.length, ')');
        }
      }
    }
  }

  // Stream ended without [DONE] signal — detect premature termination.
  // A well-formed pipeline always sends either a run-complete event, an error
  // event, or a [DONE] sentinel. If none were received the connection was lost.
  if (!receivedDone && !receivedRunComplete && !receivedError) {
    console.error('[ImageGen:SSE] Stream ended prematurely without completion or error signal');
    onEvent({
      type: 'error',
      step: 'image-generation',
      timestamp: new Date().toISOString(),
      data: { message: 'Connection to server lost — the image generation pipeline was interrupted. Please try again.' },
    });
  }
}
