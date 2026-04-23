import React, { useState, useCallback } from 'react';
import type { RagStep, RagEvent, RetrievalResult, RagRequest } from '../types';
import { runRag } from '../services/ragApi';
import RagPipelineView from './components/RagPipelineView';
import RetrievedDocuments from './components/RetrievedDocuments';
import './RagDemoScreen.css';

const RagDemoScreen: React.FC = () => {

  // ─── Controls state ───────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(
    'What laptops does Contoso Electronics offer and what are their prices?'
  );
  const [ragEnabled, setRagEnabled] = useState(true);
  const [creativityLevel, setCreativityLevel] = useState(0.3);

  // ─── Pipeline state ───────────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<RagStep | null>(null);
  const [retrievedDocs, setRetrievedDocs] = useState<RetrievalResult[]>([]);
  const [generatedResponse, setGeneratedResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<RagEvent[]>([]);
  const [retrievalLoading, setRetrievalLoading] = useState(false);

  const handleRun = useCallback(async () => {
    if (!prompt.trim() || isRunning) return;

    // Reset state
    setIsRunning(true);
    setActiveStep('user-request');
    setRetrievedDocs([]);
    setGeneratedResponse(null);
    setError(null);
    setEvents([]);
    setRetrievalLoading(false);

    const request: RagRequest = {
      prompt: prompt.trim(),
      ragEnabled,
      creativityLevel,
    };

    try {
      await runRag(request, (event: RagEvent) => {
        setEvents((prev) => [...prev, event]);

        if (event.type === 'step-start') {
          setActiveStep(event.step);
          if (event.step === 'retrieval') {
            setRetrievalLoading(true);
          }
        }

        if (event.type === 'step-complete') {
          if (event.step === 'retrieval') {
            setRetrievedDocs(event.data as RetrievalResult[]);
            setRetrievalLoading(false);
          }
          if (event.step === 'generation' || event.step === 'final-answer') {
            const d = event.data as { text: string };
            setGeneratedResponse(d.text);
          }
          if (event.step === 'final-answer') {
            setIsRunning(false);
          }
        }

        if (event.type === 'error') {
          const errData = event.data as { message: string };
          setError(errData.message);
          setIsRunning(false);
          setActiveStep(null);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'RAG pipeline failed');
      setIsRunning(false);
      setActiveStep(null);
    }
  }, [prompt, ragEnabled, creativityLevel, isRunning]);

  return (
    <div className="rag-screen">
      <div className="rag-header">
        <span className="rag-header-title">RAG Pipeline Demo</span>
      </div>

      <div className="rag-content kiosk-container">
        {/* ── Controls ───────────────────────────────────────────── */}
        <div className="rag-controls">
          <div className="control-group">
            <label className="control-label" htmlFor="rag-prompt-input">
              Prompt
            </label>
            <textarea
              id="rag-prompt-input"
              className="control-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask a question about the knowledge base..."
              disabled={isRunning}
              rows={3}
            />
          </div>

          <div className="rag-controls-row">
            {/* RAG toggle */}
            <div className="control-group control-group-flex">
              <span className="control-label">RAG</span>
              <div className="mode-toggle">
                <button
                  type="button"
                  className={`mode-btn ${ragEnabled ? 'mode-btn-active' : ''}`}
                  onClick={() => setRagEnabled(true)}
                  disabled={isRunning}
                >
                  Enabled
                </button>
                <button
                  type="button"
                  className={`mode-btn ${!ragEnabled ? 'mode-btn-active' : ''}`}
                  onClick={() => setRagEnabled(false)}
                  disabled={isRunning}
                >
                  Disabled
                </button>
              </div>
            </div>

            {/* Creativity slider */}
            <div className="control-group control-group-half">
              <label className="control-label" htmlFor="rag-creativity-slider">
                Creativity <span className="control-value">{creativityLevel.toFixed(1)}</span>
              </label>
              <input
                id="rag-creativity-slider"
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
              'Run'
            )}
          </button>
        </div>

        {/* ── Pipeline visualization ─────────────────────────────── */}
        <RagPipelineView
          activeStep={activeStep}
          ragEnabled={ragEnabled}
          isRunning={isRunning}
          events={events}
        />

        {/* ── Retrieved documents ────────────────────────────────── */}
        {(activeStep || events.length > 0) && (
          <RetrievedDocuments
            documents={retrievedDocs}
            ragEnabled={ragEnabled}
            isLoading={retrievalLoading}
          />
        )}

        {/* ── Error ─────────────────────────────────────────────── */}
        {error && <div className="rag-error">{error}</div>}

        {/* ── Generated response ─────────────────────────────────── */}
        {generatedResponse !== null && (
          <div className="rag-response">
            <div className="rag-response-label">
              Generated Response
              {!ragEnabled && <span className="rag-response-badge rag-response-badge-no-rag">Without RAG</span>}
              {ragEnabled && <span className="rag-response-badge rag-response-badge-rag">With RAG</span>}
            </div>
            <p className="rag-response-text output-area">{generatedResponse}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default RagDemoScreen;
