import React from 'react';
import ReactMarkdown from 'react-markdown';
import type { ModelRouterResult, ModelRouterRoutingMode } from '../../types';
import './ModelRouterResultCard.css';

const MODE_META: Record<ModelRouterRoutingMode, { icon: string; label: string; color: string }> = {
  balanced: { icon: '⚖️', label: 'Balanced', color: '#1565c0' },
  quality: { icon: '🏆', label: 'Quality', color: '#2e7d32' },
  cost: { icon: '💰', label: 'Cost', color: '#e65100' },
};

interface Props {
  mode: ModelRouterRoutingMode;
  result: ModelRouterResult | null;
  isLoading: boolean;
  error: string | null;
}

const ModelRouterResultCard: React.FC<Props> = ({ mode, result, isLoading, error }) => {
  const meta = MODE_META[mode];

  return (
    <div className={`mr-result-card mr-result-card-${mode}`}>
      <div className="mr-result-card-header" style={{ borderBottomColor: meta.color }}>
        <span className="mr-result-card-icon">{meta.icon}</span>
        <span className="mr-result-card-label">{meta.label}</span>
      </div>

      <div className="mr-result-card-body">
        {isLoading && (
          <div className="mr-result-loading">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
          </div>
        )}

        {error && <div className="mr-result-error">{error}</div>}

        {result && !isLoading && (
          <>
            <div className="mr-result-meta">
              <div className="mr-result-meta-item">
                <span className="mr-meta-label">Model</span>
                <span className="mr-meta-value mr-meta-model">{result.modelUsed}</span>
              </div>
              <div className="mr-result-meta-item">
                <span className="mr-meta-label">Latency</span>
                <span className="mr-meta-value">{formatLatency(result.latencyMs)}</span>
              </div>
              <div className="mr-result-meta-item">
                <span className="mr-meta-label">Tokens</span>
                <span className="mr-meta-value">
                  {result.promptTokens} + {result.completionTokens} = {result.promptTokens + result.completionTokens}
                </span>
              </div>
            </div>

            <div className="mr-result-response">
              <ReactMarkdown>{result.responseText}</ReactMarkdown>
            </div>
          </>
        )}

        {!result && !isLoading && !error && (
          <div className="mr-result-placeholder">Run a prompt to see results</div>
        )}
      </div>
    </div>
  );
};

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default ModelRouterResultCard;
