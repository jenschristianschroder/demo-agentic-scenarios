// ─── Multi-Agent Orchestration Contracts ────────────────────────────────────

/** Workflow mode: stop after first fact-check or loop until approved */
export type WorkflowMode = 'review-after-first' | 'auto-revise';

/** Agent step identifiers shown in the orchestration view */
export type AgentStep =
  | 'user-request'
  | 'orchestrator'
  | 'generator'
  | 'fact-checker'
  | 'final-answer';

/** Fact-check status for a single claim */
export type ClaimStatus = 'supported' | 'unsupported' | 'uncertain';

/** A single factual claim extracted by the generator */
export interface FactualClaim {
  id: string;
  text: string;
  status?: ClaimStatus;
  evidence?: string;
}

/** Generator agent output */
export interface GeneratorOutput {
  draftText: string;
  claims: FactualClaim[];
  iteration: number;
}

/** Fact-checker agent output */
export interface FactCheckerOutput {
  verdict: 'approved' | 'needs-revision' | 'rejected';
  score: number;
  claims: FactualClaim[];
  revisionInstructions?: string;
  evidenceReferences: string[];
}

/** Orchestrator decision record */
export interface OrchestratorDecision {
  action: 'generate' | 'fact-check' | 'revise' | 'approve' | 'reject';
  reason: string;
  iteration: number;
  maxIterations: number;
}

/** A single iteration of the generate → fact-check cycle */
export interface IterationRecord {
  iteration: number;
  generatorOutput: GeneratorOutput;
  factCheckerOutput?: FactCheckerOutput;
  orchestratorDecision?: OrchestratorDecision;
}

/** Final run summary */
export interface RunSummary {
  draftCount: number;
  claimsChecked: number;
  unsupportedClaims: number;
  finalStatus: 'approved' | 'rejected' | 'review';
  finalText: string;
  iterations: IterationRecord[];
}

/** SSE event streamed from the backend during orchestration */
export interface OrchestrationEvent {
  type: 'step-start' | 'step-complete' | 'run-complete' | 'error';
  step: AgentStep;
  timestamp: string;
  data:
    | OrchestratorDecision
    | GeneratorOutput
    | FactCheckerOutput
    | RunSummary
    | { message: string };
}

/** Request payload sent to POST /api/orchestration/run */
export interface OrchestrationRequest {
  prompt: string;
  creativityLevel: number;
  workflowMode: WorkflowMode;
  acceptanceThreshold: number;
  maxIterations: number;
  generatorKnowledgeSource: boolean;
}

/** Step labels for display */
export const STEP_LABELS: Record<AgentStep, string> = {
  'user-request': 'User Request',
  orchestrator: 'Orchestrator',
  generator: 'Generator',
  'fact-checker': 'Fact Checker',
  'final-answer': 'Final Answer',
};

// ─── Scenario / Features definitions ─────────────────────────────────────────

export type ScenarioId = 'multi-agent-orchestration' | 'rag-pipeline' | 'tool-use' | 'spotify-playlists';

export interface ScenarioInfo {
  id: ScenarioId;
  label: string;
  description: string;
  icon: string;
  route: string;
}

export const SCENARIOS: ScenarioInfo[] = [
  {
    id: 'rag-pipeline',
    label: 'RAG Pipeline',
    description:
      'See how Retrieval-Augmented Generation grounds LLM responses with real documents — toggle RAG on and off to compare',
    icon: '📚',
    route: '/rag-demo',
  },
  {
    id: 'tool-use',
    label: 'Tool-Use Agent',
    description:
      'Watch the model decide which tools to call, see arguments and results in real time — the LLM drives the workflow',
    icon: '🔧',
    route: '/tool-demo',
  },
  {
    id: 'multi-agent-orchestration',
    label: 'Multi-Agent Orchestration',
    description:
      'An orchestrator coordinates content generation and fact-checking agents in an iterative loop with real-time visibility',
    icon: '🤖',
    route: '/demo',
  },
  {
    id: 'spotify-playlists',
    label: 'Spotify Playlist Agent',
    description:
      'An AI agent that connects to your Spotify account to search tracks, create playlists, and manage your music library',
    icon: '🎵',
    route: '/spotify-demo',
  },
];

// ─── RAG Pipeline Contracts ─────────────────────────────────────────────────

export type RagStep = 'user-request' | 'retrieval' | 'generation' | 'final-answer';

export const RAG_STEP_LABELS: Record<RagStep, string> = {
  'user-request': 'Query',
  retrieval: 'Retrieval',
  generation: 'Generation',
  'final-answer': 'Response',
};

export interface RetrievalResult {
  content: string;
  source: string;
  title: string;
  score: number;
}

export interface RagEvent {
  type: 'step-start' | 'step-complete' | 'error' | 'done';
  step: RagStep;
  timestamp: string;
  data:
    | RetrievalResult[]
    | { text: string }
    | { prompt: string }
    | { message: string }
    | null;
}

export interface RagRequest {
  prompt: string;
  ragEnabled: boolean;
  creativityLevel: number;
}

// ─── Tool-Use Agent Contracts ────────────────────────────────────────────────

export type ToolStep = 'user-request' | 'reasoning' | 'tool-call' | 'final-answer';

export const TOOL_STEP_LABELS: Record<ToolStep, string> = {
  'user-request': 'Query',
  reasoning: 'Reasoning',
  'tool-call': 'Tool Call',
  'final-answer': 'Answer',
};

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCallRecord {
  id: string;
  toolName: string;
  arguments: Record<string, unknown>;
  result: unknown;
  durationMs: number;
}

export interface ToolEvent {
  type: 'step-start' | 'step-complete' | 'tool-call-start' | 'tool-call-complete' | 'error' | 'done';
  step: ToolStep;
  timestamp: string;
  data:
    | { message: string }
    | { prompt: string }
    | { tools: ToolDefinition[] }
    | ToolCallRecord
    | { text: string; toolCalls: ToolCallRecord[] }
    | null;
}

export interface ToolRequest {
  prompt: string;
  creativityLevel: number;
}

// ─── Spotify Playlist Agent Contracts ────────────────────────────────────────

export interface SpotifyRequest {
  prompt: string;
  creativityLevel: number;
  accessToken: string;
}
