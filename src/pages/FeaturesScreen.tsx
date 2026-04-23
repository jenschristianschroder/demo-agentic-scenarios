import React from 'react';
import { useNavigate } from 'react-router-dom';
import { SCENARIOS } from '../types';
import './FeaturesScreen.css';

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
            <span className="feature-card-icon">{s.icon}</span>
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
