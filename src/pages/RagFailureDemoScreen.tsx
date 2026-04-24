import React, { useState, useCallback } from 'react';
import type {
  OrchestrationRequest,
  OrchestrationEvent,
  AgentStep,
  IterationRecord,
  RunSummary,
  AgentMessage,
  RevisionOutput,
} from '../types';
import { runOrchestration } from '../services/orchestrationApi';
import OrchestrationView from './components/OrchestrationView';
import StepDetail from './components/StepDetail';
import IterationLog from './components/IterationLog';
import RunSummaryPanel from './components/RunSummary';
import AgentCommunicationLog from './components/AgentCommunicationLog';
import './RagFailureDemoScreen.css';

const DEFAULT_PROMPT =
  'Write a product page saying the Contoso AirBook S5 has a 4K OLED display and 5G.';

const RagFailureDemoScreen: React.FC = () => {
  // ─── Controls state ───────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [creativityLevel, setCreativityLevel] = useState(0.7);
  const [maxIterations, setMaxIterations] = useState(3);

  // ─── Orchestration state ──────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<AgentStep | null>(null);
  const [selectedStep, setSelectedStep] = useState<AgentStep | null>(null);
  const [iterations, setIterations] = useState<IterationRecord[]>([]);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<OrchestrationEvent[]>([]);
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([]);

  const handleRun = useCallback(async () => {
    if (!prompt.trim() || isRunning) return;

    setIsRunning(true);
    setActiveStep('user-request');
    setSelectedStep(null);
    setIterations([]);
    setRunSummary(null);
    setError(null);
    setEvents([]);
    setAgentMessages([]);

    const request: OrchestrationRequest = {
      prompt: prompt.trim(),
      creativityLevel,
      workflowMode: 'auto-revise',
      acceptanceThreshold: 0.8,
      maxIterations,
      generatorKnowledgeSource: true,
      scenario: 'rag-failure-recovery',
    };

    try {
      await runOrchestration(request, (event: OrchestrationEvent) => {
        setEvents((prev) => [...prev, event]);

        if (event.type === 'step-start') {
          setActiveStep(event.step);
        }

        if (event.type === 'agent-message') {
          const msg = event.data as AgentMessage;
          setAgentMessages((prev) => [...prev, msg]);
        }

        if (event.type === 'step-complete') {
          if (event.step === 'generator') {
            const genOutput = event.data as IterationRecord['generatorOutput'];
            setIterations((prev) => {
              const existing = prev.find((i) => i.iteration === genOutput.iteration);
              if (existing) {
                return prev.map((i) =>
                  i.iteration === genOutput.iteration
                    ? { ...i, generatorOutput: genOutput }
                    : i
                );
              }
              return [...prev, { iteration: genOutput.iteration, generatorOutput: genOutput }];
            });
          }

          if (event.step === 'fact-checker') {
            const fcOutput = event.data as IterationRecord['factCheckerOutput'];
            setIterations((prev) => {
              const last = prev[prev.length - 1];
              if (last) {
                return [...prev.slice(0, -1), { ...last, factCheckerOutput: fcOutput }];
              }
              return prev;
            });
          }

          if (event.step === 'revision') {
            const revOutput = event.data as RevisionOutput;
            setIterations((prev) => {
              const last = prev[prev.length - 1];
              if (last) {
                return [...prev.slice(0, -1), { ...last, revisionOutput: revOutput }];
              }
              return prev;
            });
          }

          if (event.step === 'orchestrator') {
            const decision = event.data as IterationRecord['orchestratorDecision'];
            setIterations((prev) => {
              const last = prev[prev.length - 1];
              if (last) {
                return [...prev.slice(0, -1), { ...last, orchestratorDecision: decision }];
              }
              return prev;
            });
          }
        }

        if (event.type === 'run-complete') {
          setRunSummary(event.data as RunSummary);
          setActiveStep('final-answer');
          setIsRunning(false);
        }

        if (event.type === 'error') {
          const errData = event.data as { message: string };
          setError(errData.message);
          setIsRunning(false);
          setActiveStep(null);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Orchestration failed');
      setIsRunning(false);
      setActiveStep(null);
    }
  }, [prompt, creativityLevel, maxIterations, isRunning]);

  const getSelectedStepData = () => {
    if (!selectedStep || iterations.length === 0) return null;
    const lastIteration = iterations[iterations.length - 1];
    switch (selectedStep) {
      case 'generator':
        return lastIteration.generatorOutput;
      case 'fact-checker':
        return lastIteration.factCheckerOutput ?? null;
      case 'revision':
        return lastIteration.revisionOutput ?? null;
      case 'orchestrator':
        return lastIteration.orchestratorDecision ?? null;
      case 'final-answer':
        return runSummary;
      case 'user-request':
        return { prompt };
      default:
        return null;
    }
  };

  return (
    <div className="rag-failure-screen">
      <div className="rag-failure-header">
        <span className="rag-failure-header-title">RAG Failure &amp; Recovery Demo</span>
      </div>

      <div className="rag-failure-content kiosk-container">
        {/* Simplified controls */}
        <div className="rag-failure-controls">
          <div className="control-group">
            <label className="control-label" htmlFor="rf-prompt">Prompt</label>
            <textarea
              id="rf-prompt"
              className="control-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask the LLM to write content with unsupported claims…"
              disabled={isRunning}
              rows={3}
            />
          </div>

          <div className="rag-failure-settings">
            <div className="control-group control-group-half">
              <label className="control-label" htmlFor="rf-creativity">
                Creativity <span className="control-value">{creativityLevel.toFixed(1)}</span>
              </label>
              <input
                id="rf-creativity"
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

            <div className="control-group control-group-narrow">
              <label className="control-label" htmlFor="rf-max-iter">Max Iterations</label>
              <select
                id="rf-max-iter"
                className="control-select"
                value={maxIterations}
                onChange={(e) => setMaxIterations(parseInt(e.target.value, 10))}
                disabled={isRunning}
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>

            <div className="rag-failure-locked-settings">
              <span className="locked-badge">Auto-revise</span>
              <span className="locked-badge">Knowledge Source ON</span>
            </div>
          </div>

          <button
            type="button"
            className="run-btn"
            onClick={handleRun}
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
              'Run RAG Failure & Recovery'
            )}
          </button>
        </div>

        <OrchestrationView
          activeStep={activeStep}
          selectedStep={selectedStep}
          onSelectStep={setSelectedStep}
          iterations={iterations}
          isRunning={isRunning}
          events={events}
          includeRevisionStep
        />

        {/* Agent Communication — the hero component */}
        <AgentCommunicationLog messages={agentMessages} isRunning={isRunning} />

        {iterations.length > 0 && (
          <IterationLog iterations={iterations} isRunning={isRunning} />
        )}

        {error && <div className="demo-error">{error}</div>}

        {selectedStep && (
          <StepDetail
            step={selectedStep}
            data={getSelectedStepData()}
            iterations={iterations}
          />
        )}

        {runSummary && <RunSummaryPanel summary={runSummary} />}
      </div>
    </div>
  );
};

export default RagFailureDemoScreen;
