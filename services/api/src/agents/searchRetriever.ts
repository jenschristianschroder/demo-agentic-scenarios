// ─── Knowledge Base Retriever ────────────────────────────────────────────────
// Queries Azure AI Search and returns relevant document chunks.
// Used by both the generator and fact-checker agents.

import { getSearchClient, isSearchConfigured } from '../azureClients.js';

export interface RetrievedDocument {
  content: string;
  source: string;
  title: string;
  score: number;
}

/**
 * Search the knowledge base for documents relevant to the query.
 * Returns empty array if AI Search is not configured.
 */
export async function retrieveDocuments(query: string, topK = 5): Promise<RetrievedDocument[]> {
  if (!isSearchConfigured()) {
    return [];
  }

  const client = getSearchClient();
  const results = await client.search(query, {
    top: topK,
    queryType: 'semantic',
    semanticSearchOptions: {
      configurationName: 'default',
    },
    select: ['content', 'source', 'title'],
  });

  const docs: RetrievedDocument[] = [];
  for await (const result of results.results) {
    docs.push({
      content: result.document.content,
      source: result.document.source,
      title: result.document.title,
      score: result.score ?? 0,
    });
  }
  return docs;
}

/**
 * Format retrieved documents as context for an LLM prompt.
 */
export function formatAsContext(docs: RetrievedDocument[]): string {
  if (docs.length === 0) return '';
  return `\nKnowledge base documents:\n---\n${docs.map((d, i) => `[${i + 1}] (Source: ${d.source}) ${d.content}`).join('\n\n')}\n---`;
}
