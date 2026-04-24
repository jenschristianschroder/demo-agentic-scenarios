import React from 'react';
import type { ProposalAgentMessage } from '../../types';
import { PROPOSAL_AGENT_LABELS } from '../../types';
import './ProposalCommunicationLog.css';

interface ProposalCommunicationLogProps {
  messages: ProposalAgentMessage[];
  isRunning: boolean;
}

const typeIcons: Record<ProposalAgentMessage['type'], string> = {
  instruction: '🤖',
  finding: '🔍',
  concern: '⚠️',
  recommendation: '✅',
  handoff: '➡️',
};

const ProposalCommunicationLog: React.FC<ProposalCommunicationLogProps> = ({ messages, isRunning }) => {
  if (messages.length === 0 && !isRunning) return null;

  return (
    <div className="proposal-comm-log">
      <div className="proposal-comm-header">
        <span className="proposal-comm-title">Agent Communication</span>
        {isRunning && <span className="proposal-comm-live">LIVE</span>}
      </div>

      {messages.length === 0 && isRunning && (
        <div className="proposal-comm-waiting">Waiting for inter-agent messages…</div>
      )}

      <div className="proposal-comm-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`proposal-comm-bubble proposal-comm-${msg.type}`}>
            <div className="proposal-comm-bubble-header">
              <span className="proposal-comm-icon">{typeIcons[msg.type]}</span>
              <span className="proposal-comm-route">
                {msg.from === 'user' ? 'Customer' : PROPOSAL_AGENT_LABELS[msg.from]} → {PROPOSAL_AGENT_LABELS[msg.to]}
              </span>
              <span className={`proposal-comm-type-badge proposal-comm-type-${msg.type}`}>
                {msg.type}
              </span>
            </div>
            <div className="proposal-comm-bubble-body">
              {msg.message}
            </div>
          </div>
        ))}
      </div>

      {messages.length > 0 && !isRunning && (
        <div className="proposal-comm-explainer">
          <details>
            <summary>What's happening?</summary>
            <p>
              <strong>Multi-Agent Specialist Team</strong> — Each agent has a specific role.
              The Orchestrator routes the request through Customer Intake, Product Specialist,
              Pricing, and Support agents before handing off to the Proposal Writer. Watch
              how agents communicate findings, concerns, and recommendations to produce
              a cohesive proposal.
            </p>
          </details>
        </div>
      )}
    </div>
  );
};

export default ProposalCommunicationLog;
