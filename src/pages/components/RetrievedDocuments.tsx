import React, { useState } from 'react';
import type { RetrievalResult } from '../../types';
import './RetrievedDocuments.css';

interface RetrievedDocumentsProps {
  documents: RetrievalResult[];
  ragEnabled: boolean;
  isLoading: boolean;
}

const RetrievedDocuments: React.FC<RetrievedDocumentsProps> = ({
  documents,
  ragEnabled,
  isLoading,
}) => {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  if (!ragEnabled) {
    return (
      <div className="retrieved-docs">
        <div className="retrieved-docs-label">Retrieved Documents</div>
        <div className="retrieved-docs-empty">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#cccccc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
            <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
            <line x1="9" y1="10" x2="15" y2="16" />
            <line x1="15" y1="10" x2="9" y2="16" />
          </svg>
          <span>RAG disabled — no documents retrieved</span>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="retrieved-docs">
        <div className="retrieved-docs-label">Retrieved Documents</div>
        <div className="retrieved-docs-loading">
          <span className="loading-dot" />
          <span className="loading-dot" />
          <span className="loading-dot" />
        </div>
      </div>
    );
  }

  if (documents.length === 0) {
    return null;
  }

  return (
    <div className="retrieved-docs">
      <div className="retrieved-docs-label">
        Retrieved Documents
        <span className="retrieved-docs-count">{documents.length}</span>
      </div>
      <div className="retrieved-docs-list">
        {documents.map((doc, idx) => {
          const isExpanded = expandedIdx === idx;
          const scorePercent = Math.round(doc.score * 100);

          return (
            <div key={idx} className="doc-card">
              <div className="doc-card-header" onClick={() => setExpandedIdx(isExpanded ? null : idx)}>
                <div className="doc-card-meta">
                  <span className="doc-card-rank">#{idx + 1}</span>
                  <span className="doc-card-title">{doc.title || doc.source}</span>
                </div>
                <div className="doc-card-score-area">
                  <div className="doc-card-score-bar">
                    <div
                      className="doc-card-score-fill"
                      style={{ width: `${scorePercent}%` }}
                    />
                  </div>
                  <span className="doc-card-score-text">{scorePercent}%</span>
                </div>
                <svg
                  className={`doc-card-chevron ${isExpanded ? 'doc-card-chevron-open' : ''}`}
                  width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
              {isExpanded && (
                <div className="doc-card-body">
                  <div className="doc-card-source">
                    <span className="doc-card-source-label">Source:</span> {doc.source}
                  </div>
                  <p className="doc-card-content output-area">{doc.content}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default RetrievedDocuments;
