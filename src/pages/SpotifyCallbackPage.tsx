import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeCode, getStoredState } from '../services/spotifyAuth';

/**
 * Returns true when this page is running inside a popup window opened by our
 * OAuth flow (i.e. it has an opener that shares the same origin).
 */
function isPopup(): boolean {
  try {
    return !!window.opener && window.opener.origin === window.location.origin;
  } catch {
    // Cross-origin opener — treat as a non-popup context.
    return false;
  }
}

/**
 * Notify the opener window that auth has completed (success or failure) and
 * close this popup.  Falls back to in-page navigation when there is no opener.
 */
function notifyOpenerAndClose(result: { success: boolean; error?: string }): void {
  try {
    window.opener?.postMessage(
      { type: 'spotify-auth-complete', ...result },
      window.location.origin,
    );
  } catch {
    // Opener may have been closed — ignore.
  }
  window.close();
}

const SpotifyCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const inPopup = isPopup();

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      const msg = `Spotify authorization error: ${errorParam}`;
      if (inPopup) {
        notifyOpenerAndClose({ success: false, error: msg });
      } else {
        setError(msg);
      }
      return;
    }

    if (!code) {
      const msg = 'No authorization code received from Spotify.';
      if (inPopup) {
        notifyOpenerAndClose({ success: false, error: msg });
      } else {
        setError(msg);
      }
      return;
    }

    // Verify state to prevent CSRF
    const storedState = getStoredState();
    if (storedState && state !== storedState) {
      const msg = 'State mismatch — possible CSRF attack. Please try again.';
      if (inPopup) {
        notifyOpenerAndClose({ success: false, error: msg });
      } else {
        setError(msg);
      }
      return;
    }

    exchangeCode(code)
      .then(() => {
        if (inPopup) {
          notifyOpenerAndClose({ success: true });
        } else {
          navigate('/spotify-demo', { replace: true });
        }
      })
      .catch((err) => {
        const msg = err instanceof Error ? err.message : 'Token exchange failed';
        if (inPopup) {
          notifyOpenerAndClose({ success: false, error: msg });
        } else {
          setError(msg);
        }
      });
  }, [searchParams, navigate, inPopup]);

  if (error) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <h2>Spotify Connection Failed</h2>
        <p style={{ color: '#c62828' }}>{error}</p>
        <button
          onClick={() => navigate('/spotify-demo')}
          type="button"
          style={{
            marginTop: 16,
            padding: '10px 24px',
            borderRadius: 8,
            border: 'none',
            background: '#1DB954',
            color: '#fff',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Back to Spotify Demo
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p>Connecting to Spotify…</p>
    </div>
  );
};

export default SpotifyCallbackPage;
