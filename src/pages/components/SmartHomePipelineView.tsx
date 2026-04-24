import React from 'react';
import type { SmartHomeStep, SmartHomeEvent } from '../../types';
import { SMART_HOME_STEP_LABELS } from '../../types';
import './SmartHomePipelineView.css';

interface SmartHomePipelineViewProps {
  activeStep: SmartHomeStep | null;
  selectedStep: SmartHomeStep | null;
  onSelectStep: (step: SmartHomeStep) => void;
  isRunning: boolean;
  events: SmartHomeEvent[];
  inProgressSteps?: Set<SmartHomeStep>;
}

const STEPS: SmartHomeStep[] = [
  'user-request',
  'needs-analysis',
  'device-recommendation',
  'privacy-review',
  'compatibility-check',
  'bundle-assembly',
  'final-bundle',
];

const StepIcon: React.FC<{ step: SmartHomeStep }> = ({ step }) => {
  switch (step) {
    case 'user-request':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'needs-analysis':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      );
    case 'device-recommendation':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
          <line x1="8" y1="21" x2="16" y2="21" />
          <line x1="12" y1="17" x2="12" y2="21" />
        </svg>
      );
    case 'privacy-review':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
    case 'compatibility-check':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="16 18 22 12 16 6" />
          <polyline points="8 6 2 12 8 18" />
          <line x1="14" y1="4" x2="10" y2="20" />
        </svg>
      );
    case 'bundle-assembly':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
          <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
          <line x1="12" y1="22.08" x2="12" y2="12" />
        </svg>
      );
    case 'final-bundle':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
  }
};

function isStepReached(step: SmartHomeStep, events: SmartHomeEvent[]): boolean {
  return events.some((e) => e.step === step);
}

function isStepCompleted(step: SmartHomeStep, events: SmartHomeEvent[]): boolean {
  return events.some((e) => e.step === step && e.type === 'step-complete');
}

const SmartHomePipelineView: React.FC<SmartHomePipelineViewProps> = ({
  activeStep,
  selectedStep,
  onSelectStep,
  isRunning,
  events,
  inProgressSteps,
}) => {
  if (!activeStep && events.length === 0) return null;

  return (
    <div className="sh-pipeline-view">
      <div className="sh-pipeline-label">Bundle Builder Pipeline</div>
      <div className="sh-pipeline-steps">
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
                <div className={`sh-arrow ${reached ? 'sh-arrow-active' : ''}`}>
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              )}
              <button
                type="button"
                className={[
                  'sh-step',
                  isInProgress ? 'sh-step-active' : '',
                  isSelected ? 'sh-step-selected' : '',
                  completed ? 'sh-step-completed' : '',
                  reached ? 'sh-step-reached' : '',
                ].join(' ')}
                onClick={() => onSelectStep(step)}
              >
                <span className="sh-step-icon">
                  <StepIcon step={step} />
                  {isInProgress && <span className="sh-step-spinner" />}
                  {completed && !isInProgress && (
                    <span className="sh-step-check">
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className="sh-step-label">{SMART_HOME_STEP_LABELS[step]}</span>
              </button>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default SmartHomePipelineView;
