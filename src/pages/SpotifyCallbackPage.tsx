import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { exchangeCode, getStoredState } from '../services/spotifyAuth';

const SpotifyCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError(`Spotify authorization error: ${errorParam}`);
      return;
    }

    if (!code) {
      setError('No authorization code received from Spotify.');
      return;
    }

    // Verify state to prevent CSRF
    const storedState = getStoredState();
    if (storedState && state !== storedState) {
      setError('State mismatch — possible CSRF attack. Please try again.');
      return;
    }

    exchangeCode(code)
      .then(() => {
        navigate('/spotify-demo', { replace: true });
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Token exchange failed');
      });
  }, [searchParams, navigate]);

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
