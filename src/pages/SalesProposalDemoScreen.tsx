import React, { useState, useCallback } from 'react';
import type {
  ProposalRequest,
  ProposalEvent,
  ProposalStep,
  ProposalAgentMessage,
  ProposalSummary,
  CustomerRequirements,
  ProductCandidate,
  PricingResult,
  SupportAssessment,
} from '../types';
import { runSalesProposal } from '../services/salesProposalApi';
import ProposalPipelineView from './components/ProposalPipelineView';
import ProposalCommunicationLog from './components/ProposalCommunicationLog';
import './SalesProposalDemoScreen.css';

const DEFAULT_PROMPT =
  'We need 25 laptops for field sales, under DKK 300,000, with long battery life and business support.';

const SalesProposalDemoScreen: React.FC = () => {
  // ─── Controls state ───────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [creativityLevel, setCreativityLevel] = useState(0.5);

  // ─── Orchestration state ──────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<ProposalStep | null>(null);
  const [inProgressSteps, setInProgressSteps] = useState<Set<ProposalStep>>(new Set());
  const [selectedStep, setSelectedStep] = useState<ProposalStep | null>(null);
  const [events, setEvents] = useState<ProposalEvent[]>([]);
  const [agentMessages, setAgentMessages] = useState<ProposalAgentMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  // ─── Data from each step ──────────────────────────────────────────────────
  const [requirements, setRequirements] = useState<CustomerRequirements | null>(null);
  const [candidates, setCandidates] = useState<ProductCandidate[]>([]);
  const [pricing, setPricing] = useState<PricingResult | null>(null);
  const [support, setSupport] = useState<SupportAssessment | null>(null);
  const [summary, setSummary] = useState<ProposalSummary | null>(null);

  const handleRun = useCallback(async () => {
    if (!prompt.trim() || isRunning) return;

    setIsRunning(true);
    setActiveStep('user-request');
    setInProgressSteps(new Set(['user-request']));
    setSelectedStep(null);
    setEvents([]);
    setAgentMessages([]);
    setError(null);
    setRequirements(null);
    setCandidates([]);
    setPricing(null);
    setSupport(null);
    setSummary(null);

    const request: ProposalRequest = {
      prompt: prompt.trim(),
      creativityLevel,
    };

    try {
      await runSalesProposal(request, (event: ProposalEvent) => {
        setEvents((prev) => [...prev, event]);

        if (event.type === 'step-start') {
          setActiveStep(event.step);
          setInProgressSteps((prev) => new Set(prev).add(event.step));
        }

        if (event.type === 'step-complete') {
          setInProgressSteps((prev) => {
            const next = new Set(prev);
            next.delete(event.step);
            return next;
          });

          switch (event.step) {
            case 'customer-intake':
              setRequirements(event.data as CustomerRequirements);
              break;
            case 'product-search':
              setCandidates(event.data as ProductCandidate[]);
              break;
            case 'pricing':
              setPricing(event.data as PricingResult);
              break;
            case 'support-check':
              setSupport(event.data as SupportAssessment);
              break;
            case 'final-proposal':
              setSummary(event.data as ProposalSummary);
              break;
          }
        }

        if (event.type === 'agent-message') {
          const msg = event.data as ProposalAgentMessage;
          setAgentMessages((prev) => [...prev, msg]);
        }

        if (event.type === 'run-complete') {
          setSummary(event.data as ProposalSummary);
          setActiveStep('final-proposal');
          setInProgressSteps(new Set());
          setIsRunning(false);
        }

        if (event.type === 'error') {
          const errData = event.data as { message: string };
          setError(errData.message);
          setIsRunning(false);
          setInProgressSteps(new Set());
          setActiveStep(null);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sales Proposal failed');
      setIsRunning(false);
      setInProgressSteps(new Set());
      setActiveStep(null);
    }
  }, [prompt, creativityLevel, isRunning]);

  return (
    <div className="sales-proposal-screen">
      <div className="sales-proposal-header">
        <span className="sales-proposal-header-title">Sales Proposal Team Demo</span>
      </div>

      <div className="sales-proposal-content kiosk-container">
        {/* Controls */}
        <div className="sales-proposal-controls">
          <div className="control-group">
            <label className="control-label" htmlFor="sp-prompt">Customer Request</label>
            <textarea
              id="sp-prompt"
              className="control-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the laptop purchase request…"
              disabled={isRunning}
              rows={3}
            />
          </div>

          <div className="sales-proposal-settings">
            <div className="control-group control-group-half">
              <label className="control-label" htmlFor="sp-creativity">
                Creativity <span className="control-value">{creativityLevel.toFixed(1)}</span>
              </label>
              <input
                id="sp-creativity"
                type="range"
                className="control-slider"
                min={0}
                max={1}
                step={0.1}
                value={creativityLevel}
                onChange={(e) => setCreativityLevel(parseFloat(e.target.value))}
                disabled={isRunning}
              />
              <div className="slider-labels">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="run-btn"
            onClick={handleRun}
            disabled={isRunning || !prompt.trim()}
          >
            {isRunning ? (
              <span className="run-btn-loading">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
                Running
              </span>
            ) : (
              'Generate Sales Proposal'
            )}
          </button>
        </div>

        {/* Pipeline view */}
        <ProposalPipelineView
          activeStep={activeStep}
          selectedStep={selectedStep}
          onSelectStep={setSelectedStep}
          isRunning={isRunning}
          events={events}
          inProgressSteps={inProgressSteps}
        />

        {/* Agent Communication */}
        <ProposalCommunicationLog messages={agentMessages} isRunning={isRunning} />

        {/* Step detail panel */}
        {selectedStep && (
          <div className="sales-proposal-step-detail">
            <StepDetailPanel
              step={selectedStep}
              requirements={requirements}
              candidates={candidates}
              pricing={pricing}
              support={support}
              summary={summary}
              prompt={prompt}
            />
          </div>
        )}

        {error && <div className="demo-error">{error}</div>}

        {/* Final Proposal */}
        {summary && (
          <div className="sales-proposal-result">
            <div className="proposal-result-header">
              <span className="proposal-result-title">Final Proposal</span>
              <span className={`proposal-result-badge ${summary.withinBudget ? 'badge-ok' : 'badge-warn'}`}>
                {summary.withinBudget ? 'Within Budget' : 'Over Budget'}
              </span>
              <span className={`proposal-result-badge ${summary.warrantyOk ? 'badge-ok' : 'badge-warn'}`}>
                {summary.warrantyOk ? 'Warranty OK' : 'Warranty Concern'}
              </span>
            </div>

            <div className="proposal-result-summary">
              <div className="proposal-summary-item">
                <span className="summary-label">Recommended</span>
                <span className="summary-value">{summary.recommendedProduct}</span>
              </div>
              {summary.alternativeProduct && (
                <div className="proposal-summary-item">
                  <span className="summary-label">Alternative</span>
                  <span className="summary-value">{summary.alternativeProduct}</span>
                </div>
              )}
              <div className="proposal-summary-item">
                <span className="summary-label">Total Cost</span>
                <span className="summary-value">DKK {summary.totalCost.toLocaleString()}</span>
              </div>
              <div className="proposal-summary-item">
                <span className="summary-label">Budget</span>
                <span className="summary-value">DKK {summary.budgetDKK.toLocaleString()}</span>
              </div>
            </div>

            {summary.tradeOffs.length > 0 && (
              <div className="proposal-tradeoffs">
                <span className="tradeoffs-label">Trade-offs</span>
                <ul>
                  {summary.tradeOffs.map((t, i) => (
                    <li key={i}>{t}</li>
                  ))}
                </ul>
              </div>
            )}

            <div className="proposal-text">
              {summary.proposalText.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** Step detail panel for showing data from a selected pipeline step. */
const StepDetailPanel: React.FC<{
  step: ProposalStep;
  requirements: CustomerRequirements | null;
  candidates: ProductCandidate[];
  pricing: PricingResult | null;
  support: SupportAssessment | null;
  summary: ProposalSummary | null;
  prompt: string;
}> = ({ step, requirements, candidates, pricing, support, summary, prompt }) => {
  switch (step) {
    case 'user-request':
      return (
        <div className="step-detail-card">
          <h3>Customer Request</h3>
          <p>{prompt}</p>
        </div>
      );

    case 'customer-intake':
      if (!requirements) return <div className="step-detail-card"><p>Processing…</p></div>;
      return (
        <div className="step-detail-card">
          <h3>Extracted Requirements</h3>
          <dl className="detail-dl">
            <dt>Quantity</dt><dd>{requirements.quantity}</dd>
            <dt>Budget</dt><dd>DKK {requirements.budgetDKK.toLocaleString()}</dd>
            <dt>Use Case</dt><dd>{requirements.useCase}</dd>
            <dt>Priorities</dt><dd>{requirements.priorities.join(', ')}</dd>
            <dt>Warranty Needs</dt><dd>{requirements.warrantyNeeds}</dd>
            {requirements.additionalNotes && <><dt>Notes</dt><dd>{requirements.additionalNotes}</dd></>}
          </dl>
        </div>
      );

    case 'product-search':
      if (candidates.length === 0) return <div className="step-detail-card"><p>Searching…</p></div>;
      return (
        <div className="step-detail-card">
          <h3>Product Candidates</h3>
          <div className="candidate-grid">
            {candidates.map((c, i) => (
              <div key={i} className={`candidate-card ${i === 0 ? 'candidate-top' : ''}`}>
                <div className="candidate-header">
                  <span className="candidate-name">{c.name}</span>
                  <span className="candidate-score">Score: {c.fitScore}</span>
                </div>
                <div className="candidate-specs">{c.keySpecs}</div>
                <div className="candidate-details">
                  <span>DKK {c.priceDKK.toLocaleString()}</span>
                  <span>{c.batteryLife}</span>
                  <span>{c.weight}</span>
                </div>
                <div className="candidate-reason">{c.fitReason}</div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'pricing':
      if (!pricing) return <div className="step-detail-card"><p>Calculating…</p></div>;
      return (
        <div className="step-detail-card">
          <h3>Pricing Analysis</h3>
          <dl className="detail-dl">
            <dt>Product</dt><dd>{pricing.productName}</dd>
            <dt>Unit Price</dt><dd>DKK {pricing.unitPriceDKK.toLocaleString()}</dd>
            <dt>Quantity</dt><dd>{pricing.quantity}</dd>
            <dt>Total</dt><dd>DKK {pricing.totalDKK.toLocaleString()}</dd>
            <dt>Budget</dt><dd>DKK {pricing.budgetDKK.toLocaleString()}</dd>
            <dt>Status</dt>
            <dd className={pricing.withinBudget ? 'text-ok' : 'text-warn'}>
              {pricing.withinBudget
                ? `Within budget (DKK ${pricing.budgetDelta.toLocaleString()} remaining)`
                : `Over budget by DKK ${Math.abs(pricing.budgetDelta).toLocaleString()}`}
            </dd>
          </dl>
        </div>
      );

    case 'support-check':
      if (!support) return <div className="step-detail-card"><p>Assessing…</p></div>;
      return (
        <div className="step-detail-card">
          <h3>Support &amp; Warranty Assessment</h3>
          <dl className="detail-dl">
            <dt>Product</dt><dd>{support.productName}</dd>
            <dt>Warranty</dt><dd>{support.warrantyType}</dd>
            <dt>Duration</dt><dd>{support.warrantyDuration}</dd>
            <dt>On-site Service</dt><dd>{support.onsiteService ? 'Yes' : 'No'}</dd>
            <dt>Business Support</dt><dd>{support.businessSupport ? 'Yes' : 'No'}</dd>
            <dt>Replacement</dt><dd>{support.replacementTerms}</dd>
            <dt>Suitability</dt>
            <dd className={
              support.suitability === 'recommended' ? 'text-ok' :
              support.suitability === 'acceptable' ? 'text-warn' : 'text-bad'
            }>
              {support.suitability}
            </dd>
          </dl>
          {support.concerns.length > 0 && (
            <div className="support-concerns">
              <strong>Concerns:</strong>
              <ul>
                {support.concerns.map((c, i) => <li key={i}>{c}</li>)}
              </ul>
            </div>
          )}
        </div>
      );

    case 'proposal-draft':
    case 'final-proposal':
      if (!summary) return <div className="step-detail-card"><p>Drafting…</p></div>;
      return (
        <div className="step-detail-card">
          <h3>{step === 'proposal-draft' ? 'Draft Proposal' : 'Final Proposal'}</h3>
          <div className="proposal-text-preview">
            {summary.proposalText.split('\n').map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          </div>
        </div>
      );

    default:
      return null;
  }
};

export default SalesProposalDemoScreen;
