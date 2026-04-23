import React, { useState, useCallback } from 'react';
import type { ToolStep, ToolEvent, ToolCallRecord, ToolDefinition, ToolRequest } from '../types';
import { runToolAgent } from '../services/toolsApi';
import ToolPipelineView from './components/ToolPipelineView';
import ToolInventory from './components/ToolInventory';
import ToolTimeline from './components/ToolTimeline';
import './ToolDemoScreen.css';

const ToolDemoScreen: React.FC = () => {

  // ─── Controls state ───────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(
    'Which Contoso laptop has the best battery life, and how much would it cost in USD?'
  );
  const [creativityLevel, setCreativityLevel] = useState(0.3);

  // ─── Pipeline state ───────────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<ToolStep | null>(null);
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [toolCalls, setToolCalls] = useState<ToolCallRecord[]>([]);
  const [pendingToolCall, setPendingToolCall] = useState<{
    toolName: string;
    arguments: Record<string, unknown>;
  } | null>(null);
  const [finalResponse, setFinalResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<ToolEvent[]>([]);

  const handleRun = useCallback(async () => {
    if (!prompt.trim() || isRunning) return;

    // Reset state
    setIsRunning(true);
    setActiveStep('user-request');
    setTools([]);
    setToolCalls([]);
    setPendingToolCall(null);
    setFinalResponse(null);
    setError(null);
    setEvents([]);

    const request: ToolRequest = {
      prompt: prompt.trim(),
      creativityLevel,
    };

    try {
      await runToolAgent(request, (event: ToolEvent) => {
        setEvents((prev) => [...prev, event]);

        if (event.type === 'step-start') {
          setActiveStep(event.step);
          // Extract available tools from reasoning start
          if (event.step === 'reasoning' && event.data && 'tools' in event.data) {
            setTools(event.data.tools);
          }
        }

        if (event.type === 'tool-call-start') {
          setActiveStep('tool-call');
          const data = event.data as ToolCallRecord;
          setPendingToolCall({ toolName: data.toolName, arguments: data.arguments });
        }

        if (event.type === 'tool-call-complete') {
          const data = event.data as ToolCallRecord;
          setToolCalls((prev) => [...prev, data]);
          setPendingToolCall(null);
        }

        if (event.type === 'step-complete') {
          if (event.step === 'final-answer') {
            const data = event.data as { text: string; toolCalls: ToolCallRecord[] };
            setFinalResponse(data.text);
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
      setError(err instanceof Error ? err.message : 'Tool agent failed');
      setIsRunning(false);
      setActiveStep(null);
    }
  }, [prompt, creativityLevel, isRunning]);

  const calledToolNames = toolCalls.map((tc) => tc.toolName);

  return (
    <div className="tool-screen">
      <div className="tool-header">
        <span className="tool-header-title">Tool-Use Agent Demo</span>
      </div>

      <div className="tool-content kiosk-container">
        {/* ── Controls ───────────────────────────────────────────── */}
        <div className="tool-controls">
          <div className="control-group">
            <label className="control-label" htmlFor="tool-prompt-input">
              Prompt
            </label>
            <textarea
              id="tool-prompt-input"
              className="control-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask about Contoso products, pricing, comparisons, or warranties..."
              disabled={isRunning}
              rows={3}
            />
          </div>

          <div className="tool-controls-row">
            {/* Creativity slider */}
            <div className="control-group control-group-half">
              <label className="control-label" htmlFor="tool-creativity-slider">
                Creativity <span className="control-value">{creativityLevel.toFixed(1)}</span>
              </label>
              <input
                id="tool-creativity-slider"
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
        <ToolPipelineView
          activeStep={activeStep}
          isRunning={isRunning}
          events={events}
          toolCallCount={toolCalls.length}
        />

        {/* ── Tool inventory ────────────────────────────────────── */}
        <ToolInventory tools={tools} calledToolNames={calledToolNames} />

        {/* ── Tool execution timeline ───────────────────────────── */}
        <ToolTimeline toolCalls={toolCalls} pendingToolCall={pendingToolCall} />

        {/* ── Error ─────────────────────────────────────────────── */}
        {error && <div className="tool-error">{error}</div>}

        {/* ── Final response ────────────────────────────────────── */}
        {finalResponse !== null && (
          <div className="tool-response">
            <div className="tool-response-label">
              Agent Response
              <span className="tool-response-badge">
                {toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''} used
              </span>
            </div>
            <p className="tool-response-text output-area">{finalResponse}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ToolDemoScreen;
