// ─── Multi-Agent Orchestration Contracts (backend mirror) ───────────────────

export type WorkflowMode = 'review-after-first' | 'auto-revise';

export type AgentStep =
  | 'user-request'
  | 'orchestrator'
  | 'generator'
  | 'fact-checker'
  | 'revision'
  | 'final-answer';

export type ClaimStatus = 'supported' | 'unsupported' | 'uncertain';

export interface FactualClaim {
  id: string;
  text: string;
  status?: ClaimStatus;
  evidence?: string;
}

export interface GeneratorOutput {
  draftText: string;
  claims: FactualClaim[];
  iteration: number;
}

export interface FactCheckerOutput {
  verdict: 'approved' | 'needs-revision' | 'rejected';
  score: number;
  claims: FactualClaim[];
  revisionInstructions?: string;
  evidenceReferences: string[];
}

/** Inter-agent communication message */
export interface AgentMessage {
  from: AgentStep;
  to: AgentStep;
  message: string;
  timestamp: string;
  type: 'finding' | 'instruction' | 'confirmation' | 'handoff';
}

/** Revision agent output */
export interface RevisionOutput {
  revisedText: string;
  changesApplied: string[];
  iteration: number;
}

export interface OrchestratorDecision {
  action: 'generate' | 'fact-check' | 'revise' | 'approve' | 'reject';
  reason: string;
  iteration: number;
  maxIterations: number;
}

export interface IterationRecord {
  iteration: number;
  generatorOutput: GeneratorOutput;
  factCheckerOutput?: FactCheckerOutput;
  revisionOutput?: RevisionOutput;
  orchestratorDecision?: OrchestratorDecision;
  agentMessages?: AgentMessage[];
}

export interface RunSummary {
  draftCount: number;
  claimsChecked: number;
  unsupportedClaims: number;
  finalStatus: 'approved' | 'rejected' | 'review';
  finalText: string;
  iterations: IterationRecord[];
}

export interface OrchestrationEvent {
  type: 'step-start' | 'step-complete' | 'run-complete' | 'agent-message' | 'error';
  step: AgentStep;
  timestamp: string;
  data:
    | OrchestratorDecision
    | GeneratorOutput
    | FactCheckerOutput
    | RevisionOutput
    | RunSummary
    | AgentMessage
    | { message: string };
}

export interface OrchestrationRequest {
  prompt: string;
  creativityLevel: number;
  workflowMode: WorkflowMode;
  acceptanceThreshold: number;
  maxIterations: number;
  generatorKnowledgeSource: boolean;
  scenario?: 'default' | 'rag-failure-recovery';
}

// ─── Tool-Use Agent Contracts ────────────────────────────────────────────────

export type ToolStep = 'user-request' | 'reasoning' | 'tool-call' | 'final-answer';

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

// ─── RAG Pipeline Contracts ─────────────────────────────────────────────────

export type RagStep = 'user-request' | 'retrieval' | 'generation' | 'final-answer';

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
