import React from 'react';
import { useNavigate } from 'react-router-dom';
import './WelcomeScreen.css';

const WelcomeScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="welcome-screen">
      <div className="welcome-content">
        <img
          className="welcome-icon"
          src="/images/Microsoft-logo_rgb_c-gray.png"
          alt=""
          aria-hidden="true"
        />

        <h1 className="welcome-title">Multi-Agent Orchestration</h1>
        <p className="welcome-subtitle">
          Experience AI agent collaboration — an orchestrator coordinates
          content generation and fact-checking in real time.
        </p>

        <button
          className="welcome-cta"
          onClick={() => navigate('/features')}
          type="button"
        >
          Try the Demos
        </button>
      </div>

      <footer className="welcome-footer">
        Microsoft Innovation Hub Denmark
      </footer>
    </div>
  );
};

export default WelcomeScreen;
