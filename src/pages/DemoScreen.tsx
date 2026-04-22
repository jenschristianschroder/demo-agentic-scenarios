import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import type {
  OrchestrationRequest,
  OrchestrationEvent,
  AgentStep,
  IterationRecord,
  RunSummary,
  WorkflowMode,
} from '../types';
import { runOrchestration } from '../services/orchestrationApi';
import Controls from './components/Controls';
import OrchestrationView from './components/OrchestrationView';
import StepDetail from './components/StepDetail';
import IterationLog from './components/IterationLog';
import RunSummaryPanel from './components/RunSummary';
import './DemoScreen.css';

const DemoScreen: React.FC = () => {
  const navigate = useNavigate();

  // ─── Controls state ───────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState('Write a product overview for Contoso Electronics\' latest laptop lineup, including model names, specifications, and pricing.');
  const [creativityLevel, setCreativityLevel] = useState(0.7);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>('review-after-first');
  const [acceptanceThreshold, setAcceptanceThreshold] = useState(0.8);
  const [maxIterations, setMaxIterations] = useState(3);
  const [generatorKnowledgeSource, setGeneratorKnowledgeSource] = useState(false);

  // ─── Orchestration state ──────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<AgentStep | null>(null);
  const [selectedStep, setSelectedStep] = useState<AgentStep | null>(null);
  const [iterations, setIterations] = useState<IterationRecord[]>([]);
  const [runSummary, setRunSummary] = useState<RunSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<OrchestrationEvent[]>([]);

  const handleRun = useCallback(async () => {
    if (!prompt.trim() || isRunning) return;

    // Reset state for new run
    setIsRunning(true);
    setActiveStep('user-request');
    setSelectedStep(null);
    setIterations([]);
    setRunSummary(null);
    setError(null);
    setEvents([]);

    const request: OrchestrationRequest = {
      prompt: prompt.trim(),
      creativityLevel,
      workflowMode,
      acceptanceThreshold,
      maxIterations,
      generatorKnowledgeSource,
    };

    try {
      await runOrchestration(request, (event: OrchestrationEvent) => {
        setEvents((prev) => [...prev, event]);

        if (event.type === 'step-start') {
          setActiveStep(event.step);
        }

        if (event.type === 'step-complete') {
          // Build up iteration records from completed steps
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
                return [
                  ...prev.slice(0, -1),
                  { ...last, factCheckerOutput: fcOutput },
                ];
              }
              return prev;
            });
          }

          if (event.step === 'orchestrator') {
            const decision = event.data as IterationRecord['orchestratorDecision'];
            setIterations((prev) => {
              const last = prev[prev.length - 1];
              if (last) {
                return [
                  ...prev.slice(0, -1),
                  { ...last, orchestratorDecision: decision },
                ];
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
  }, [prompt, creativityLevel, workflowMode, acceptanceThreshold, maxIterations, generatorKnowledgeSource, isRunning]);

  // Find data for the selected step to show in the detail panel
  const getSelectedStepData = () => {
    if (!selectedStep || iterations.length === 0) return null;
    const lastIteration = iterations[iterations.length - 1];
    switch (selectedStep) {
      case 'generator':
        return lastIteration.generatorOutput;
      case 'fact-checker':
        return lastIteration.factCheckerOutput ?? null;
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
    <div className="demo-screen">
      <div className="demo-header">
        <button
          className="header-btn"
          onClick={() => navigate('/')}
          type="button"
          aria-label="Back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <span className="demo-header-title">Multi-Agent Demo</span>
        <button
          className="header-btn header-btn-close"
          onClick={() => navigate('/')}
          type="button"
          aria-label="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="demo-content kiosk-container">
        <Controls
          prompt={prompt}
          onPromptChange={setPrompt}
          creativityLevel={creativityLevel}
          onCreativityChange={setCreativityLevel}
          workflowMode={workflowMode}
          onWorkflowModeChange={setWorkflowMode}
          acceptanceThreshold={acceptanceThreshold}
          onAcceptanceThresholdChange={setAcceptanceThreshold}
          maxIterations={maxIterations}
          onMaxIterationsChange={setMaxIterations}
          generatorKnowledgeSource={generatorKnowledgeSource}
          onGeneratorKnowledgeSourceChange={setGeneratorKnowledgeSource}
          onRun={handleRun}
          isRunning={isRunning}
        />

        <OrchestrationView
          activeStep={activeStep}
          selectedStep={selectedStep}
          onSelectStep={setSelectedStep}
          iterations={iterations}
          isRunning={isRunning}
          events={events}
        />

        {/* Live iteration log */}
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

export default DemoScreen;
