import type { RagRequest, RagEvent } from '../types';

/**
 * Run the RAG pipeline via SSE.
 * The backend streams RagEvent objects as server-sent events.
 */
export async function runRag(
  request: RagRequest,
  onEvent: (event: RagEvent) => void
): Promise<void> {
  const response = await fetch('/api/rag/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`RAG request failed (${response.status}): ${text}`);
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
          const event: RagEvent = JSON.parse(json);
          onEvent(event);
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  }
}
