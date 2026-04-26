# Multi-Agent Orchestration Demo

A demo application showcasing multi-agent orchestration on Azure. An **Orchestrator** coordinates a **Generator** and **Fact-Checker** agent in a sequential workflow with an optional revision loop.

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

## Workflow Modes

| Mode | Behavior |
|------|----------|
| **Review after first** | Run one generate → fact-check pass, show results |
| **Auto-revise** | Loop generate → fact-check until score ≥ threshold or max iterations |

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

## Controls

| Control | Description |
|---------|-------------|
| **Creativity** | 0 = precise, 1 = creative (more hallucinations) |
| **Workflow Mode** | Review after first pass or auto-revise loop |
| **Threshold** | Minimum fact-check score to approve (0–1) |
| **Max Iterations** | Maximum revision loops (1–5) |

## Contracts

### Generator Output
- `draftText` — Generated content
- `claims[]` — Extracted factual claims with ID and text

### Fact-Checker Output
- `verdict` — approved / needs-revision / rejected
- `score` — 0–1 fact-check accuracy score
- `claims[]` — Claim-by-claim status with evidence
- `revisionInstructions` — What to fix (when needs-revision)
- `evidenceReferences[]` — Sources from the knowledge base

### Orchestrator Decision
- `action` — generate / fact-check / revise / approve / reject
- `reason` — Human-readable explanation
- `iteration` / `maxIterations` — Loop tracking

## Spotify Demo Setup

The Spotify Playlist Agent demo requires a Spotify Developer application configured with the PKCE OAuth flow.

### Required OAuth Scopes

The following scopes must be granted for the agent to create and manage playlists:

| Scope | Purpose |
|-------|---------|
| `user-read-private` | Read user profile |
| `user-read-email` | Read user email |
| `playlist-read-private` | List existing playlists |
| `playlist-modify-public` | Create and edit public playlists |
| `playlist-modify-private` | Create and edit private playlists |

### Spotify Developer Dashboard — Development Mode

If your Spotify app is in **Development Mode** (the default for new apps), Spotify restricts API write access to explicitly approved users only. **All users who will use this demo must be added under Settings → User Management** in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

Without this, write operations such as creating playlists will silently fail with a **403 Forbidden** error even though the OAuth flow completes successfully and read operations (search, profile) appear to work.

Steps to add a user:
1. Open your app in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).
2. Go to **Settings → User Management**.
3. Add the Spotify account email address of each user who needs access.
4. Ask the user to **Disconnect and Reconnect** to Spotify in the demo to obtain a fresh token.

To remove the user limit, submit your app for a [Quota Extension](https://developer.spotify.com/documentation/web-api/concepts/quota-modes) via the Developer Dashboard.

### February 2026 Spotify API Changes

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

