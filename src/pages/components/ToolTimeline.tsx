import React, { useState } from 'react';
import type { ToolCallRecord, CombinedTimelineItem } from '../../types';
import './ToolTimeline.css';

interface ToolTimelineProps {
  toolCalls: ToolCallRecord[];
  pendingToolCall: { toolName: string; arguments: Record<string, unknown> } | null;
  combinedItems?: CombinedTimelineItem[];
}

const ToolTimeline: React.FC<ToolTimelineProps> = ({ toolCalls, pendingToolCall, combinedItems }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const hasCombined = combinedItems && combinedItems.length > 0;
  if (!hasCombined && toolCalls.length === 0 && !pendingToolCall) return null;

  const toolCallCount = combinedItems
    ? combinedItems.filter((i) => i.kind === 'tool-call').length
    : toolCalls.length;

  return (
    <div className="tool-timeline">
      <div className="tool-timeline-label">
        Tool Execution Timeline
        <span className="tool-timeline-count">{toolCallCount}</span>
      </div>
      <div className="tool-timeline-list">
        {hasCombined ? (
          <>
            {combinedItems.map((item, idx) => {
              if (item.kind === 'reasoning') {
                const reasoningIndex = combinedItems.slice(0, idx + 1).filter((i) => i.kind === 'reasoning').length;
                return (
                  <div key={item.id} className="tool-call-card tool-reasoning-card">
                    <div className="tool-reasoning-header">
                      <span className="tool-reasoning-icon">💭</span>
                      <span className="tool-reasoning-label">Agent Reasoning</span>
                      <span className="tool-reasoning-seq">#{reasoningIndex}</span>
                    </div>
                    <p className="tool-reasoning-text">{item.text}</p>
                  </div>
                );
              }
              // tool-call item
              const tc = item.record;
              const isExpanded = expandedId === tc.id;
              const toolCallIndex = combinedItems.slice(0, idx + 1).filter((i) => i.kind === 'tool-call').length;
              return (
                <div key={tc.id} className="tool-call-card tool-call-card-complete">
                  <div
                    className="tool-call-header"
                    onClick={() => setExpandedId(isExpanded ? null : tc.id)}
                  >
                    <div className="tool-call-rank">#{toolCallIndex}</div>
                    <div className="tool-call-meta">
                      <span className="tool-call-name">{formatToolName(tc.toolName)}</span>
                      <span className="tool-call-args-preview">
                        {formatArgsPreview(tc.arguments)}
                      </span>
                    </div>
                    <div className="tool-call-timing">
                      <span className="tool-call-duration">{tc.durationMs}ms</span>
                    </div>
                    <svg
                      className={`tool-call-chevron ${isExpanded ? 'tool-call-chevron-open' : ''}`}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  {isExpanded && (
                    <div className="tool-call-body">
                      <div className="tool-call-section">
                        <span className="tool-call-section-label">Arguments</span>
                        <pre className="tool-call-json">{JSON.stringify(tc.arguments, null, 2)}</pre>
                      </div>
                      <div className="tool-call-section">
                        <span className="tool-call-section-label">Result</span>
                        <pre className="tool-call-json">{JSON.stringify(tc.result, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        ) : (
          <>
            {toolCalls.map((tc, idx) => {
              const isExpanded = expandedId === tc.id;
              return (
                <div key={tc.id} className="tool-call-card tool-call-card-complete">
                  <div
                    className="tool-call-header"
                    onClick={() => setExpandedId(isExpanded ? null : tc.id)}
                  >
                    <div className="tool-call-rank">#{idx + 1}</div>
                    <div className="tool-call-meta">
                      <span className="tool-call-name">{formatToolName(tc.toolName)}</span>
                      <span className="tool-call-args-preview">
                        {formatArgsPreview(tc.arguments)}
                      </span>
                    </div>
                    <div className="tool-call-timing">
                      <span className="tool-call-duration">{tc.durationMs}ms</span>
                    </div>
                    <svg
                      className={`tool-call-chevron ${isExpanded ? 'tool-call-chevron-open' : ''}`}
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </div>
                  {isExpanded && (
                    <div className="tool-call-body">
                      <div className="tool-call-section">
                        <span className="tool-call-section-label">Arguments</span>
                        <pre className="tool-call-json">{JSON.stringify(tc.arguments, null, 2)}</pre>
                      </div>
                      <div className="tool-call-section">
                        <span className="tool-call-section-label">Result</span>
                        <pre className="tool-call-json">{JSON.stringify(tc.result, null, 2)}</pre>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* Pending tool call (loading state) */}
        {pendingToolCall && (
          <div className="tool-call-card tool-call-card-pending">
            <div className="tool-call-header">
              <div className="tool-call-rank">#{toolCallCount + 1}</div>
              <div className="tool-call-meta">
                <span className="tool-call-name">{formatToolName(pendingToolCall.toolName)}</span>
                <span className="tool-call-args-preview">
                  {formatArgsPreview(pendingToolCall.arguments)}
                </span>
              </div>
              <div className="tool-call-timing">
                <span className="tool-call-loading">
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                  <span className="loading-dot" />
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

function formatToolName(name: string): string {
  return name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatArgsPreview(args: Record<string, unknown>): string {
  const parts = Object.entries(args)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(', ');
  return parts.length > 80 ? parts.slice(0, 77) + '...' : parts;
}

export default ToolTimeline;
