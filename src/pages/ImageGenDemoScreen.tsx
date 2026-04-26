import React, { useState, useCallback } from 'react';
import type {
  ImageGenRequest,
  ImageGenEvent,
  ImageGenStep,
  ImageGenSummary,
  PromptEngineerOutput,
  ImageGenerationOutput,
  ArtDirectorOutput,
  ImageSize,
  ImageQuality,
} from '../types';
import { IMAGE_GEN_STEP_LABELS as STEP_LABELS } from '../types';
import { runImageGen } from '../services/imageGenApi';
import './ImageGenDemoScreen.css';

// ─── Constants ──────────────────────────────────────────────────────────────

const STYLES = ['Photorealistic', 'Illustration', 'Digital Art', 'Oil Painting', 'Watercolor', 'Cinematic'];

const SIZE_OPTIONS: { label: string; value: ImageSize }[] = [
  { label: 'Square', value: '1024x1024' },
  { label: 'Landscape', value: '1792x1024' },
  { label: 'Portrait', value: '1024x1792' },
];

const PRESET_CONCEPTS = [
  { label: 'City at dusk', prompt: 'A futuristic city skyline at dusk with glowing neon lights reflecting on wet streets' },
  { label: 'Mountain lake', prompt: 'A serene alpine lake at sunrise with snow-capped peaks mirrored in the still water' },
  { label: 'Abstract portrait', prompt: 'An abstract geometric portrait of a human face composed of fractured crystalline shapes' },
];

const PIPELINE_STEPS: ImageGenStep[] = [
  'user-request',
  'prompt-engineer',
  'image-generation',
  'art-director',
  'final-image',
];

// ─── Step Icon ───────────────────────────────────────────────────────────────

const StepIcon: React.FC<{ step: ImageGenStep }> = ({ step }) => {
  switch (step) {
    case 'user-request':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      );
    case 'prompt-engineer':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 20h9" />
          <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
        </svg>
      );
    case 'image-generation':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      );
    case 'art-director':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      );
    case 'final-image':
      return (
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      );
  }
};

// ─── Pipeline View ───────────────────────────────────────────────────────────

interface PipelineViewProps {
  completedSteps: Set<ImageGenStep>;
  activeStep: ImageGenStep | null;
  artDirectorEnabled: boolean;
}

const PipelineView: React.FC<PipelineViewProps> = ({ completedSteps, activeStep, artDirectorEnabled }) => {
  const visibleSteps = artDirectorEnabled
    ? PIPELINE_STEPS
    : PIPELINE_STEPS.filter((s) => s !== 'art-director');

  return (
    <div className="ig-pipeline">
      <div className="ig-pipeline-label">Generation Pipeline</div>
      <div className="ig-pipeline-steps">
        {visibleSteps.map((step, idx) => {
          const completed = completedSteps.has(step);
          const isActive = activeStep === step;
          return (
            <React.Fragment key={step}>
              {idx > 0 && (
                <div className={`ig-arrow ${completed || isActive ? 'ig-arrow-active' : ''}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7" />
                  </svg>
                </div>
              )}
              <div
                className={[
                  'ig-step',
                  isActive && !completed ? 'ig-step-active' : '',
                  completed ? 'ig-step-completed' : '',
                ].join(' ')}
              >
                <span className="ig-step-icon">
                  <StepIcon step={step} />
                  {isActive && !completed && <span className="ig-step-spinner" />}
                  {completed && (
                    <span className="ig-step-check">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  )}
                </span>
                <span className="ig-step-label">{STEP_LABELS[step]}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

// ─── Step Detail Cards ───────────────────────────────────────────────────────

interface StepDetailsProps {
  promptOutputs: PromptEngineerOutput[];
  imageOutputs: ImageGenerationOutput[];
  artDirectorOutputs: ArtDirectorOutput[];
}

const StepDetailCards: React.FC<StepDetailsProps> = ({
  promptOutputs,
  imageOutputs,
  artDirectorOutputs,
}) => {
  if (promptOutputs.length === 0 && imageOutputs.length === 0 && artDirectorOutputs.length === 0) {
    return null;
  }

  return (
    <div className="ig-step-details">
      {promptOutputs.map((p) => (
        <div key={`pe-${p.iteration}`} className="ig-detail-card">
          <div className="ig-detail-card-header">
            <span className="ig-detail-card-title">
              Prompt Engineer {promptOutputs.length > 1 ? `— Iteration ${p.iteration}` : ''}
            </span>
          </div>
          <div className="ig-detail-label">Refined Prompt</div>
          <div className="ig-detail-field">{p.refinedPrompt}</div>
          <div className="ig-detail-label">Style Notes</div>
          <div className="ig-detail-field">{p.styleNotes}</div>
          <div className="ig-detail-label">Composition</div>
          <div className="ig-detail-field">{p.compositionNotes}</div>
        </div>
      ))}

      {artDirectorOutputs.map((ad) => {
        const scorePct = Math.round(ad.score * 100);
        const fillClass =
          ad.score >= 0.75 ? 'ig-score-fill-good' : ad.score >= 0.5 ? 'ig-score-fill-ok' : 'ig-score-fill-bad';
        return (
          <div key={`ad-${ad.iteration}`} className="ig-detail-card">
            <div className="ig-detail-card-header">
              <span className="ig-detail-card-title">
                Art Director {artDirectorOutputs.length > 1 ? `— Iteration ${ad.iteration}` : ''}
              </span>
              <span className={`ig-detail-card-badge ${ad.verdict === 'approved' ? 'ig-badge-approved' : 'ig-badge-revision'}`}>
                {ad.verdict === 'approved' ? 'Approved' : 'Needs Revision'}
              </span>
            </div>
            <div className="ig-detail-label">Quality Score</div>
            <div className="ig-score-bar">
              <div className="ig-score-track">
                <div className={`ig-score-fill ${fillClass}`} style={{ width: `${scorePct}%` }} />
              </div>
              <span className="ig-score-value">{scorePct}%</span>
            </div>
            <div className="ig-detail-label" style={{ marginTop: 10 }}>Feedback</div>
            <div className="ig-detail-field">{ad.feedback}</div>
            {ad.revisionInstructions && ad.verdict === 'needs-revision' && (
              <>
                <div className="ig-detail-label">Revision Instructions</div>
                <div className="ig-detail-field">{ad.revisionInstructions}</div>
              </>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const ImageGenDemoScreen: React.FC = () => {
  // ─── Controls ────────────────────────────────────────────────────────────
  const [concept, setConcept] = useState(PRESET_CONCEPTS[0].prompt);
  const [style, setStyle] = useState(STYLES[0]);
  const [size, setSize] = useState<ImageSize>('1024x1024');
  const [quality, setQuality] = useState<ImageQuality>('auto');
  const [artDirectorEnabled, setArtDirectorEnabled] = useState(true);
  const [maxRevisions, setMaxRevisions] = useState(2);
  const [creativityLevel, setCreativityLevel] = useState(0.7);
  const [presetIdx, setPresetIdx] = useState(0);

  // ─── Orchestration state ──────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<ImageGenStep | null>(null);
  const [completedSteps, setCompletedSteps] = useState<Set<ImageGenStep>>(new Set());
  const [promptOutputs, setPromptOutputs] = useState<PromptEngineerOutput[]>([]);
  const [imageOutputs, setImageOutputs] = useState<ImageGenerationOutput[]>([]);
  const [artDirectorOutputs, setArtDirectorOutputs] = useState<ArtDirectorOutput[]>([]);
  const [summary, setSummary] = useState<ImageGenSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handlePreset = useCallback((idx: number) => {
    setPresetIdx(idx);
    setConcept(PRESET_CONCEPTS[idx].prompt);
  }, []);

  const handleRun = useCallback(async () => {
    if (!concept.trim() || isRunning) return;

    setIsRunning(true);
    setActiveStep(null);
    setCompletedSteps(new Set());
    setPromptOutputs([]);
    setImageOutputs([]);
    setArtDirectorOutputs([]);
    setSummary(null);
    setError(null);

    const request: ImageGenRequest = {
      concept: concept.trim(),
      style,
      size,
      quality,
      artDirectorEnabled,
      maxRevisions,
      creativityLevel,
    };

    try {
      await runImageGen(request, (event: ImageGenEvent) => {
        if (event.type === 'step-start') {
          setActiveStep(event.step);
          return;
        }

        if (event.type === 'step-complete') {
          setCompletedSteps((prev) => new Set(prev).add(event.step));

          if (event.step === 'prompt-engineer') {
            setPromptOutputs((prev) => [...prev, event.data as PromptEngineerOutput]);
          } else if (event.step === 'image-generation') {
            setImageOutputs((prev) => [...prev, event.data as ImageGenerationOutput]);
          } else if (event.step === 'art-director') {
            setArtDirectorOutputs((prev) => [...prev, event.data as ArtDirectorOutput]);
          } else if (event.step === 'final-image') {
            setSummary(event.data as ImageGenSummary);
          }
          return;
        }

        if (event.type === 'run-complete') {
          setSummary(event.data as ImageGenSummary);
          setActiveStep('final-image');
          setIsRunning(false);
          return;
        }

        if (event.type === 'error') {
          const err = event.data as { message: string };
          setError(err.message);
          setIsRunning(false);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Image generation failed');
    } finally {
      setIsRunning(false);
    }
  }, [concept, style, size, quality, artDirectorEnabled, maxRevisions, creativityLevel, isRunning]);

  const isMockImage = summary?.finalImageUrl.startsWith('data:image/svg+xml');

  return (
    <div className="ig-screen">
      <div className="ig-header">
        <span className="ig-header-title">AI Creative Studio</span>
      </div>

      <div className="ig-content kiosk-container">
        {/* ── Controls ──────────────────────────────────────── */}
        <div className="ig-controls">
          {/* Concept */}
          <div className="control-group">
            <label className="control-label" htmlFor="ig-concept">Concept</label>
            <textarea
              id="ig-concept"
              className="control-textarea"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              placeholder="Describe the image you want to create…"
              disabled={isRunning}
              rows={3}
            />
          </div>

          {/* Preset concepts */}
          <div className="control-group">
            <label className="control-label">Preset Concepts</label>
            <div className="ig-style-buttons">
              {PRESET_CONCEPTS.map((p, idx) => (
                <button
                  key={p.label}
                  type="button"
                  className={`mode-btn ${presetIdx === idx ? 'mode-btn-active' : ''}`}
                  onClick={() => handlePreset(idx)}
                  disabled={isRunning}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="ig-controls-row">
            {/* Style */}
            <div className="control-group control-group-flex">
              <label className="control-label">Style</label>
              <div className="ig-style-buttons">
                {STYLES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className={`mode-btn ${style === s ? 'mode-btn-active' : ''}`}
                    onClick={() => setStyle(s)}
                    disabled={isRunning}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="ig-controls-row">
            {/* Size */}
            <div className="control-group control-group-flex">
              <label className="control-label">Size</label>
              <div className="ig-size-buttons">
                {SIZE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`mode-btn ${size === opt.value ? 'mode-btn-active' : ''}`}
                    onClick={() => setSize(opt.value)}
                    disabled={isRunning}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quality */}
            <div className="control-group control-group-flex">
              <label className="control-label">Quality</label>
              <div className="ig-quality-buttons">
                {(['low', 'medium', 'high', 'auto'] as ImageQuality[]).map((q) => (
                  <button
                    key={q}
                    type="button"
                    className={`mode-btn ${quality === q ? 'mode-btn-active' : ''}`}
                    onClick={() => setQuality(q)}
                    disabled={isRunning}
                  >
                    {q.charAt(0).toUpperCase() + q.slice(1)}
                  </button>
                ))}
              </div>
            </div>

            {/* Creativity */}
            <div className="control-group control-group-half">
              <label className="control-label" htmlFor="ig-creativity">
                Creativity <span className="control-value">{creativityLevel.toFixed(1)}</span>
              </label>
              <input
                id="ig-creativity"
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

          <div className="ig-controls-row">
            {/* Art Director toggle */}
            <div className="control-group control-group-flex">
              <label className="control-label">Art Director</label>
              <div className="ig-quality-buttons">
                <button
                  type="button"
                  className={`mode-btn ${artDirectorEnabled ? 'mode-btn-active' : ''}`}
                  onClick={() => setArtDirectorEnabled(true)}
                  disabled={isRunning}
                >
                  Enabled
                </button>
                <button
                  type="button"
                  className={`mode-btn ${!artDirectorEnabled ? 'mode-btn-active' : ''}`}
                  onClick={() => setArtDirectorEnabled(false)}
                  disabled={isRunning}
                >
                  Disabled
                </button>
              </div>
            </div>

            {/* Max revisions — shown only when art director is on */}
            {artDirectorEnabled && (
              <div className="control-group control-group-half">
                <label className="control-label" htmlFor="ig-revisions">
                  Max Revisions <span className="control-value">{maxRevisions}</span>
                </label>
                <input
                  id="ig-revisions"
                  type="range"
                  className="control-slider"
                  min={1}
                  max={3}
                  step={1}
                  value={maxRevisions}
                  onChange={(e) => setMaxRevisions(parseInt(e.target.value, 10))}
                  disabled={isRunning}
                />
                <div className="slider-labels">
                  <span>1</span>
                  <span>3</span>
                </div>
              </div>
            )}
          </div>

          <button
            type="button"
            className="run-btn"
            onClick={handleRun}
            disabled={isRunning || !concept.trim()}
          >
            {isRunning ? (
              <span className="run-btn-loading">
                <span className="loading-dot" />
                <span className="loading-dot" />
                <span className="loading-dot" />
                Generating
              </span>
            ) : (
              'Generate Image'
            )}
          </button>
        </div>

        {/* ── Pipeline View ─────────────────────────────────── */}
        {(isRunning || completedSteps.size > 0) && (
          <PipelineView
            completedSteps={completedSteps}
            activeStep={activeStep}
            artDirectorEnabled={artDirectorEnabled}
          />
        )}

        {/* ── Step Detail Cards ─────────────────────────────── */}
        <StepDetailCards
          promptOutputs={promptOutputs}
          imageOutputs={imageOutputs}
          artDirectorOutputs={artDirectorOutputs}
        />

        {/* ── Error ─────────────────────────────────────────── */}
        {error && <div className="ig-error">{error}</div>}

        {/* ── Final Image ───────────────────────────────────── */}
        {summary && (
          <div className="ig-result">
            <div className="ig-result-header">
              <span className="ig-result-title">Generated Image</span>
              {summary.totalIterations > 1 && (
                <span className="ig-detail-card-badge ig-badge-approved">
                  {summary.totalIterations} iteration{summary.totalIterations > 1 ? 's' : ''}
                </span>
              )}
              {summary.artDirectorScore !== undefined && (
                <span className={`ig-detail-card-badge ${summary.artDirectorScore >= 0.75 ? 'ig-badge-approved' : 'ig-badge-revision'}`}>
                  Score: {Math.round(summary.artDirectorScore * 100)}%
                </span>
              )}
            </div>

            <div className="ig-result-meta">
              <div className="ig-meta-item">
                <span className="ig-meta-label">Iterations</span>
                <span className="ig-meta-value">{summary.totalIterations}</span>
              </div>
              {summary.artDirectorFeedback && (
                <div className="ig-meta-item">
                  <span className="ig-meta-label">Art Director</span>
                  <span className="ig-meta-value">{summary.artDirectorScore !== undefined ? `${Math.round(summary.artDirectorScore * 100)}% quality` : 'Reviewed'}</span>
                </div>
              )}
            </div>

            <div className="ig-image-container">
              {isMockImage ? (
                <img src={summary.finalImageUrl} alt="Mock placeholder" className="ig-image-mock" />
              ) : (
                <img src={summary.finalImageUrl} alt="Generated" className="ig-image" />
              )}
            </div>

            <div className="ig-prompt-text">
              <strong>Prompt used:</strong> {summary.finalPrompt}
            </div>

            {summary.artDirectorFeedback && (
              <div className="ig-prompt-text">
                <strong>Art Director:</strong> {summary.artDirectorFeedback}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImageGenDemoScreen;
