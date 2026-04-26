// ─── Multi-Agent Orchestration Contracts ────────────────────────────────────

/** Workflow mode: stop after first fact-check or loop until approved */
export type WorkflowMode = 'review-after-first' | 'auto-revise';

/** Agent step identifiers shown in the orchestration view */
export type AgentStep =
  | 'user-request'
  | 'orchestrator'
  | 'generator'
  | 'fact-checker'
  | 'revision'
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
  revisionOutput?: RevisionOutput;
  orchestratorDecision?: OrchestratorDecision;
  agentMessages?: AgentMessage[];
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

/** Request payload sent to POST /api/orchestration/run */
export interface OrchestrationRequest {
  prompt: string;
  creativityLevel: number;
  workflowMode: WorkflowMode;
  acceptanceThreshold: number;
  maxIterations: number;
  generatorKnowledgeSource: boolean;
  scenario?: 'default' | 'rag-failure-recovery';
}

/** Step labels for display */
export const STEP_LABELS: Record<AgentStep, string> = {
  'user-request': 'User Request',
  orchestrator: 'Orchestrator',
  generator: 'Generator',
  'fact-checker': 'Fact Checker',
  revision: 'Revision Agent',
  'final-answer': 'Final Answer',
};

// ─── Scenario / Features definitions ─────────────────────────────────────────

export type ScenarioId = 'multi-agent-orchestration' | 'rag-pipeline' | 'tool-use' | 'rag-failure-recovery' | 'sales-proposal' | 'smart-home-bundle' | 'spotify-playlists' | 'model-router';

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
    id: 'rag-failure-recovery',
    label: 'RAG Failure & Recovery',
    description:
      'Watch the system detect hallucinated product claims, retrieve real catalog facts, and rewrite until grounded',
    icon: '🔍',
    route: '/rag-failure-demo',
  },
  {
    id: 'sales-proposal',
    label: 'Sales Proposal Team',
    description:
      'Specialized agents collaborate to build a business laptop proposal — balancing budget, specs, warranty, and support constraints',
    icon: '📋',
    route: '/sales-proposal-demo',
  },
  {
    id: 'smart-home-bundle',
    label: 'Smart Home Bundle Builder',
    description:
      'Agents recommend, review privacy, check compatibility, and assemble a smart home bundle — with approvals, objections, and conditions',
    icon: '🏠',
    route: '/smart-home-demo',
  },
  {
    id: 'spotify-playlists',
    label: 'Spotify Playlist Agent',
    description:
      'An AI agent that connects to your Spotify account to search tracks, create playlists, and manage your music library',
    icon: '🎵',
    route: '/spotify-demo',
  },
  {
    id: 'model-router',
    label: 'Model Router',
    description:
      'Send the same prompt through three routing modes — balanced, quality, and cost — and compare which model is selected, response quality, latency, and token usage side by side',
    icon: '🔀',
    route: '/model-router-demo',
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

export type CombinedTimelineItem =
  | { kind: 'reasoning'; id: string; text: string }
  | { kind: 'tool-call'; record: ToolCallRecord };

export interface ToolEvent {
  type: 'step-start' | 'step-complete' | 'tool-call-start' | 'tool-call-complete' | 'reasoning' | 'error' | 'done';
  step: ToolStep;
  timestamp: string;
  data:
    | { message: string }
    | { prompt: string }
    | { tools: ToolDefinition[] }
    | { text: string }
    | ToolCallRecord
    | { text: string; toolCalls: ToolCallRecord[] }
    | null;
}

export interface ToolRequest {
  prompt: string;
  creativityLevel: number;
}

// ─── Sales Proposal Team Contracts ───────────────────────────────────────────

export type ProposalAgentRole =
  | 'orchestrator'
  | 'customer-intake'
  | 'product-specialist'
  | 'pricing'
  | 'support-warranty'
  | 'proposal-writer';

export const PROPOSAL_AGENT_LABELS: Record<ProposalAgentRole, string> = {
  orchestrator: 'Orchestrator',
  'customer-intake': 'Customer Intake',
  'product-specialist': 'Product Specialist',
  pricing: 'Pricing Agent',
  'support-warranty': 'Support & Warranty',
  'proposal-writer': 'Proposal Writer',
};

export type ProposalStep =
  | 'user-request'
  | 'customer-intake'
  | 'product-search'
  | 'pricing'
  | 'support-check'
  | 'proposal-draft'
  | 'final-proposal';

export const PROPOSAL_STEP_LABELS: Record<ProposalStep, string> = {
  'user-request': 'Customer Request',
  'customer-intake': 'Intake',
  'product-search': 'Product Search',
  pricing: 'Pricing',
  'support-check': 'Support Check',
  'proposal-draft': 'Proposal Draft',
  'final-proposal': 'Final Proposal',
};

export interface CustomerRequirements {
  quantity: number;
  budgetDKK: number;
  useCase: string;
  priorities: string[];
  warrantyNeeds: string;
  additionalNotes: string;
}

export interface ProductCandidate {
  name: string;
  category: string;
  priceDKK: number;
  keySpecs: string;
  batteryLife: string;
  weight: string;
  warranty: string;
  fitScore: number;
  fitReason: string;
}

export interface PricingResult {
  productName: string;
  unitPriceDKK: number;
  quantity: number;
  totalDKK: number;
  budgetDKK: number;
  withinBudget: boolean;
  budgetDelta: number;
  accessories?: string;
}

export interface SupportAssessment {
  productName: string;
  warrantyType: string;
  warrantyDuration: string;
  businessSupport: boolean;
  onsiteService: boolean;
  replacementTerms: string;
  suitability: 'recommended' | 'acceptable' | 'not-recommended';
  concerns: string[];
}

export interface ProposalAgentMessage {
  from: ProposalAgentRole | 'user';
  to: ProposalAgentRole;
  message: string;
  timestamp: string;
  type: 'instruction' | 'finding' | 'concern' | 'recommendation' | 'handoff';
}

export interface ProposalEvent {
  type: 'step-start' | 'step-complete' | 'agent-message' | 'run-complete' | 'error';
  step: ProposalStep;
  timestamp: string;
  data:
    | CustomerRequirements
    | ProductCandidate[]
    | PricingResult
    | SupportAssessment
    | ProposalAgentMessage
    | { text: string }
    | { message: string }
    | ProposalSummary
    | null;
}

export interface ProposalSummary {
  recommendedProduct: string;
  alternativeProduct?: string;
  totalCost: number;
  budgetDKK: number;
  withinBudget: boolean;
  warrantyOk: boolean;
  proposalText: string;
  tradeOffs: string[];
  agentMessages: ProposalAgentMessage[];
}

export interface ProposalRequest {
  prompt: string;
  creativityLevel: number;
}

// ─── Smart Home Bundle Builder Contracts ─────────────────────────────────────

export type SmartHomeAgentRole =
  | 'orchestrator'
  | 'needs-agent'
  | 'device-agent'
  | 'privacy-agent'
  | 'compatibility-agent'
  | 'bundle-agent';

export const SMART_HOME_AGENT_LABELS: Record<SmartHomeAgentRole, string> = {
  orchestrator: 'Orchestrator',
  'needs-agent': 'Needs Agent',
  'device-agent': 'Device Agent',
  'privacy-agent': 'Privacy/Safety Agent',
  'compatibility-agent': 'Compatibility Agent',
  'bundle-agent': 'Bundle Agent',
};

export type SmartHomeStep =
  | 'user-request'
  | 'needs-analysis'
  | 'device-recommendation'
  | 'privacy-review'
  | 'compatibility-check'
  | 'bundle-assembly'
  | 'final-bundle';

export const SMART_HOME_STEP_LABELS: Record<SmartHomeStep, string> = {
  'user-request': 'Customer Request',
  'needs-analysis': 'Needs Analysis',
  'device-recommendation': 'Device Selection',
  'privacy-review': 'Privacy Review',
  'compatibility-check': 'Compatibility',
  'bundle-assembly': 'Bundle Assembly',
  'final-bundle': 'Final Bundle',
};

export interface HomeNeeds {
  spaceType: string;
  spaceSize: string;
  privacyLevel: string;
  budgetDKK: number;
  priorities: string[];
  additionalNotes: string;
}

export interface DeviceRecommendation {
  name: string;
  category: string;
  priceDKK: number;
  keyFeatures: string;
  protocols: string[];
  privacyFeatures: string[];
  reason: string;
}

export interface PrivacyAssessment {
  deviceName: string;
  hasCamera: boolean;
  hasMicrophone: boolean;
  hasHardwareMuteSwitch: boolean;
  hasPrivacyShutter: boolean;
  localProcessing: boolean;
  privacyRating: 'approved' | 'conditional' | 'rejected';
  conditions: string[];
  concerns: string[];
}

export interface CompatibilityResult {
  deviceName: string;
  protocols: string[];
  matterSupport: boolean;
  threadSupport: boolean;
  zigbeeSupport: boolean;
  wifiSupport: boolean;
  hubRequired: boolean;
  compatibleWith: string[];
  issues: string[];
}

export interface BundleItem {
  name: string;
  quantity: number;
  unitPriceDKK: number;
  totalPriceDKK: number;
}

export interface SmartHomeBundleSummary {
  bundleName: string;
  items: BundleItem[];
  totalPriceDKK: number;
  budgetDKK: number;
  withinBudget: boolean;
  setupPlan: string;
  privacyOk: boolean;
  compatibilityOk: boolean;
  agentMessages: SmartHomeAgentMessage[];
}

export interface SmartHomeAgentMessage {
  from: SmartHomeAgentRole | 'user';
  to: SmartHomeAgentRole;
  message: string;
  timestamp: string;
  type: 'instruction' | 'finding' | 'concern' | 'approval' | 'condition' | 'recommendation' | 'handoff' | 'objection';
}

export interface SmartHomeEvent {
  type: 'step-start' | 'step-complete' | 'agent-message' | 'run-complete' | 'error';
  step: SmartHomeStep;
  timestamp: string;
  data:
    | HomeNeeds
    | DeviceRecommendation[]
    | PrivacyAssessment
    | CompatibilityResult[]
    | SmartHomeAgentMessage
    | SmartHomeBundleSummary
    | { text: string }
    | { message: string }
    | null;
}

export interface SmartHomeRequest {
  prompt: string;
  creativityLevel: number;
}

// ─── Spotify Playlist Agent Contracts ────────────────────────────────────────

export interface SpotifyRequest {
  prompt: string;
  creativityLevel: number;
  accessToken: string;
  maxToolCalls?: number;
}

// ─── Model Router Contracts ─────────────────────────────────────────────────

export type ModelRouterRoutingMode = 'balanced' | 'quality' | 'cost';

export type ModelRouterStep = 'user-request' | 'routing' | 'result';

export const MODEL_ROUTER_STEP_LABELS: Record<ModelRouterStep, string> = {
  'user-request': 'Prompt',
  routing: 'Routing',
  result: 'Result',
};

export interface ModelRouterRequest {
  prompt: string;
  creativityLevel: number;
  routingMode: ModelRouterRoutingMode;
}

export interface ModelRouterResult {
  routingMode: ModelRouterRoutingMode;
  modelUsed: string;
  responseText: string;
  latencyMs: number;
  promptTokens: number;
  completionTokens: number;
}

export interface ModelRouterEvent {
  type: 'step-start' | 'step-complete' | 'error' | 'done';
  step: ModelRouterStep;
  timestamp: string;
  data:
    | ModelRouterResult
    | { prompt: string }
    | { message: string }
    | null;
}
