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
}

/** Step labels for display */
export const STEP_LABELS: Record<AgentStep, string> = {
  'user-request': 'User Request',
  orchestrator: 'Orchestrator',
  generator: 'Generator',
  'fact-checker': 'Fact Checker',
  'final-answer': 'Final Answer',
};
