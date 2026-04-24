import type { ProposalRequest, ProposalEvent } from '../types';

/**
 * Run the Sales Proposal Team workflow via SSE.
 * The backend streams ProposalEvent objects as server-sent events.
 */
export async function runSalesProposal(
  request: ProposalRequest,
  onEvent: (event: ProposalEvent) => void
): Promise<void> {
  const response = await fetch('/api/sales-proposal/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Sales Proposal request failed (${response.status}): ${text}`);
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
          const event: ProposalEvent = JSON.parse(json);
          onEvent(event);
        } catch {
          // Skip malformed SSE lines
        }
      }
    }
  }
}
