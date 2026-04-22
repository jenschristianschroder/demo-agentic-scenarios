import React from 'react';
import type { AgentStep, IterationRecord, OrchestrationEvent } from '../../types';
import { STEP_LABELS } from '../../types';
import './OrchestrationView.css';

interface OrchestrationViewProps {
  activeStep: AgentStep | null;
  selectedStep: AgentStep | null;
  onSelectStep: (step: AgentStep) => void;
  iterations: IterationRecord[];
  isRunning: boolean;
  events: OrchestrationEvent[];
}

const STEPS: AgentStep[] = [
  'user-request',
  'orchestrator',
  'generator',
  'fact-checker',
  'final-answer',
];

/** Step icons as inline SVGs */
const StepIcon: React.FC<{ step: AgentStep }> = ({ step }) => {
  switch (step) {
    case 'user-request':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'orchestrator':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
      );
    case 'generator':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      );
    case 'fact-checker':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
          <polyline points="22 4 12 14.01 9 11.01" />
        </svg>
      );
    case 'final-answer':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
          <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
        </svg>
      );
  }
};

/** Determine if a step has been reached */
function isStepReached(step: AgentStep, events: OrchestrationEvent[]): boolean {
  return events.some((e) => e.step === step);
}

/** Determine if a step is completed */
function isStepCompleted(step: AgentStep, events: OrchestrationEvent[]): boolean {
  return events.some((e) => e.step === step && e.type === 'step-complete');
}

/** Check if there is a retry loop (generator ran more than once) */
function hasRetry(iterations: IterationRecord[]): boolean {
  return iterations.length > 1;
}

const OrchestrationView: React.FC<OrchestrationViewProps> = ({
  activeStep,
  selectedStep,
  onSelectStep,
  iterations,
  isRunning,
  events,
}) => {
  if (!activeStep && events.length === 0) return null;

  return (
    <div className="orchestration-view">
      <div className="orch-label">Orchestration Flow</div>
      <div className="orch-steps">
        {STEPS.map((step, idx) => {
          const isActive = activeStep === step;
          const isSelected = selectedStep === step;
          const reached = isStepReached(step, events);
          const completed = isStepCompleted(step, events);

          return (
            <React.Fragment key={step}>
              {idx > 0 && (
                <div className={`orch-arrow ${reached ? 'orch-arrow-active' : ''}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              )}
              <button
                type="button"
                className={[
                  'orch-step',
                  isActive ? 'orch-step-active' : '',
                  isSelected ? 'orch-step-selected' : '',
                  completed ? 'orch-step-completed' : '',
                  reached ? 'orch-step-reached' : '',
                ].join(' ')}
                onClick={() => onSelectStep(step)}
              >
                <span className="orch-step-icon">
                  <StepIcon step={step} />
                  {isActive && isRunning && <span className="orch-step-pulse" />}
                </span>
                <span className="orch-step-label">{STEP_LABELS[step]}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      {/* Retry indicator */}
      {hasRetry(iterations) && (
        <div className="orch-retry-indicator">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          <span>Revision loop: {iterations.length} iteration{iterations.length > 1 ? 's' : ''}</span>
        </div>
      )}
    </div>
  );
};

export default OrchestrationView;
