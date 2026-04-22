// ─── Multi-Agent Orchestration Contracts (backend mirror) ───────────────────

export type WorkflowMode = 'review-after-first' | 'auto-revise';

export type AgentStep =
  | 'user-request'
  | 'orchestrator'
  | 'generator'
  | 'fact-checker'
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
  orchestratorDecision?: OrchestratorDecision;
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

export interface OrchestrationRequest {
  prompt: string;
  creativityLevel: number;
  workflowMode: WorkflowMode;
  acceptanceThreshold: number;
  maxIterations: number;
}
