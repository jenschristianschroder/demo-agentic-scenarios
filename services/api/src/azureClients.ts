import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { SearchClient } from '@azure/search-documents';
import { AzureOpenAI } from 'openai';

// ─── Azure OpenAI Configuration ──────────────────────────────────────────────

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

if (!AZURE_OPENAI_ENDPOINT) {
  throw new Error('AZURE_OPENAI_ENDPOINT environment variable is required');
}

// ─── Azure AI Search Configuration ───────────────────────────────────────────

const AZURE_SEARCH_ENDPOINT = process.env.AZURE_SEARCH_ENDPOINT;
const AZURE_SEARCH_INDEX = process.env.AZURE_SEARCH_INDEX || 'knowledge-base';

// ─── Shared credential (Managed Identity / CLI fallback) ─────────────────────

const credential = new DefaultAzureCredential();
const scope = 'https://cognitiveservices.azure.com/.default';
const azureADTokenProvider = getBearerTokenProvider(credential, scope);

// ─── Singleton OpenAI client ─────────────────────────────────────────────────

let openaiClient: AzureOpenAI | undefined;

export function getOpenAIClient(): AzureOpenAI {
  if (!openaiClient) {
    openaiClient = new AzureOpenAI({
      azureADTokenProvider,
      endpoint: AZURE_OPENAI_ENDPOINT,
      deployment: AZURE_OPENAI_DEPLOYMENT,
      apiVersion: '2024-12-01-preview',
    });
  }
  return openaiClient;
}

// ─── Singleton Search client ─────────────────────────────────────────────────

export interface SearchDocument {
  id: string;
  content: string;
  title: string;
  source: string;
}

let searchClient: SearchClient<SearchDocument> | undefined;

export function getSearchClient(): SearchClient<SearchDocument> {
  if (!searchClient) {
    if (!AZURE_SEARCH_ENDPOINT) {
      throw new Error('AZURE_SEARCH_ENDPOINT environment variable is required');
    }
    searchClient = new SearchClient<SearchDocument>(
      AZURE_SEARCH_ENDPOINT,
      AZURE_SEARCH_INDEX,
      credential
    );
  }
  return searchClient;
}

export function isSearchConfigured(): boolean {
  return !!AZURE_SEARCH_ENDPOINT;
}
