import React from 'react';
import type {
  AgentStep,
  GeneratorOutput,
  FactCheckerOutput,
  OrchestratorDecision,
  RevisionOutput,
  RunSummary,
  IterationRecord,
} from '../../types';
import { STEP_LABELS } from '../../types';
import './StepDetail.css';

interface StepDetailProps {
  step: AgentStep;
  data: GeneratorOutput | FactCheckerOutput | OrchestratorDecision | RevisionOutput | RunSummary | { prompt: string } | null;
  iterations: IterationRecord[];
}

const StepDetail: React.FC<StepDetailProps> = ({ step, data, iterations }) => {
  if (!data) {
    return (
      <div className="step-detail">
        <div className="step-detail-header">
          <h3 className="step-detail-title">{STEP_LABELS[step]}</h3>
        </div>
        <p className="step-detail-empty">Waiting for data…</p>
      </div>
    );
  }

  return (
    <div className="step-detail">
      <div className="step-detail-header">
        <h3 className="step-detail-title">{STEP_LABELS[step]}</h3>
      </div>

      <div className="step-detail-body">
        {step === 'user-request' && 'prompt' in data && (
          <div className="detail-section">
            <span className="detail-label">Prompt</span>
            <p className="detail-text output-area">{(data as { prompt: string }).prompt}</p>
          </div>
        )}

        {step === 'generator' && 'draftText' in data && (
          <>
            <div className="detail-section">
              <span className="detail-label">
                Draft Text <span className="detail-badge">Iteration {(data as GeneratorOutput).iteration}</span>
              </span>
              <p className="detail-text output-area">{(data as GeneratorOutput).draftText}</p>
            </div>
            <div className="detail-section">
              <span className="detail-label">Extracted Claims</span>
              <div className="claims-list">
                {(data as GeneratorOutput).claims.map((claim) => (
                  <div key={claim.id} className={`claim-chip claim-${claim.status ?? 'pending'}`}>
                    <span className="claim-status-icon">
                      {claim.status === 'supported' && '✓'}
                      {claim.status === 'unsupported' && '✗'}
                      {claim.status === 'uncertain' && '?'}
                      {!claim.status && '○'}
                    </span>
                    <span className="claim-text">{claim.text}</span>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 'fact-checker' && 'verdict' in data && (
          <>
            <div className="detail-section">
              <span className="detail-label">Verdict</span>
              <div className={`verdict-badge verdict-${(data as FactCheckerOutput).verdict}`}>
                {(data as FactCheckerOutput).verdict.replace('-', ' ')}
              </div>
            </div>
            <div className="detail-section">
              <span className="detail-label">
                Score <span className="detail-badge">{((data as FactCheckerOutput).score * 100).toFixed(0)}%</span>
              </span>
              <div className="score-bar">
                <div
                  className="score-fill"
                  style={{ width: `${(data as FactCheckerOutput).score * 100}%` }}
                />
              </div>
            </div>
            <div className="detail-section">
              <span className="detail-label">Claim-by-Claim</span>
              <div className="claims-list">
                {(data as FactCheckerOutput).claims.map((claim) => (
                  <div key={claim.id} className={`claim-chip claim-${claim.status ?? 'pending'}`}>
                    <span className="claim-status-icon">
                      {claim.status === 'supported' && '✓'}
                      {claim.status === 'unsupported' && '✗'}
                      {claim.status === 'uncertain' && '?'}
                    </span>
                    <span className="claim-text">{claim.text}</span>
                    {claim.evidence && (
                      <span className="claim-evidence">{claim.evidence}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
            {(data as FactCheckerOutput).revisionInstructions && (
              <div className="detail-section">
                <span className="detail-label">Revision Instructions</span>
                <p className="detail-text detail-text-warning output-area">
                  {(data as FactCheckerOutput).revisionInstructions}
                </p>
              </div>
            )}
            {(data as FactCheckerOutput).evidenceReferences.length > 0 && (
              <div className="detail-section">
                <span className="detail-label">Evidence References</span>
                <ul className="evidence-list">
                  {(data as FactCheckerOutput).evidenceReferences.map((ref, i) => (
                    <li key={i} className="evidence-item">{ref}</li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}

        {step === 'orchestrator' && 'action' in data && (
          <>
            <div className="detail-section">
              <span className="detail-label">Decision</span>
              <div className="detail-text output-area">
                <strong>Action:</strong> {(data as OrchestratorDecision).action}
              </div>
            </div>
            <div className="detail-section">
              <span className="detail-label">Reason</span>
              <p className="detail-text output-area">{(data as OrchestratorDecision).reason}</p>
            </div>
            <div className="detail-section">
              <span className="detail-label">
                Iteration {(data as OrchestratorDecision).iteration} / {(data as OrchestratorDecision).maxIterations}
              </span>
            </div>
          </>
        )}

        {step === 'revision' && 'revisedText' in data && (
          <>
            <div className="detail-section">
              <span className="detail-label">
                Revised Text <span className="detail-badge">Iteration {(data as RevisionOutput).iteration}</span>
              </span>
              <p className="detail-text output-area">{(data as RevisionOutput).revisedText}</p>
            </div>
            <div className="detail-section">
              <span className="detail-label">Changes Applied</span>
              <ul className="changes-list">
                {(data as RevisionOutput).changesApplied.map((change, i) => (
                  <li key={i} className="change-item">{change}</li>
                ))}
              </ul>
            </div>
          </>
        )}

        {step === 'final-answer' && 'finalText' in data && (
          <div className="detail-section">
            <span className="detail-label">Final Answer</span>
            <p className="detail-text output-area">{(data as RunSummary).finalText}</p>
          </div>
        )}

        {/* Iteration history */}
        {iterations.length > 1 && (step === 'generator' || step === 'fact-checker' || step === 'revision') && (
          <div className="detail-section">
            <span className="detail-label">Iteration History</span>
            <div className="iteration-tabs">
              {iterations.map((iter) => (
                <span key={iter.iteration} className="iteration-tab">
                  #{iter.iteration}
                  {iter.factCheckerOutput && (
                    <span className={`iter-verdict iter-verdict-${iter.factCheckerOutput.verdict}`}>
                      {iter.factCheckerOutput.verdict === 'approved' ? '✓' : '↻'}
                    </span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StepDetail;
