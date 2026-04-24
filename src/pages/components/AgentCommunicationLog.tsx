import React from 'react';
import type { AgentMessage } from '../../types';
import { STEP_LABELS } from '../../types';
import './AgentCommunicationLog.css';

interface AgentCommunicationLogProps {
  messages: AgentMessage[];
  isRunning: boolean;
}

const typeIcons: Record<AgentMessage['type'], string> = {
  finding: '🔍',
  instruction: '🤖',
  confirmation: '✅',
};

const AgentCommunicationLog: React.FC<AgentCommunicationLogProps> = ({ messages, isRunning }) => {
  if (messages.length === 0 && !isRunning) return null;

  return (
    <div className="agent-comm-log">
      <div className="agent-comm-header">
        <span className="agent-comm-title">Agent Communication</span>
        {isRunning && <span className="agent-comm-live">LIVE</span>}
      </div>

      {messages.length === 0 && isRunning && (
        <div className="agent-comm-waiting">Waiting for inter-agent messages…</div>
      )}

      <div className="agent-comm-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`agent-comm-bubble agent-comm-${msg.type}`}>
            <div className="agent-comm-bubble-header">
              <span className="agent-comm-icon">{typeIcons[msg.type]}</span>
              <span className="agent-comm-route">
                {STEP_LABELS[msg.from]} → {STEP_LABELS[msg.to]}
              </span>
              <span className={`agent-comm-type-badge agent-comm-type-${msg.type}`}>
                {msg.type}
              </span>
            </div>
            <div className="agent-comm-bubble-body">
              {msg.message}
            </div>
          </div>
        ))}
      </div>

      {messages.length > 0 && !isRunning && (
        <div className="agent-comm-explainer">
          <details>
            <summary>What's happening?</summary>
            <p>
              <strong>Grounding &amp; Hallucination Detection</strong> — The user asked for claims the
              catalog doesn't support. The Generator hallucinated plausible-sounding specs. The Fact-Checker
              caught these by comparing against the real product catalog. The Revision Agent replaced them
              with verified facts. The loop continued until every claim was grounded in evidence.
            </p>
          </details>
        </div>
      )}
    </div>
  );
};

export default AgentCommunicationLog;
