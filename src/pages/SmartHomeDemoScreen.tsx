import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import type {
  SmartHomeRequest,
  SmartHomeEvent,
  SmartHomeStep,
  SmartHomeAgentMessage,
  SmartHomeBundleSummary,
  HomeNeeds,
  DeviceRecommendation,
  PrivacyAssessment,
  CompatibilityResult,
} from '../types';
import { runSmartHomeBundle } from '../services/smartHomeApi';
import SmartHomePipelineView from './components/SmartHomePipelineView';
import SmartHomeCommunicationLog from './components/SmartHomeCommunicationLog';
import './SmartHomeDemoScreen.css';

const DEFAULT_PROMPT =
  'Create a smart home starter bundle for a small apartment with privacy in mind.';

const SmartHomeDemoScreen: React.FC = () => {
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [creativityLevel, setCreativityLevel] = useState(0.5);

  const [isRunning, setIsRunning] = useState(false);
  const [activeStep, setActiveStep] = useState<SmartHomeStep | null>(null);
  const [inProgressSteps, setInProgressSteps] = useState<Set<SmartHomeStep>>(new Set());
  const [selectedStep, setSelectedStep] = useState<SmartHomeStep | null>(null);
  const [events, setEvents] = useState<SmartHomeEvent[]>([]);
  const [agentMessages, setAgentMessages] = useState<SmartHomeAgentMessage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [needs, setNeeds] = useState<HomeNeeds | null>(null);
  const [devices, setDevices] = useState<DeviceRecommendation[]>([]);
  const [privacy, setPrivacy] = useState<PrivacyAssessment | null>(null);
  const [compatibility, setCompatibility] = useState<CompatibilityResult[]>([]);
  const [bundle, setBundle] = useState<SmartHomeBundleSummary | null>(null);

  const handleRun = useCallback(async () => {
    if (!prompt.trim() || isRunning) return;

    setIsRunning(true);
    setActiveStep(null);
    setInProgressSteps(new Set());
    setSelectedStep(null);
    setEvents([]);
    setAgentMessages([]);
    setError(null);
    setNeeds(null);
    setDevices([]);
    setPrivacy(null);
    setCompatibility([]);
    setBundle(null);

    const request: SmartHomeRequest = {
      prompt: prompt.trim(),
      creativityLevel,
    };

    try {
      await runSmartHomeBundle(request, (event: SmartHomeEvent) => {
        if (event.type === 'step-start') {
          setEvents((prev) => [...prev, event]);
          setActiveStep(event.step);
          setInProgressSteps((prev) => new Set(prev).add(event.step));
          return;
        }

        if (event.type === 'step-complete') {
          setInProgressSteps((prev) => {
            const next = new Set(prev);
            next.delete(event.step);
            return next;
          });
          setEvents((prev) => [...prev, event]);

          switch (event.step) {
            case 'needs-analysis':
              setNeeds(event.data as HomeNeeds);
              break;
            case 'device-recommendation':
              setDevices(event.data as DeviceRecommendation[]);
              break;
            case 'privacy-review':
              setPrivacy(event.data as PrivacyAssessment);
              break;
            case 'compatibility-check':
              setCompatibility(event.data as CompatibilityResult[]);
              break;
            case 'final-bundle':
              setBundle(event.data as SmartHomeBundleSummary);
              break;
          }
          return;
        }

        if (event.type === 'agent-message') {
          setEvents((prev) => [...prev, event]);
          const msg = event.data as SmartHomeAgentMessage;
          setAgentMessages((prev) => [...prev, msg]);
          return;
        }

        if (event.type === 'run-complete') {
          setEvents((prev) => [...prev, event]);
          setBundle(event.data as SmartHomeBundleSummary);
          setActiveStep('final-bundle');
          setInProgressSteps(new Set());
          setIsRunning(false);
          return;
        }

        if (event.type === 'error') {
          setEvents((prev) => [...prev, event]);
          const errData = event.data as { message: string };
          setError(errData.message);
          setIsRunning(false);
          setInProgressSteps(new Set());
          setActiveStep(null);
        }
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Smart Home Bundle failed');
      setIsRunning(false);
      setInProgressSteps(new Set());
      setActiveStep(null);
    }
  }, [prompt, creativityLevel, isRunning]);

  return (
    <div className="smart-home-screen">
      <div className="smart-home-header">
        <span className="smart-home-header-title">Smart Home Bundle Builder Demo</span>
      </div>

      <div className="smart-home-content kiosk-container">
        {/* Controls */}
        <div className="smart-home-controls">
          <div className="control-group">
            <label className="control-label" htmlFor="sh-prompt">Smart Home Request</label>
            <textarea
              id="sh-prompt"
              className="control-textarea"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe your smart home needs…"
              disabled={isRunning}
              rows={3}
            />
          </div>

          <div className="smart-home-settings">
            <div className="control-group control-group-half">
              <label className="control-label" htmlFor="sh-creativity">
                Creativity <span className="control-value">{creativityLevel.toFixed(1)}</span>
              </label>
              <input
                id="sh-creativity"
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
              'Build Smart Home Bundle'
            )}
          </button>
        </div>

        {/* Pipeline view */}
        <SmartHomePipelineView
          activeStep={activeStep}
          selectedStep={selectedStep}
          onSelectStep={setSelectedStep}
          isRunning={isRunning}
          events={events}
          inProgressSteps={inProgressSteps}
        />

        {/* Agent Communication */}
        <SmartHomeCommunicationLog messages={agentMessages} isRunning={isRunning} />

        {/* Step detail panel */}
        {selectedStep && (
          <div className="smart-home-step-detail">
            <StepDetailPanel
              step={selectedStep}
              needs={needs}
              devices={devices}
              privacy={privacy}
              compatibility={compatibility}
              bundle={bundle}
              prompt={prompt}
            />
          </div>
        )}

        {error && <div className="demo-error">{error}</div>}

        {/* Final Bundle */}
        {bundle && (
          <div className="smart-home-result">
            <div className="sh-result-header">
              <span className="sh-result-title">{bundle.bundleName}</span>
              <span className={`sh-result-badge ${bundle.withinBudget ? 'badge-ok' : 'badge-warn'}`}>
                {bundle.withinBudget ? 'Within Budget' : 'Over Budget'}
              </span>
              <span className={`sh-result-badge ${bundle.privacyOk ? 'badge-ok' : 'badge-warn'}`}>
                {bundle.privacyOk ? 'Privacy OK' : 'Privacy Concern'}
              </span>
              <span className={`sh-result-badge ${bundle.compatibilityOk ? 'badge-ok' : 'badge-warn'}`}>
                {bundle.compatibilityOk ? 'Compatible' : 'Compatibility Issue'}
              </span>
            </div>

            <table className="sh-items-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {bundle.items.map((item, i) => (
                  <tr key={i}>
                    <td>{item.name}</td>
                    <td>{item.quantity}</td>
                    <td>DKK {item.unitPriceDKK.toLocaleString()}</td>
                    <td>DKK {item.totalPriceDKK.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="sh-items-total">
                  <td colSpan={3}>Total</td>
                  <td>DKK {bundle.totalPriceDKK.toLocaleString()}</td>
                </tr>
              </tbody>
            </table>

            <div className="sh-summary-grid">
              <div className="sh-summary-item">
                <span className="sh-summary-label">Budget</span>
                <span className="sh-summary-value">DKK {bundle.budgetDKK.toLocaleString()}</span>
              </div>
              <div className="sh-summary-item">
                <span className="sh-summary-label">Items</span>
                <span className="sh-summary-value">{bundle.items.length}</span>
              </div>
            </div>

            <div className="sh-setup-plan">
              <ReactMarkdown>{bundle.setupPlan}</ReactMarkdown>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/** Step detail panel */
const StepDetailPanel: React.FC<{
  step: SmartHomeStep;
  needs: HomeNeeds | null;
  devices: DeviceRecommendation[];
  privacy: PrivacyAssessment | null;
  compatibility: CompatibilityResult[];
  bundle: SmartHomeBundleSummary | null;
  prompt: string;
}> = ({ step, needs, devices, privacy, compatibility, bundle, prompt }) => {
  switch (step) {
    case 'user-request':
      return (
        <div className="step-detail-card">
          <h3>Customer Request</h3>
          <p>{prompt}</p>
        </div>
      );

    case 'needs-analysis':
      if (!needs) return <div className="step-detail-card"><p>Analyzing…</p></div>;
      return (
        <div className="step-detail-card">
          <h3>Identified Needs</h3>
          <dl className="detail-dl">
            <dt>Space Type</dt><dd>{needs.spaceType}</dd>
            <dt>Size</dt><dd>{needs.spaceSize}</dd>
            <dt>Privacy Level</dt><dd>{needs.privacyLevel}</dd>
            <dt>Budget</dt><dd>DKK {needs.budgetDKK.toLocaleString()}</dd>
            <dt>Priorities</dt><dd>{needs.priorities.join(', ')}</dd>
            {needs.additionalNotes && <><dt>Notes</dt><dd>{needs.additionalNotes}</dd></>}
          </dl>
        </div>
      );

    case 'device-recommendation':
      if (devices.length === 0) return <div className="step-detail-card"><p>Searching…</p></div>;
      return (
        <div className="step-detail-card">
          <h3>Recommended Devices</h3>
          <div className="candidate-grid">
            {devices.map((d, i) => (
              <div key={i} className={`candidate-card ${i === 0 ? 'candidate-top' : ''}`}>
                <div className="candidate-header">
                  <span className="candidate-name">{d.name}</span>
                  <span className="candidate-score">DKK {d.priceDKK.toLocaleString()}</span>
                </div>
                <div className="candidate-specs">{d.keyFeatures}</div>
                <div className="candidate-details">
                  <span>Protocols: {d.protocols.join(', ')}</span>
                </div>
                <div className="candidate-reason">{d.reason}</div>
              </div>
            ))}
          </div>
        </div>
      );

    case 'privacy-review':
      if (!privacy) return <div className="step-detail-card"><p>Reviewing…</p></div>;
      return (
        <div className="step-detail-card">
          <h3>Privacy Assessment</h3>
          <dl className="detail-dl">
            <dt>Device</dt><dd>{privacy.deviceName}</dd>
            <dt>Camera</dt><dd>{privacy.hasCamera ? 'Yes' : 'No'}</dd>
            <dt>Microphone</dt><dd>{privacy.hasMicrophone ? 'Yes' : 'No'}</dd>
            <dt>Hardware Mute Switch</dt><dd>{privacy.hasHardwareMuteSwitch ? 'Yes' : 'No'}</dd>
            <dt>Privacy Shutter</dt><dd>{privacy.hasPrivacyShutter ? 'Yes' : 'No'}</dd>
            <dt>Local Processing</dt><dd>{privacy.localProcessing ? 'Yes' : 'No'}</dd>
            <dt>Rating</dt>
            <dd className={
              privacy.privacyRating === 'approved' ? 'text-ok' :
              privacy.privacyRating === 'conditional' ? 'text-warn' : 'text-bad'
            }>
              {privacy.privacyRating}
            </dd>
          </dl>
          {privacy.conditions.length > 0 && (
            <div className="support-concerns">
              <strong>Conditions:</strong>
              <ul>{privacy.conditions.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          )}
          {privacy.concerns.length > 0 && (
            <div className="support-concerns">
              <strong>Concerns:</strong>
              <ul>{privacy.concerns.map((c, i) => <li key={i}>{c}</li>)}</ul>
            </div>
          )}
        </div>
      );

    case 'compatibility-check':
      if (compatibility.length === 0) return <div className="step-detail-card"><p>Checking…</p></div>;
      return (
        <div className="step-detail-card">
          <h3>Compatibility Results</h3>
          {compatibility.map((c, i) => (
            <div key={i} style={{ marginBottom: 12 }}>
              <strong>{c.deviceName}</strong>
              <div style={{ fontSize: '0.8125rem', color: '#444' }}>
                Protocols: {c.protocols.join(', ')}
                {c.issues.length > 0 && (
                  <div style={{ color: '#e65100', marginTop: 4 }}>
                    Issues: {c.issues.join('; ')}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      );

    case 'bundle-assembly':
    case 'final-bundle':
      if (!bundle) return <div className="step-detail-card"><p>Assembling…</p></div>;
      return (
        <div className="step-detail-card">
          <h3>{bundle.bundleName}</h3>
          <div className="sh-setup-plan">
            <ReactMarkdown>{bundle.setupPlan}</ReactMarkdown>
          </div>
        </div>
      );

    default:
      return null;
  }
};

export default SmartHomeDemoScreen;
