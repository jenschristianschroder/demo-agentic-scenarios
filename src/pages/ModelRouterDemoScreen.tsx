import React, { useState, useCallback } from 'react';
import type { ModelRouterResult, ModelRouterRoutingMode, ModelRouterEvent } from '../types';
import { runModelRouter } from '../services/modelRouterApi';
import ModelRouterResultCard from './components/ModelRouterResultCard';
import ModelRouterComparisonSummary from './components/ModelRouterComparisonSummary';
import './ModelRouterDemoScreen.css';

const ROUTING_MODES: ModelRouterRoutingMode[] = ['balanced', 'quality', 'cost'];

const PRESET_PROMPTS = [
  {
    label: 'Simple',
    prompt: 'What is the capital of France?',
  },
  {
    label: 'Medium',
    prompt: 'Summarize the key differences between REST and GraphQL APIs.',
  },
  {
    label: 'Complex',
    prompt:
      'Explain how transformer attention mechanisms enable in-context learning, and discuss the implications for few-shot reasoning in large language models.',
  },
];

const ModelRouterDemoScreen: React.FC = () => {
  // ─── Controls state ─────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(PRESET_PROMPTS[0].prompt);
  const [creativityLevel, setCreativityLevel] = useState(0.3);
  const [complexity, setComplexity] = useState(0);

  // ─── Per-mode state ─────────────────────────────────────────────────────
  const [results, setResults] = useState<Record<string, ModelRouterResult | null>>({
    balanced: null,
    quality: null,
    cost: null,
  });
  const [loading, setLoading] = useState<Record<string, boolean>>({
    balanced: false,
    quality: false,
    cost: false,
  });
  const [errors, setErrors] = useState<Record<string, string | null>>({
    balanced: null,
    quality: null,
    cost: null,
  });

  const isRunning = Object.values(loading).some(Boolean);

  const handleComplexityChange = useCallback((idx: number) => {
    setComplexity(idx);
    setPrompt(PRESET_PROMPTS[idx].prompt);
  }, []);

  const handleRun = useCallback(async () => {
    if (!prompt.trim() || isRunning) return;

    // Reset
    setResults({ balanced: null, quality: null, cost: null });
    setErrors({ balanced: null, quality: null, cost: null });
    setLoading({ balanced: true, quality: true, cost: true });

    // Fire all three modes in parallel
    const promises = ROUTING_MODES.map(async (mode) => {
      try {
        await runModelRouter(
          { prompt: prompt.trim(), creativityLevel, routingMode: mode },
          (event: ModelRouterEvent) => {
            if (event.type === 'step-complete' && event.step === 'routing') {
              const data = event.data as ModelRouterResult;
              setResults((prev) => ({ ...prev, [mode]: data }));
            }
            if (event.type === 'error') {
              const errData = event.data as { message: string };
              setErrors((prev) => ({ ...prev, [mode]: errData.message }));
            }
          }
        );
      } catch (err) {
        setErrors((prev) => ({
          ...prev,
          [mode]: err instanceof Error ? err.message : 'Request failed',
        }));
      } finally {
        setLoading((prev) => ({ ...prev, [mode]: false }));
      }
    });

    await Promise.allSettled(promises);
  }, [prompt, creativityLevel, isRunning]);

  return (
    <div className="mr-screen">
      <div className="mr-header">
        <span className="mr-header-title">Model Router Demo</span>
      </div>

      <div className="mr-content kiosk-container">
        {/* ── Controls ─────────────────────────────────────────── */}
        <div className="mr-controls">
          <div className="control-group">
            <label className="control-label" htmlFor="mr-prompt-input">
              Prompt
            </label>
            <textarea
              id="mr-prompt-input"
              className="control-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter a prompt to compare routing modes..."
              disabled={isRunning}
              rows={3}
            />
          </div>

          <div className="mr-controls-row">
            {/* Complexity presets */}
            <div className="control-group control-group-flex">
              <label className="control-label" htmlFor="mr-complexity-slider">
                Prompt Complexity
              </label>
              <div className="mr-complexity-buttons">
                {PRESET_PROMPTS.map((p, idx) => (
                  <button
                    key={p.label}
                    type="button"
                    className={`mode-btn ${complexity === idx ? 'mode-btn-active' : ''}`}
                    onClick={() => handleComplexityChange(idx)}
                    disabled={isRunning}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Creativity slider */}
            <div className="control-group control-group-half">
              <label className="control-label" htmlFor="mr-creativity-slider">
                Creativity <span className="control-value">{creativityLevel.toFixed(1)}</span>
              </label>
              <input
                id="mr-creativity-slider"
                type="range"
                className="control-slider"
                min={0}
                max={1}
                step={0.1}
                value={creativityLevel}
                onChange={(e) => setCreativityLevel(parseFloat(e.target.value))}
                disabled={isRunning}
              />
              <div className="slider-labels">
                <span>Precise</span>
                <span>Creative</span>
              </div>
            </div>
          </div>

          <button
            className="run-btn"
            onClick={handleRun}
            disabled={isRunning || !prompt.trim()}
            type="button"
          >
            {isRunning ? (
              <span className="run-btn-loading">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
              </span>
            ) : (
              'Run Comparison'
            )}
          </button>
        </div>

        {/* ── Three-column results ─────────────────────────────── */}
        <div className="mr-results-grid">
          {ROUTING_MODES.map((mode) => (
            <ModelRouterResultCard
              key={mode}
              mode={mode}
              result={results[mode]}
              isLoading={loading[mode]}
              error={errors[mode]}
            />
          ))}
        </div>

        {/* ── Comparison summary ───────────────────────────────── */}
        <ModelRouterComparisonSummary results={results} />
      </div>
    </div>
  );
};

export default ModelRouterDemoScreen;
