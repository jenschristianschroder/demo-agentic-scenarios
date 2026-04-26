import React from 'react';
import type { SmartHomeAgentMessage } from '../../types';
import { SMART_HOME_AGENT_LABELS } from '../../types';
import './SmartHomeCommunicationLog.css';

interface SmartHomeCommunicationLogProps {
  messages: SmartHomeAgentMessage[];
  isRunning: boolean;
}

const typeIcons: Record<SmartHomeAgentMessage['type'], string> = {
  instruction: '🤖',
  finding: '🔍',
  concern: '⚠️',
  approval: '✅',
  condition: '⚡',
  recommendation: '📦',
  handoff: '➡️',
  objection: '🚫',
};

const SmartHomeCommunicationLog: React.FC<SmartHomeCommunicationLogProps> = ({ messages, isRunning }) => {
  if (messages.length === 0 && !isRunning) return null;

  return (
    <div className="sh-comm-log">
      <div className="sh-comm-header">
        <span className="sh-comm-title">Agent Communication</span>
        {isRunning && <span className="sh-comm-live">LIVE</span>}
      </div>

      {messages.length === 0 && isRunning && (
        <div className="sh-comm-waiting">Waiting for inter-agent messages…</div>
      )}

      <div className="sh-comm-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`sh-comm-bubble sh-comm-${msg.type}`}>
            <div className="sh-comm-bubble-header">
              <span className="sh-comm-icon">{typeIcons[msg.type]}</span>
              <span className="sh-comm-route">
                {msg.from === 'user' ? 'Customer' : SMART_HOME_AGENT_LABELS[msg.from]} → {SMART_HOME_AGENT_LABELS[msg.to]}
              </span>
              <span className={`sh-comm-type-badge sh-comm-type-${msg.type}`}>
                {msg.type}
              </span>
            </div>
            <div className="sh-comm-bubble-body">
              {msg.message}
            </div>
          </div>
        ))}
      </div>

      {messages.length > 0 && !isRunning && (
        <div className="sh-comm-explainer">
          <details>
            <summary>What's happening?</summary>
            <p>
              <strong>Multi-Agent Communication with Approvals &amp; Conditions</strong> — 
              Agents don't just pass data — they negotiate. The Device Agent proposes
              candidates, the Privacy Agent can approve, conditionally approve, or reject
              them. The Compatibility Agent verifies protocol support before the Bundle
              Agent finalizes the setup plan. Watch for approvals, conditions, and objections
              between agents.
            </p>
          </details>
        </div>
      )}
    </div>
  );
};

export default SmartHomeCommunicationLog;
