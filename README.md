# Agentic AI Demo Scenarios

A demo application showcasing multiple agentic AI patterns on Azure — from simple RAG pipelines to multi-agent orchestration with revision loops, tool-use agents, and creative AI workflows.

## Demo Scenarios

| # | Scenario | Description |
|---|----------|-------------|
| 1 | [RAG Pipeline](#rag-pipeline) | Toggle retrieval on/off to compare grounded vs. ungrounded LLM responses |
| 2 | [Tool-Use Agent](#tool-use-agent) | Watch the model decide which tools to call in real time |
| 3 | [Multi-Agent Orchestration](#multi-agent-orchestration) | Orchestrator coordinates Generator and Fact-Checker agents in an iterative loop |
| 4 | [RAG Failure & Recovery](#rag-failure--recovery) | Detect hallucinated claims, retrieve real facts, and auto-revise until grounded |
| 5 | [Sales Proposal Team](#sales-proposal-team) | Specialized agents collaborate to build a business proposal |
| 6 | [Smart Home Bundle Builder](#smart-home-bundle-builder) | Agents recommend devices, review privacy, check compatibility, and assemble a bundle |
| 7 | [Spotify Playlist Agent](#spotify-playlist-agent) | AI agent connects to Spotify to search tracks, create playlists, and manage your library |
| 8 | [Model Router](#model-router) | Compare routing modes — balanced, quality, and cost — side by side |
| 9 | [AI Creative Studio](#ai-creative-studio) | Prompt engineer + image generation + art director review in an agentic loop |

## Architecture

```
┌─────────────┐     ┌──────────────────────────────────────────┐
│   React SPA  │────▶│              Express API                 │
│  (Vite/TS)  │ SSE │                                          │
│  port 3000  │◀────│  ┌──────────┐  ┌─────────┐  ┌─────────┐ │
└─────────────┘     │  │Orchestr. │─▶│Generator│─▶│Fact-Chk │ │
                    │  │  Agent   │◀─│  Agent  │◀─│  Agent  │ │
                    │  └──────────┘  └─────────┘  └─────────┘ │
                    │       │              │            │       │
                    │       ▼              ▼            ▼       │
                    │  Azure OpenAI   Azure OpenAI  AI Search  │
                    │                                          │
                    │              port 3001                    │
                    └──────────────────────────────────────────┘
```

## Project Structure

```
├── src/                      # React SPA (Vite + TypeScript)
│   ├── pages/                # WelcomeScreen, DemoScreen
│   ├── pages/components/     # Controls, OrchestrationView, StepDetail, RunSummary
│   ├── services/             # API client (SSE consumer)
│   └── types.ts              # Shared orchestration contracts
├── services/api/             # Express backend (TypeScript)
│   └── src/
│       ├── agents/           # Orchestrator, Generator, FactChecker
│       ├── routes/           # /api/orchestration, /health
│       └── azureClients.ts   # Azure credential/config helpers
├── infra/                    # Azure IaC (Bicep)
│   ├── main.bicep            # Main deployment
│   └── modules/              # ACR, ACA, OpenAI, Search, Identity
├── Dockerfile                # SPA container (nginx)
├── docker-compose.yml        # Local multi-container setup
└── nginx.conf                # Reverse proxy config
```

## Local Development

### Prerequisites

- Node.js 20+
- npm

### Quick Start (mock agents, no Azure)

```bash
# Terminal 1: Start the API
cd services/api
npm install
npm run dev

# Terminal 2: Start the SPA
npm install
npm run dev
```

Open http://localhost:3000

The app runs with **mock agents** by default — no Azure credentials required for local development.

### With Azure Services

1. Copy `.env.example` to `.env` and fill in your Azure resource values
2. Ensure you're logged in via `az login`
3. Start the API with the environment variables loaded

### Docker Compose

```bash
docker-compose up --build
```

Open http://localhost:3000

## Azure Deployment

### Infrastructure

```bash
az group create -n rg-multi-agent-demo -l northeurope

az deployment group create \
  -g rg-multi-agent-demo \
  -f infra/main.bicep \
  -p imageTag=latest
```

### Build & Push Images

```bash
ACR=$(az deployment group show -g rg-multi-agent-demo -n main --query properties.outputs.acrLoginServer.value -o tsv)
az acr login --name $ACR

docker build -t $ACR/multi-agent-api:latest ./services/api
docker push $ACR/multi-agent-api:latest

docker build -t $ACR/multi-agent-spa:latest .
docker push $ACR/multi-agent-spa:latest
```

---

## Scenario Details

### RAG Pipeline

Demonstrates Retrieval-Augmented Generation by grounding LLM responses with real documents. Users ask questions about a product knowledge base and can toggle RAG on/off to compare responses with and without retrieval.

**Pipeline:** User Query → Document Retrieval → Generation → Response

| Control | Description |
|---------|-------------|
| **Creativity** | 0 = precise, 1 = creative |
| **RAG toggle** | Compare responses with and without retrieval |

**Requires:** `AZURE_SEARCH_ENDPOINT` and `AZURE_SEARCH_INDEX` for retrieval.

---

### Tool-Use Agent

Showcases Azure OpenAI function calling. The agent autonomously decides which tools to invoke based on the user's query, and tool calls are displayed in real time.

**Available tools:**

| Tool | Purpose |
|------|---------|
| `search_knowledge_base` | Semantic search across documents |
| `get_product_details` | Fetch specific product specifications |
| `compare_products` | Side-by-side product comparison |
| `calculate_price` | Multi-currency pricing (DKK, EUR, USD, GBP, SEK, NOK) |
| `get_warranty_info` | Warranty and support data |

---

### Multi-Agent Orchestration

An **Orchestrator** coordinates a **Generator** and **Fact-Checker** agent in a sequential workflow with an optional revision loop.

| Mode | Behavior |
|------|----------|
| **Review after first** | Run one generate → fact-check pass, show results |
| **Auto-revise** | Loop generate → fact-check until score ≥ threshold or max iterations |

| Control | Description |
|---------|-------------|
| **Creativity** | 0 = precise, 1 = creative (more hallucinations) |
| **Workflow Mode** | Review after first pass or auto-revise loop |
| **Threshold** | Minimum fact-check score to approve (0–1) |
| **Max Iterations** | Maximum revision loops (1–5) |

---

### RAG Failure & Recovery

Demonstrates quality assurance through an agentic loop. A Generator creates content, a Fact-Checker validates claims against the knowledge base, and a Revision Agent automatically fixes problems — repeating until the content passes or max iterations are reached.

**Pipeline:** User Request → Generator → Fact-Checker → Revision Agent → Orchestrator (approve / loop)

**Requires:** `AZURE_SEARCH_ENDPOINT` and `AZURE_SEARCH_INDEX` for fact-checking against the knowledge base.

---

### Sales Proposal Team

Simulates a sales team where specialized agents collaborate to build a customized business proposal. The user submits a customer request (e.g., "25 laptops for field sales, under DKK 300,000") and the system orchestrates agents through a structured pipeline.

**Pipeline:** Customer Intake → Product Search → Pricing → Support Check → Proposal Writing

**Agents:**

| Agent | Role |
|-------|------|
| Customer Intake | Parses requirements — quantity, budget, use case, priorities |
| Product Specialist | Finds matching products with fit scores |
| Pricing Agent | Calculates total cost in target currency |
| Support Agent | Assesses warranty and support fit |
| Proposal Writer | Synthesizes a professional markdown proposal |

---

### Smart Home Bundle Builder

Builds customized smart home bundles considering technical requirements, privacy concerns, and device compatibility. Agents analyze needs, recommend devices, evaluate privacy implications, check compatibility, and assemble a final bundle with setup instructions and pricing.

**Pipeline:** User Request → Needs Analysis → Device Recommendation → Privacy Review → Compatibility Check → Bundle Assembly

**Agents:**

| Agent | Role |
|-------|------|
| Needs Agent | Analyzes smart home requirements |
| Device Agent | Recommends compatible devices |
| Privacy Agent | Evaluates privacy features (cameras, mics, local processing) |
| Compatibility Agent | Checks protocol and connectivity compatibility |
| Bundle Agent | Assembles final bundle with pricing and setup plan |

---

### Spotify Playlist Agent

An AI agent that connects to your Spotify account to search tracks, create playlists, and manage your music library. Requires a Spotify Developer application configured with the PKCE OAuth flow.

#### Required OAuth Scopes

| Scope | Purpose |
|-------|---------|
| `user-read-private` | Read user profile |
| `user-read-email` | Read user email |
| `playlist-read-private` | List existing playlists |
| `playlist-modify-public` | Create and edit public playlists |
| `playlist-modify-private` | Create and edit private playlists |

#### Spotify Developer Dashboard — Development Mode

If your Spotify app is in **Development Mode** (the default for new apps), Spotify restricts API write access to explicitly approved users only. **All users who will use this demo must be added under Settings → User Management** in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

Without this, write operations such as creating playlists will silently fail with a **403 Forbidden** error even though the OAuth flow completes successfully and read operations (search, profile) appear to work.

Steps to add a user:
1. Open your app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Go to **Settings → User Management**.
3. Add the Spotify account email address of each user who needs access.
4. Ask the user to **Disconnect and Reconnect** to Spotify in the demo to obtain a fresh token.

To remove the user limit, submit your app for a [Quota Extension](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) via the Developer Dashboard.

#### February 2026 Spotify API Changes

Spotify's [February 2026 Web API migration](https://developer.spotify.com/documentation/web-api/tutorials/february-2026-migration-guide) introduced breaking changes that this app has been updated for:

| Change | Impact | Status |
|--------|--------|--------|
| `POST /users/{id}/playlists` removed | Playlist creation now uses `POST /me/playlists` | ✅ Migrated |
| `GET /recommendations` removed (Dev Mode) | Recommendations endpoint is no longer available for Development Mode apps | ✅ Removed from agent tools |
| `GET /playlists/{id}/items` (was `/tracks`) | Playlist track management uses `/items` | ✅ No migration needed |
| Premium subscription required | The app owner must have Spotify Premium for Development Mode to work | ℹ️ Requirement |
| 5-user limit per app | Development Mode apps are limited to 5 test users | ℹ️ Requirement |

**Impact on the demo:**
- Playlist creation (`create_playlist` tool) now calls `POST /me/playlists` directly — no user ID lookup is needed.
- The `get_recommendations` tool has been removed from the agent. Track discovery is handled entirely via `search_tracks` using multiple queries.
- If your app requires the recommendations endpoint, apply for [Extended Quota](https://developer.spotify.com/documentation/web-api/concepts/quota-modes).

---

### Model Router

Showcases [Azure AI Foundry's Model Router](https://learn.microsoft.com/en-us/azure/foundry/openai/concepts/model-router) — a single deployment endpoint that intelligently routes each prompt to the best-suited model based on a configurable routing mode.

The demo sends the **same prompt** to the Model Router three times — once in each routing mode (**balanced**, **quality**, **cost**) — and displays the results **side-by-side**. This makes the routing behavior visible:

- **Which model** was selected for each mode (e.g. `gpt-4o` vs `gpt-4o-mini`)
- **Response quality** differences between models
- **Latency** and **token usage** trade-offs

| Mode | Behavior |
|------|----------|
| **Balanced** | Best trade-off between quality and cost |
| **Quality** | Always selects the most capable model |
| **Cost** | Selects the cheapest model that meets a quality threshold |

#### Setup

1. Deploy a **model-router** in [Azure AI Foundry](https://ai.azure.com)
2. Set the deployment name in your `.env`:
   ```
   AZURE_OPENAI_MODEL_ROUTER_DEPLOYMENT=model-router
   ```

---

### AI Creative Studio

Orchestrates AI image generation with quality feedback loops. A **Prompt Engineer** refines the user's concept, **gpt-image-2** generates the image, and an optional **Art Director** reviews and requests revisions — up to 3 iterations.

**Pipeline:** User Request → Prompt Engineer → Image Generation → Art Director (optional) → Final Image

| Option | Choices |
|--------|---------|
| **Style** | Photorealistic, Illustration, Digital Art, Oil Painting, Watercolor, Cinematic |
| **Size** | 1024×1024, 1536×1024 (landscape), 1024×1536 (portrait), Auto |
| **Reference image** | Optional upload (up to 10 MB) for style guidance |
| **Art Director** | Optional review loop with quality scoring |

**Requires:** `AZURE_OPENAI_IMAGE_DEPLOYMENT=gpt-image-2` for real image generation. Without it the demo runs in mock mode with placeholder images.

---

## Environment Variables

All demos require:

| Variable | Purpose |
|----------|---------|
| `AZURE_OPENAI_ENDPOINT` | Azure OpenAI resource endpoint |
| `AZURE_OPENAI_DEPLOYMENT` | GPT model deployment name |

Optional / feature-specific:

| Variable | Purpose |
|----------|---------|
| `AZURE_SEARCH_ENDPOINT` | Enables RAG retrieval (RAG Pipeline, RAG Failure & Recovery) |
| `AZURE_SEARCH_INDEX` | Azure AI Search index name |
| `AZURE_OPENAI_IMAGE_DEPLOYMENT` | Enables real image generation (AI Creative Studio) |
| `AZURE_OPENAI_MODEL_ROUTER_DEPLOYMENT` | Enables Model Router demo |
| `AZURE_OPENAI_REASONING_DEPLOYMENT` | Optional extended reasoning model for Spotify agent |


