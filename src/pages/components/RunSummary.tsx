import React from 'react';
import type { RunSummary } from '../../types';
import './RunSummary.css';

interface RunSummaryPanelProps {
  summary: RunSummary;
}

const RunSummaryPanel: React.FC<RunSummaryPanelProps> = ({ summary }) => {
  return (
    <div className="run-summary">
      <div className="run-summary-label">Run Summary</div>
      <div className="run-summary-stats">
        <div className="stat-card">
          <span className="stat-value">{summary.draftCount}</span>
          <span className="stat-label">Drafts</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{summary.claimsChecked}</span>
          <span className="stat-label">Claims Checked</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{summary.unsupportedClaims}</span>
          <span className="stat-label">Unsupported</span>
        </div>
        <div className={`stat-card stat-card-status stat-card-${summary.finalStatus}`}>
          <span className="stat-value stat-status-icon">
            {summary.finalStatus === 'approved' && '✓'}
            {summary.finalStatus === 'rejected' && '✗'}
            {summary.finalStatus === 'review' && '⚠'}
          </span>
          <span className="stat-label">{summary.finalStatus}</span>
        </div>
      </div>

      {/* Final text preview */}
      <div className="run-summary-final">
        <span className="run-summary-final-label">Final Output</span>
        <p className="run-summary-final-text output-area">{summary.finalText}</p>
      </div>
    </div>
  );
};

export default RunSummaryPanel;
