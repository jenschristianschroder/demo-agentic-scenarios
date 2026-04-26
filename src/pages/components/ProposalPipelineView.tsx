import React from 'react';
import type { ProposalStep, ProposalEvent } from '../../types';
import { PROPOSAL_STEP_LABELS } from '../../types';
import './ProposalPipelineView.css';

interface ProposalPipelineViewProps {
  activeStep: ProposalStep | null;
  selectedStep: ProposalStep | null;
  onSelectStep: (step: ProposalStep) => void;
  isRunning: boolean;
  events: ProposalEvent[];
  /** Steps currently in-flight (started but not completed). Enables parallel spinners. */
  inProgressSteps?: Set<ProposalStep>;
}

const STEPS: ProposalStep[] = [
  'user-request',
  'customer-intake',
  'product-search',
  'pricing',
  'support-check',
  'proposal-draft',
  'final-proposal',
];

/** Step icons as inline SVGs */
const StepIcon: React.FC<{ step: ProposalStep }> = ({ step }) => {
  switch (step) {
    case 'user-request':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'customer-intake':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="16" y1="13" x2="8" y2="13" />
          <line x1="16" y1="17" x2="8" y2="17" />
          <polyline points="10 9 9 9 8 9" />
        </svg>
      );
    case 'product-search':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'pricing':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="1" x2="12" y2="23" />
          <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
        </svg>
      );
    case 'support-check':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'proposal-draft':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      );
    case 'final-proposal':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
  }
};

function isStepReached(step: ProposalStep, events: ProposalEvent[]): boolean {
  return events.some((e) => e.step === step);
}

function isStepCompleted(step: ProposalStep, events: ProposalEvent[]): boolean {
  return events.some((e) => e.step === step && e.type === 'step-complete');
}

const ProposalPipelineView: React.FC<ProposalPipelineViewProps> = ({
  activeStep,
  selectedStep,
  onSelectStep,
  isRunning,
  events,
  inProgressSteps,
}) => {
  if (!activeStep && events.length === 0) return null;

  return (
    <div className="proposal-pipeline-view">
      <div className="proposal-pipeline-label">Proposal Pipeline</div>
      <div className="proposal-pipeline-steps">
        {STEPS.map((step, idx) => {
          const isSelected = selectedStep === step;
          const reached = isStepReached(step, events);
          const completed = isStepCompleted(step, events);
          const isInProgress = inProgressSteps
            ? inProgressSteps.has(step)
            : (activeStep === step && isRunning);

          return (
            <React.Fragment key={step}>
              {idx > 0 && (
                <div className={`proposal-arrow ${reached ? 'proposal-arrow-active' : ''}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              )}
              <button
                type="button"
                className={[
                  'proposal-step',
                  isInProgress ? 'proposal-step-active' : '',
                  isSelected ? 'proposal-step-selected' : '',
                  completed ? 'proposal-step-completed' : '',
                  reached ? 'proposal-step-reached' : '',
                ].join(' ')}
                onClick={() => onSelectStep(step)}
              >
                <span className="proposal-step-icon">
                  <StepIcon step={step} />
                  {isInProgress && <span className="proposal-step-spinner" />}
                  {completed && !isInProgress && (
                    <span className="proposal-step-check">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className="proposal-step-label">{PROPOSAL_STEP_LABELS[step]}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ProposalPipelineView;
