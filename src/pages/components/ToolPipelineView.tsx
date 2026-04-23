import React from 'react';
import type { ToolStep, ToolEvent } from '../../types';
import { TOOL_STEP_LABELS } from '../../types';
import './ToolPipelineView.css';

interface ToolPipelineViewProps {
  activeStep: ToolStep | null;
  isRunning: boolean;
  events: ToolEvent[];
  toolCallCount: number;
}

const STEPS: ToolStep[] = ['user-request', 'reasoning', 'tool-call', 'final-answer'];

const StepIcon: React.FC<{ step: ToolStep }> = ({ step }) => {
  switch (step) {
    case 'user-request':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
      );
    case 'reasoning':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case 'tool-call':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
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

function isStepReached(step: ToolStep, events: ToolEvent[]): boolean {
  return events.some((e) => e.step === step);
}

function isStepCompleted(step: ToolStep, events: ToolEvent[]): boolean {
  if (step === 'tool-call') {
    // Tool calls are "completed" when we have at least one completed call
    return events.some((e) => e.step === step && e.type === 'tool-call-complete');
  }
  return events.some((e) => e.step === step && e.type === 'step-complete');
}

const ToolPipelineView: React.FC<ToolPipelineViewProps> = ({
  activeStep,
  isRunning,
  events,
  toolCallCount,
}) => {
  if (!activeStep && events.length === 0) return null;

  return (
    <div className="tool-pipeline-view">
      <div className="tool-pipeline-label">Agent Pipeline</div>
      <div className="tool-pipeline-steps">
        {STEPS.map((step, idx) => {
          const isActive = activeStep === step;
          const reached = isStepReached(step, events);
          const completed = isStepCompleted(step, events);

          return (
            <React.Fragment key={step}>
              {idx > 0 && (
                <div className={`tool-arrow ${reached ? 'tool-arrow-active' : ''}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              )}
              <div
                className={[
                  'tool-step',
                  isActive ? 'tool-step-active' : '',
                  completed ? 'tool-step-completed' : '',
                  reached ? 'tool-step-reached' : '',
                ].join(' ')}
              >
                <span className="tool-step-icon">
                  <StepIcon step={step} />
                  {isActive && isRunning && <span className="tool-step-pulse" />}
                </span>
                <span className="tool-step-label">{TOOL_STEP_LABELS[step]}</span>
                {step === 'tool-call' && toolCallCount > 0 && (
                  <span className="tool-step-count">{toolCallCount}</span>
                )}
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default ToolPipelineView;
