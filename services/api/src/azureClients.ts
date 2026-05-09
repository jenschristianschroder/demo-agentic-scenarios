import { DefaultAzureCredential, getBearerTokenProvider } from '@azure/identity';
import { SearchClient } from '@azure/search-documents';
import { AzureOpenAI } from 'openai';

// ─── Azure OpenAI Configuration ──────────────────────────────────────────────

const AZURE_OPENAI_ENDPOINT = process.env.AZURE_OPENAI_ENDPOINT;
const AZURE_OPENAI_DEPLOYMENT = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
const AZURE_OPENAI_REASONING_DEPLOYMENT = process.env.AZURE_OPENAI_REASONING_DEPLOYMENT;
const AZURE_OPENAI_MODEL_ROUTER_DEPLOYMENT = process.env.AZURE_OPENAI_MODEL_ROUTER_DEPLOYMENT || 'model-router';
const AZURE_OPENAI_IMAGE_DEPLOYMENT = process.env.AZURE_OPENAI_IMAGE_DEPLOYMENT || 'gpt-image-2';
const AZURE_AI_FOUNDRY_IMAGE_DEPLOYMENT = process.env.AZURE_AI_FOUNDRY_IMAGE_DEPLOYMENT || 'MAI-Image-2e';

// Strip trailing path segments like /openai/v1 that some Azure portal UIs include
// in the endpoint URL — the AzureOpenAI SDK appends its own /openai/… paths.
const AZURE_AI_FOUNDRY_ENDPOINT = process.env.AZURE_AI_FOUNDRY_ENDPOINT
  ? process.env.AZURE_AI_FOUNDRY_ENDPOINT.replace(/\/openai(?:\/.*)?$/, '')
  : undefined;

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

// ─── Singleton reasoning client (Responses API, GPT-5 / o-series) ────────────

let reasoningClient: AzureOpenAI | undefined;

/**
 * Returns the Azure OpenAI client configured for the reasoning model deployment.
 * Uses the Responses API (2025-04-01-preview) and the AZURE_OPENAI_REASONING_DEPLOYMENT
 * environment variable. Returns undefined when no reasoning deployment is configured.
 */
export function getReasoningClient(): AzureOpenAI | undefined {
  if (!AZURE_OPENAI_REASONING_DEPLOYMENT) return undefined;
  if (!reasoningClient) {
    reasoningClient = new AzureOpenAI({
      azureADTokenProvider,
      endpoint: AZURE_OPENAI_ENDPOINT,
      deployment: AZURE_OPENAI_REASONING_DEPLOYMENT,
      apiVersion: '2025-04-01-preview',
    });
  }
  return reasoningClient;
}

export function getReasoningDeployment(): string | undefined {
  return AZURE_OPENAI_REASONING_DEPLOYMENT;
}

// ─── Singleton Model Router client ───────────────────────────────────────────

let modelRouterClient: AzureOpenAI | undefined;

/**
 * Returns the Azure OpenAI client configured for the model-router deployment.
 * The model router intelligently routes prompts to the best-suited model based
 * on the routing mode (balanced, quality, cost).
 */
export function getModelRouterClient(): AzureOpenAI {
  if (!modelRouterClient) {
    modelRouterClient = new AzureOpenAI({
      azureADTokenProvider,
      endpoint: AZURE_OPENAI_ENDPOINT,
      deployment: AZURE_OPENAI_MODEL_ROUTER_DEPLOYMENT,
      apiVersion: '2024-12-01-preview',
    });
  }
  return modelRouterClient;
}

export function getModelRouterDeployment(): string {
  return AZURE_OPENAI_MODEL_ROUTER_DEPLOYMENT;
}

export function isModelRouterConfigured(): boolean {
  return !!AZURE_OPENAI_MODEL_ROUTER_DEPLOYMENT;
}

// ─── Singleton image generation client ────────────────────────────────────────

let imageClient: AzureOpenAI | undefined;

/**
 * Returns the Azure OpenAI client configured for the gpt-image-2 image generation deployment.
 * Uses the AZURE_OPENAI_IMAGE_DEPLOYMENT environment variable (default: 'gpt-image-2').
 */
export function getImageClient(): AzureOpenAI {
  if (!imageClient) {
    console.log('[AzureClients] Creating gpt-image-2 client — endpoint:', AZURE_OPENAI_ENDPOINT, '— deployment:', AZURE_OPENAI_IMAGE_DEPLOYMENT, '— apiVersion: 2025-04-01-preview');
    imageClient = new AzureOpenAI({
      azureADTokenProvider,
      endpoint: AZURE_OPENAI_ENDPOINT,
      deployment: AZURE_OPENAI_IMAGE_DEPLOYMENT,
      apiVersion: '2025-04-01-preview',
    });
  }
  return imageClient;
}

export function getImageDeployment(): string {
  return AZURE_OPENAI_IMAGE_DEPLOYMENT;
}

export function isImageConfigured(): boolean {
  return !!AZURE_OPENAI_ENDPOINT;
}

// ─── Singleton MAI-Image-2e client (via Azure AI Foundry) ─────────────────────

let foundryImageClient: AzureOpenAI | undefined;

/**
 * Returns the Azure OpenAI client configured for the MAI-Image-2e deployment
 * via Azure AI Foundry. Uses the AZURE_AI_FOUNDRY_ENDPOINT and
 * AZURE_AI_FOUNDRY_IMAGE_DEPLOYMENT environment variables.
 * Returns undefined when no foundry endpoint is configured.
 */
export function getFoundryImageClient(): AzureOpenAI | undefined {
  if (!AZURE_AI_FOUNDRY_ENDPOINT) {
    console.warn('[AzureClients] getFoundryImageClient() — AZURE_AI_FOUNDRY_ENDPOINT is not set, returning undefined');
    return undefined;
  }
  if (!foundryImageClient) {
    console.log('[AzureClients] Creating MAI-Image-2e foundry client — endpoint:', AZURE_AI_FOUNDRY_ENDPOINT, '— deployment:', AZURE_AI_FOUNDRY_IMAGE_DEPLOYMENT, '— apiVersion: 2025-04-01-preview');
    foundryImageClient = new AzureOpenAI({
      azureADTokenProvider,
      endpoint: AZURE_AI_FOUNDRY_ENDPOINT,
      deployment: AZURE_AI_FOUNDRY_IMAGE_DEPLOYMENT,
      apiVersion: '2025-04-01-preview',
    });
  }
  return foundryImageClient;
}

export function getFoundryImageDeployment(): string {
  return AZURE_AI_FOUNDRY_IMAGE_DEPLOYMENT;
}

export function isFoundryImageConfigured(): boolean {
  return !!AZURE_AI_FOUNDRY_ENDPOINT;
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
