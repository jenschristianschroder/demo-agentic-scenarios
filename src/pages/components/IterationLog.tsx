import React from 'react';
import type { IterationRecord } from '../../types';
import './IterationLog.css';

interface IterationLogProps {
  iterations: IterationRecord[];
  isRunning: boolean;
}

const IterationLog: React.FC<IterationLogProps> = ({ iterations, isRunning }) => {
  if (iterations.length === 0) return null;

  return (
    <div className="iteration-log">
      <div className="iteration-log-label">
        Iteration Log
        {isRunning && <span className="iteration-log-live">LIVE</span>}
      </div>
      <div className="iteration-log-entries">
        {iterations.map((iter) => (
          <div key={iter.iteration} className="iteration-entry">
            <div className="iteration-entry-header">
              <span className="iteration-number">Iteration {iter.iteration}</span>
              {iter.factCheckerOutput && (
                <span className={`iteration-verdict iteration-verdict-${iter.factCheckerOutput.verdict}`}>
                  {iter.factCheckerOutput.verdict === 'approved' && '✓ Approved'}
                  {iter.factCheckerOutput.verdict === 'needs-revision' && '↻ Needs Revision'}
                  {iter.factCheckerOutput.verdict === 'rejected' && '✗ Rejected'}
                </span>
              )}
              {!iter.factCheckerOutput && isRunning && (
                <span className="iteration-pending">Processing…</span>
              )}
            </div>

            {/* Generator output */}
            <div className="iteration-section">
              <span className="iteration-section-label">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 20h9" />
                  <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
                Generator Draft
              </span>
              <p className="iteration-text">{iter.generatorOutput.draftText}</p>
              <div className="iteration-claims">
                {iter.generatorOutput.claims.map((claim) => (
                  <span
                    key={claim.id}
                    className={`iteration-claim iteration-claim-${claim.status ?? 'pending'}`}
                  >
                    {claim.status === 'supported' && '✓ '}
                    {claim.status === 'unsupported' && '✗ '}
                    {claim.status === 'uncertain' && '? '}
                    {!claim.status && '○ '}
                    {claim.text}
                  </span>
                ))}
              </div>
            </div>

            {/* Fact-checker output */}
            {iter.factCheckerOutput && (
              <div className="iteration-section">
                <span className="iteration-section-label">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <polyline points="22 4 12 14.01 9 11.01" />
                  </svg>
                  Fact-Check Result
                  <span className="iteration-score">
                    {(iter.factCheckerOutput.score * 100).toFixed(0)}%
                  </span>
                </span>
                <div className="iteration-score-bar">
                  <div
                    className="iteration-score-fill"
                    style={{ width: `${iter.factCheckerOutput.score * 100}%` }}
                  />
                </div>
                <div className="iteration-claims">
                  {iter.factCheckerOutput.claims.map((claim) => (
                    <span
                      key={claim.id}
                      className={`iteration-claim iteration-claim-${claim.status ?? 'pending'}`}
                    >
                      {claim.status === 'supported' && '✓ '}
                      {claim.status === 'unsupported' && '✗ '}
                      {claim.status === 'uncertain' && '? '}
                      {claim.text}
                      {claim.evidence && (
                        <span className="iteration-claim-evidence"> — {claim.evidence}</span>
                      )}
                    </span>
                  ))}
                </div>
                {iter.factCheckerOutput.revisionInstructions && (
                  <div className="iteration-revision">
                    <span className="iteration-revision-label">Revision instructions:</span>
                    {iter.factCheckerOutput.revisionInstructions}
                  </div>
                )}
              </div>
            )}

            {/* Orchestrator decision */}
            {iter.orchestratorDecision && (
              <div className="iteration-decision">
                <strong>{iter.orchestratorDecision.action}</strong>: {iter.orchestratorDecision.reason}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default IterationLog;
