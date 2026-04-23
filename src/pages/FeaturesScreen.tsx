import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SCENARIOS } from '../types';
import type { ScenarioId } from '../types';
import './FeaturesScreen.css';

const ScenarioIcon: React.FC<{ id: ScenarioId }> = ({ id }) => {
  switch (id) {
    case 'multi-agent-orchestration':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
        </svg>
      );
    case 'rag-pipeline':
      return (
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="8" y1="7" x2="16" y2="7" />
          <line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      );
  }
};

const FeaturesScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="features-container">
      <h1 className="features-title">Demos</h1>
      <p className="features-subtitle">Select a scenario to explore</p>
      <div className="features-list">
        {SCENARIOS.map((s) => (
          <div
            key={s.id}
            className="feature-card"
            onClick={() => navigate(s.route)}
          >
            <span className="feature-card-icon">
              <ScenarioIcon id={s.id} />
            </span>
            <div className="feature-card-text">
              <span className="feature-card-label">{s.label}</span>
              <span className="feature-card-desc">{s.description}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FeaturesScreen;
