import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { AzureOpenAI } from 'openai';

// ─── Azure OpenAI Configuration ──────────────────────────────────────────────

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';

if (!AZURE_OPENAI_ENDPOINT) {
  throw new Error('AZURE_OPENAI_ENDPOINT environment variable is required');
}

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
