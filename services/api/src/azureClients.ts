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

// Normalise the AI Foundry endpoint to a base resource URL.
// Accepted formats:
//   https://<resource>.services.ai.azure.com
//   https://<resource>.services.ai.azure.com/api/projects/<project>
//   https://<resource>.services.ai.azure.com/openai/v1
// We strip /openai/… and /api/projects/… suffixes so that we can append
// model-specific paths such as /mai/v1/images/generations at call time.
const AZURE_AI_FOUNDRY_ENDPOINT = process.env.AZURE_AI_FOUNDRY_ENDPOINT
  ? process.env.AZURE_AI_FOUNDRY_ENDPOINT
      .replace(/\/openai(?:\/.*)?$/, '')
      .replace(/\/api\/projects(?:\/.*)?$/, '')
      .replace(/\/+$/, '')
  : undefined;

// ─── Startup diagnostics ─────────────────────────────────────────────────────

const mask = (val: string | undefined) =>
  val ? `${val.slice(0, 40)}…(${val.length} chars)` : '<NOT SET>';

console.log('[AzureClients] ── Startup environment check ──');
console.log('[AzureClients]   AZURE_OPENAI_ENDPOINT:', mask(process.env.AZURE_OPENAI_ENDPOINT));
console.log('[AzureClients]   AZURE_OPENAI_IMAGE_DEPLOYMENT:', AZURE_OPENAI_IMAGE_DEPLOYMENT);
console.log('[AzureClients]   AZURE_AI_FOUNDRY_ENDPOINT (raw):', mask(process.env.AZURE_AI_FOUNDRY_ENDPOINT));
console.log('[AzureClients]   AZURE_AI_FOUNDRY_ENDPOINT (normalised):', mask(AZURE_AI_FOUNDRY_ENDPOINT));
console.log('[AzureClients]   AZURE_AI_FOUNDRY_IMAGE_DEPLOYMENT:', AZURE_AI_FOUNDRY_IMAGE_DEPLOYMENT);

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

// ─── MAI-Image-2e via Azure AI Foundry (direct REST) ──────────────────────────
// MAI-Image-2e uses the /mai/v1/images/generations endpoint, NOT /openai/…,
// so we cannot use the AzureOpenAI SDK (which auto-appends /openai/deployments/…).
// Instead we issue a direct fetch() with a bearer token from DefaultAzureCredential.

/** Response shape returned by the MAI images/generations REST endpoint. */
export interface FoundryImageResponse {
  data: { b64_json?: string; url?: string; revised_prompt?: string }[];
}

/**
 * Call the MAI-Image-2e model via the Azure AI Foundry REST endpoint.
 * URL: POST {AZURE_AI_FOUNDRY_ENDPOINT}/mai/v1/images/generations
 *
 * Per the official docs the MAI image generation API accepts only:
 *   model, prompt, width, height
 * Output is always PNG in b64_json format. The `n`, `size`, `quality`,
 * and `response_format` parameters are NOT supported.
 *
 * Dimension constraints:
 *   - Both width and height must be ≥ 768
 *   - width × height must not exceed 1,048,576 (equivalent to 1024×1024)
 */
export async function generateFoundryImage(opts: {
  prompt: string;
  width?: number;
  height?: number;
  signal?: AbortSignal;
}): Promise<FoundryImageResponse> {
  if (!AZURE_AI_FOUNDRY_ENDPOINT) {
    throw new Error('MAI-Image-2e is not configured — set AZURE_AI_FOUNDRY_ENDPOINT');
  }

  const url = `${AZURE_AI_FOUNDRY_ENDPOINT}/mai/v1/images/generations`;

  // Acquire a bearer token using the same credential used elsewhere
  const token = await credential.getToken(scope);
  if (!token) {
    throw new Error('Failed to acquire Azure credential token for MAI-Image-2e');
  }

  const width = opts.width ?? 1024;
  const height = opts.height ?? 1024;

  const body: Record<string, unknown> = {
    model: AZURE_AI_FOUNDRY_IMAGE_DEPLOYMENT,
    prompt: opts.prompt,
    width,
    height,
  };

  console.log('[AzureClients] MAI-Image-2e REST call —', url, '— model:', AZURE_AI_FOUNDRY_IMAGE_DEPLOYMENT, '— dimensions:', `${width}x${height}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token.token}`,
    },
    body: JSON.stringify(body),
    signal: opts.signal,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error('[AzureClients] MAI-Image-2e REST error:', response.status, text.slice(0, 500));
    throw new Error(`MAI-Image-2e generation failed (HTTP ${response.status}): ${text.slice(0, 300)}`);
  }

  const json = (await response.json()) as FoundryImageResponse;
  console.log('[AzureClients] MAI-Image-2e REST success — images returned:', json.data?.length ?? 0);
  return json;
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
