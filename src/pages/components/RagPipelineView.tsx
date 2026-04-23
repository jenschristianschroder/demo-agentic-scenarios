import React from 'react';
import type { RagStep, RagEvent } from '../../types';
import { RAG_STEP_LABELS } from '../../types';
import './RagPipelineView.css';

interface RagPipelineViewProps {
  activeStep: RagStep | null;
  ragEnabled: boolean;
  isRunning: boolean;
  events: RagEvent[];
}

const STEPS: RagStep[] = ['user-request', 'retrieval', 'generation', 'final-answer'];

const StepIcon: React.FC<{ step: RagStep }> = ({ step }) => {
  switch (step) {
    case 'user-request':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'retrieval':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
        </svg>
      );
    case 'generation':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
        </svg>
      );
    case 'final-answer':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      );
  }
};

function isStepReached(step: RagStep, events: RagEvent[]): boolean {
  return events.some((e) => e.step === step);
}

function isStepCompleted(step: RagStep, events: RagEvent[]): boolean {
  return events.some((e) => e.step === step && e.type === 'step-complete');
}

const RagPipelineView: React.FC<RagPipelineViewProps> = ({
  activeStep,
  ragEnabled,
  isRunning,
  events,
}) => {
  if (!activeStep && events.length === 0) return null;

  return (
    <div className="rag-pipeline-view">
      <div className="rag-pipeline-label">RAG Pipeline</div>
      <div className="rag-pipeline-steps">
        {STEPS.map((step, idx) => {
          const isActive = activeStep === step;
          const reached = isStepReached(step, events);
          const completed = isStepCompleted(step, events);
          const isSkipped = step === 'retrieval' && !ragEnabled;

          return (
            <React.Fragment key={step}>
              {idx > 0 && (
                <div className={`rag-arrow ${reached || isSkipped ? 'rag-arrow-active' : ''}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              )}
              <div
                className={[
                  'rag-step',
                  isActive ? 'rag-step-active' : '',
                  completed ? 'rag-step-completed' : '',
                  reached ? 'rag-step-reached' : '',
                  isSkipped ? 'rag-step-skipped' : '',
                ].join(' ')}
              >
                <span className="rag-step-icon">
                  <StepIcon step={step} />
                  {isActive && isRunning && <span className="rag-step-pulse" />}
                </span>
                <span className="rag-step-label">{RAG_STEP_LABELS[step]}</span>
                {isSkipped && <span className="rag-step-skip-badge">OFF</span>}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default RagPipelineView;
