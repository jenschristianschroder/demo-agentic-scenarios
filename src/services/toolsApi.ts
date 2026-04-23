import type { ToolRequest, ToolEvent } from '../types';

/**
 * Run the tool-use agent via SSE.
 * The backend streams ToolEvent objects as server-sent events.
 */
export async function runToolAgent(
  request: ToolRequest,
  onEvent: (event: ToolEvent) => void
): Promise<void> {
  const response = await fetch('/api/tools/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Tool agent request failed (${response.status}): ${text}`);
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
          const event: ToolEvent = JSON.parse(json);
          onEvent(event);
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  }
}
