import { DefaultAzureCredential } from '@azure/identity';

// ─── Azure OpenAI Configuration ──────────────────────────────────────────────

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

if (!AZURE_OPENAI_ENDPOINT) {
  console.warn('AZURE_OPENAI_ENDPOINT not set — using mock agents');
}

// ─── Azure AI Search Configuration ───────────────────────────────────────────

const AZURE_SEARCH_ENDPOINT = process.env.AZURE_SEARCH_ENDPOINT;
const AZURE_SEARCH_INDEX = process.env.AZURE_SEARCH_INDEX || 'knowledge-base';

if (!AZURE_SEARCH_ENDPOINT) {
  console.warn('AZURE_SEARCH_ENDPOINT not set — using mock knowledge source');
}

// ─── Shared credential (Managed Identity / CLI fallback) ─────────────────────

const credential = new DefaultAzureCredential();

export function getOpenAIConfig() {
  return {
    endpoint: AZURE_OPENAI_ENDPOINT,
    deployment: AZURE_OPENAI_DEPLOYMENT,
    credential,
  };
}

export function getSearchConfig() {
  return {
    endpoint: AZURE_SEARCH_ENDPOINT,
    indexName: AZURE_SEARCH_INDEX,
    credential,
  };
}

/** Returns true if Azure services are configured and available */
export function isAzureConfigured(): boolean {
  return !!(AZURE_OPENAI_ENDPOINT && AZURE_SEARCH_ENDPOINT);
}
