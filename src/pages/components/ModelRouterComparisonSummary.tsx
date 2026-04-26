import React from 'react';
import type { ModelRouterResult } from '../../types';
import './ModelRouterComparisonSummary.css';

interface Props {
  results: Record<string, ModelRouterResult | null>;
}

const ModelRouterComparisonSummary: React.FC<Props> = ({ results }) => {
  const balanced = results['balanced'];
  const quality = results['quality'];
  const cost = results['cost'];

  // Only show when all three results are available
  if (!balanced || !quality || !cost) return null;

  const all = [
    { mode: 'Balanced', icon: '⚖️', r: balanced },
    { mode: 'Quality', icon: '🏆', r: quality },
    { mode: 'Cost', icon: '💰', r: cost },
  ];

  const fastest = all.reduce((a, b) => (a.r.latencyMs < b.r.latencyMs ? a : b));
  const cheapest = all.reduce((a, b) =>
    (a.r.promptTokens + a.r.completionTokens) < (b.r.promptTokens + b.r.completionTokens) ? a : b
  );

  return (
    <div className="mr-comparison">
      <div className="mr-comparison-header">Comparison Summary</div>
      <table className="mr-comparison-table">
        <thead>
          <tr>
            <th>Metric</th>
            {all.map((a) => (
              <th key={a.mode}>
                {a.icon} {a.mode}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="mr-comparison-metric">Model</td>
            {all.map((a) => (
              <td key={a.mode} className="mr-comparison-value mr-comparison-model">{a.r.modelUsed}</td>
            ))}
          </tr>
          <tr>
            <td className="mr-comparison-metric">Latency</td>
            {all.map((a) => (
              <td
                key={a.mode}
                className={`mr-comparison-value ${a === fastest ? 'mr-comparison-best' : ''}`}
              >
                {formatLatency(a.r.latencyMs)}
                {a === fastest && <span className="mr-comparison-badge">Fastest</span>}
              </td>
            ))}
          </tr>
          <tr>
            <td className="mr-comparison-metric">Prompt Tokens</td>
            {all.map((a) => (
              <td key={a.mode} className="mr-comparison-value">{a.r.promptTokens}</td>
            ))}
          </tr>
          <tr>
            <td className="mr-comparison-metric">Completion Tokens</td>
            {all.map((a) => (
              <td key={a.mode} className="mr-comparison-value">{a.r.completionTokens}</td>
            ))}
          </tr>
          <tr>
            <td className="mr-comparison-metric">Total Tokens</td>
            {all.map((a) => (
              <td
                key={a.mode}
                className={`mr-comparison-value ${a === cheapest ? 'mr-comparison-best' : ''}`}
              >
                {a.r.promptTokens + a.r.completionTokens}
                {a === cheapest && <span className="mr-comparison-badge">Fewest</span>}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
};

function formatLatency(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

export default ModelRouterComparisonSummary;
