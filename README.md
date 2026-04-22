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
