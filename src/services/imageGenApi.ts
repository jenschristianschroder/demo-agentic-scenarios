import type { ImageGenRequest, ImageGenEvent } from '../types';

/**
 * Run the AI Creative Studio image generation pipeline via SSE.
 * The backend streams ImageGenEvent objects as server-sent events.
 */
export async function runImageGen(
  request: ImageGenRequest,
  onEvent: (event: ImageGenEvent) => void
): Promise<void> {
  const response = await fetch('/api/image-gen/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Image generation request failed (${response.status}): ${text}`);
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error('No response body');

  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('data: ')) {
        const json = trimmed.slice(6);
        if (json === '[DONE]') return;
        try {
          const event: ImageGenEvent = JSON.parse(json);
          onEvent(event);
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  }
}
