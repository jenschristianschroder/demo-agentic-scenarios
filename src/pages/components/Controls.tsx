import React from 'react';
import type { WorkflowMode } from '../../types';
import './Controls.css';

interface ControlsProps {
  prompt: string;
  onPromptChange: (v: string) => void;
  creativityLevel: number;
  onCreativityChange: (v: number) => void;
  workflowMode: WorkflowMode;
  onWorkflowModeChange: (v: WorkflowMode) => void;
  acceptanceThreshold: number;
  onAcceptanceThresholdChange: (v: number) => void;
  maxIterations: number;
  onMaxIterationsChange: (v: number) => void;
  onRun: () => void;
  isRunning: boolean;
}

const Controls: React.FC<ControlsProps> = ({
  prompt,
  onPromptChange,
  creativityLevel,
  onCreativityChange,
  workflowMode,
  onWorkflowModeChange,
  acceptanceThreshold,
  onAcceptanceThresholdChange,
  maxIterations,
  onMaxIterationsChange,
  onRun,
  isRunning,
}) => {
  return (
    <div className="controls-panel">
      {/* Prompt input */}
      <div className="control-group">
        <label className="control-label" htmlFor="prompt-input">
          Prompt
        </label>
        <textarea
          id="prompt-input"
          className="control-textarea"
          value={prompt}
          onChange={(e) => onPromptChange(e.target.value)}
          placeholder="Ask a factual question, e.g. 'Write a short summary of Denmark's renewable energy achievements'"
          disabled={isRunning}
          rows={3}
        />
      </div>

      {/* Settings row */}
      <div className="controls-row">
        {/* Creativity level */}
        <div className="control-group control-group-half">
          <label className="control-label" htmlFor="creativity-slider">
            Creativity <span className="control-value">{creativityLevel.toFixed(1)}</span>
          </label>
          <input
            id="creativity-slider"
            type="range"
            className="control-slider"
            min={0}
            max={1}
            step={0.1}
            value={creativityLevel}
            onChange={(e) => onCreativityChange(parseFloat(e.target.value))}
            disabled={isRunning}
          />
          <div className="slider-labels">
            <span>Precise</span>
            <span>Creative</span>
          </div>
        </div>

        {/* Acceptance threshold */}
        <div className="control-group control-group-half">
          <label className="control-label" htmlFor="threshold-slider">
            Threshold <span className="control-value">{acceptanceThreshold.toFixed(1)}</span>
          </label>
          <input
            id="threshold-slider"
            type="range"
            className="control-slider"
            min={0}
            max={1}
            step={0.1}
            value={acceptanceThreshold}
            onChange={(e) => onAcceptanceThresholdChange(parseFloat(e.target.value))}
            disabled={isRunning}
          />
          <div className="slider-labels">
            <span>Lenient</span>
            <span>Strict</span>
          </div>
        </div>
      </div>

      {/* Workflow mode + max iterations */}
      <div className="controls-row">
        <div className="control-group control-group-flex">
          <span className="control-label">Workflow Mode</span>
          <div className="mode-toggle">
            <button
              type="button"
              className={`mode-btn ${workflowMode === 'review-after-first' ? 'mode-btn-active' : ''}`}
              onClick={() => onWorkflowModeChange('review-after-first')}
              disabled={isRunning}
            >
              Review after first
            </button>
            <button
              type="button"
              className={`mode-btn ${workflowMode === 'auto-revise' ? 'mode-btn-active' : ''}`}
              onClick={() => onWorkflowModeChange('auto-revise')}
              disabled={isRunning}
            >
              Auto-revise
            </button>
          </div>
        </div>

        <div className="control-group control-group-narrow">
          <label className="control-label" htmlFor="max-iter">
            Max Iterations
          </label>
          <select
            id="max-iter"
            className="control-select"
            value={maxIterations}
            onChange={(e) => onMaxIterationsChange(parseInt(e.target.value, 10))}
            disabled={isRunning}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Run button */}
      <button
        type="button"
        className="run-btn"
        onClick={onRun}
        disabled={isRunning || !prompt.trim()}
      >
        {isRunning ? (
          <span className="run-btn-loading">
            <span className="loading-dot" />
            <span className="loading-dot" />
            <span className="loading-dot" />
            Running
          </span>
        ) : (
          'Run Orchestration'
        )}
      </button>
    </div>
  );
};

export default Controls;
