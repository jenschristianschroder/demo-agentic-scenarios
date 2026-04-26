import React, { useState, useCallback, useEffect } from 'react';
import type { ToolStep, ToolEvent, ToolCallRecord, ToolDefinition, SpotifyRequest } from '../types';
import { runSpotifyAgent } from '../services/spotifyApi';
import { startSpotifyLogin, getAccessToken, isSpotifyAuthenticated, clearTokens, fetchSpotifyProfile, getMissingScopes, getGrantedScopes } from '../services/spotifyAuth';
import type { SpotifyUserProfile } from '../services/spotifyAuth';
import ToolPipelineView from './components/ToolPipelineView';
import ToolInventory from './components/ToolInventory';
import ToolTimeline from './components/ToolTimeline';
import './SpotifyDemoScreen.css';

const SpotifyDemoScreen: React.FC = () => {

  // ─── Auth state ─────────────────────────────────────────────────────────
  const [authenticated, setAuthenticated] = useState(isSpotifyAuthenticated());
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<SpotifyUserProfile | null>(null);
  const [missingScopes, setMissingScopes] = useState<string[]>([]);

  useEffect(() => {
    if (authenticated) {
      getAccessToken().then((token) => {
        if (token) {
          setAccessToken(token);
          // Check for missing scopes
          const missing = getMissingScopes();
          setMissingScopes(missing);
          // Validate token and fetch user profile
          fetchSpotifyProfile(token)
            .then((profile) => setUserProfile(profile))
            .catch((err) => {
              // Token is invalid — clear and reset
              console.warn('Spotify token validation failed, disconnecting:', err);
              clearTokens();
              setAuthenticated(false);
              setAccessToken(null);
              setUserProfile(null);
              setMissingScopes([]);
            });
        } else {
          setAuthenticated(false);
          setUserProfile(null);
          setMissingScopes([]);
        }
      });
    }
  }, [authenticated]);

  const handleConnect = useCallback(async () => {
    try {
      await startSpotifyLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Spotify login');
    }
  }, []);

  const handleDisconnect = useCallback(() => {
    clearTokens();
    setAuthenticated(false);
    setAccessToken(null);
    setUserProfile(null);
    setMissingScopes([]);
  }, []);

  const handleReconnect = useCallback(async () => {
    clearTokens();
    setAuthenticated(false);
    setAccessToken(null);
    setUserProfile(null);
    setMissingScopes([]);
    try {
      await startSpotifyLogin();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start Spotify login');
    }
  }, []);

  // ─── Controls state ───────────────────────────────────────────────────────
  const [prompt, setPrompt] = useState(
    "Create a playlist called 'Morning Run' with 10 energetic tracks"
  );
  const [creativityLevel, setCreativityLevel] = useState(0.3);
  const [maxToolCalls, setMaxToolCalls] = useState(20);

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
    if (!prompt.trim() || isRunning || !accessToken) return;

    // Block execution if required write scopes are missing or unknown
    if (getMissingScopes().length > 0) {
      setError('Your Spotify token is missing required write permissions — please disconnect and reconnect to Spotify.');
      return;
    }

    // Ensure token is fresh
    const freshToken = await getAccessToken();
    if (!freshToken) {
      setAuthenticated(false);
      setAccessToken(null);
      setError('Spotify session expired — please reconnect.');
      return;
    }

    // Reset state
    setIsRunning(true);
    setActiveStep('user-request');
    setTools([]);
    setToolCalls([]);
    setPendingToolCall(null);
    setFinalResponse(null);
    setError(null);
    setEvents([]);

    const request: SpotifyRequest = {
      prompt: prompt.trim(),
      creativityLevel,
      accessToken: freshToken,
      maxToolCalls,
    };

    try {
      await runSpotifyAgent(request, (event: ToolEvent) => {
        setEvents((prev) => [...prev, event]);

        if (event.type === 'step-start') {
          setActiveStep(event.step);
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
      setError(err instanceof Error ? err.message : 'Spotify agent failed');
      setIsRunning(false);
      setActiveStep(null);
    }
  }, [prompt, creativityLevel, maxToolCalls, isRunning, accessToken]);

  const calledToolNames = toolCalls.map((tc) => tc.toolName);

  return (
    <div className="spotify-screen">
      <div className="spotify-header">
        <span className="spotify-header-title">Spotify Playlist Agent</span>
        <div className="spotify-auth-section">
          {authenticated ? (
            <>
              {userProfile && (
                <div className="spotify-user-info">
                  {userProfile.imageUrl && (
                    <img
                      className="spotify-user-avatar"
                      src={userProfile.imageUrl}
                      alt={userProfile.displayName}
                    />
                  )}
                  <span className="spotify-user-name">
                    {userProfile.displayName}
                    {userProfile.email && (
                      <span className="spotify-user-email">{userProfile.email}</span>
                    )}
                  </span>
                </div>
              )}
              <button className="spotify-disconnect-btn" onClick={handleDisconnect} type="button">
                Disconnect
              </button>
            </>
          ) : (
            <button className="spotify-connect-btn" onClick={handleConnect} type="button">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
              Connect to Spotify
            </button>
          )}
        </div>
      </div>

      <div className="spotify-content kiosk-container">
        {/* ── Auth gate ───────────────────────────────────────────── */}
        {!authenticated && (
          <div className="spotify-auth-gate">
            <svg className="spotify-auth-gate-icon" width="48" height="48" viewBox="0 0 24 24" fill="#1DB954">
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
            <h2 className="spotify-auth-gate-title">Connect your Spotify account</h2>
            <p className="spotify-auth-gate-desc">
              This demo uses your Spotify account to search tracks, create playlists, and manage your music — all driven by an AI agent.
            </p>
            <button className="spotify-connect-btn spotify-connect-btn-lg" onClick={handleConnect} type="button">
              Connect to Spotify
            </button>
          </div>
        )}

        {/* ── Missing scopes warning ─────────────────────────────── */}
        {authenticated && (missingScopes.length > 0 || getGrantedScopes() === null) && (
          <div className="spotify-error" style={{ marginBottom: 16 }}>
            <strong>⚠️ Missing Spotify permissions:</strong>{' '}
            {missingScopes.length > 0
              ? <>Your token is missing the required scopes: <code>{missingScopes.join(', ')}</code>.</>
              : <>Your token has no scope information — required write permissions cannot be verified.</>}
            <br />
            This typically means your Spotify app is in <strong>Development Mode</strong> and your
            account may not be properly added as a test user in the{' '}
            <a href="https://developer.spotify.com/dashboard" target="_blank" rel="noopener noreferrer">
              Spotify Developer Dashboard
            </a>{' '}
            (Settings → User Management). Please verify your account is listed, then reconnect to re-authorize.
            <br />
            <button
              type="button"
              onClick={handleReconnect}
              style={{
                marginTop: 10,
                padding: '8px 18px',
                borderRadius: 6,
                border: 'none',
                background: '#1DB954',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: '0.9em',
              }}
            >
              Disconnect & Reconnect
            </button>
          </div>
        )}

        {/* ── Controls (shown when authenticated) ─────────────────── */}
        {authenticated && (
          <>
            <div className="spotify-controls">
              <div className="control-group">
                <label className="control-label" htmlFor="spotify-prompt-input">
                  Prompt
                </label>
                <textarea
                  id="spotify-prompt-input"
                  className="control-textarea"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="e.g. Create a playlist called 'Chill Vibes' with 15 relaxing jazz tracks"
                  disabled={isRunning}
                  rows={3}
                />
              </div>

              <div className="spotify-controls-row">
                <div className="control-group control-group-half">
                  <label className="control-label" htmlFor="spotify-creativity-slider">
                    Creativity <span className="control-value">{creativityLevel.toFixed(1)}</span>
                  </label>
                  <input
                    id="spotify-creativity-slider"
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

                <div className="control-group control-group-half">
                  <label className="control-label" htmlFor="spotify-max-tool-calls-slider">
                    Max Tool Calls <span className="control-value">{maxToolCalls}</span>
                  </label>
                  <input
                    id="spotify-max-tool-calls-slider"
                    type="range"
                    className="control-slider"
                    min={5}
                    max={40}
                    step={5}
                    value={maxToolCalls}
                    onChange={(e) => setMaxToolCalls(parseInt(e.target.value, 10))}
                    disabled={isRunning}
                  />
                  <div className="slider-labels">
                    <span>Fewer</span>
                    <span>More</span>
                  </div>
                </div>
              </div>

              <button
                className="run-btn spotify-run-btn"
                onClick={handleRun}
                disabled={isRunning || !prompt.trim() || !accessToken || missingScopes.length > 0}
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
            {error && <div className="spotify-error">{error}</div>}

            {/* ── Final response ────────────────────────────────────── */}
            {finalResponse !== null && (
              <div className="spotify-response">
                <div className="spotify-response-label">
                  Agent Response
                  <span className="spotify-response-badge">
                    {toolCalls.length} tool{toolCalls.length !== 1 ? 's' : ''} used
                  </span>
                </div>
                <p className="spotify-response-text output-area">{finalResponse}</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SpotifyDemoScreen;
