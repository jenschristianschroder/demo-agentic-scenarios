// ─── Spotify PKCE Auth Utilities ─────────────────────────────────────────────
// Implements the Authorization Code with PKCE flow for Spotify Web API.
// All tokens are stored in sessionStorage and refreshed before expiry.

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Buffer in seconds before token expiry to trigger a refresh
const TOKEN_REFRESH_BUFFER_SECONDS = 60;

// Minimum scopes for playlist management
const SCOPES = [
  'playlist-read-private',
  'playlist-modify-public',
  'playlist-modify-private',
].join(' ');

// ─── PKCE helpers ────────────────────────────────────────────────────────────

function generateCodeVerifier(): string {
  const array = new Uint8Array(64);
  crypto.getRandomValues(array);
  return base64UrlEncode(array);
}

async function generateCodeChallenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return base64UrlEncode(new Uint8Array(digest));
}

function base64UrlEncode(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ─── Auth flow ───────────────────────────────────────────────────────────────

function getClientId(): string {
  const id = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
  if (!id) throw new Error('VITE_SPOTIFY_CLIENT_ID is not configured');
  return id;
}

function getRedirectUri(): string {
  return import.meta.env.VITE_SPOTIFY_REDIRECT_URI || `${window.location.origin}/spotify-callback`;
}

/**
 * Start the Spotify login flow — redirects the browser to Spotify's authorize page.
 */
export async function startSpotifyLogin(): Promise<void> {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateCodeVerifier().slice(0, 16);

  // Persist for the callback
  sessionStorage.setItem('spotify_code_verifier', verifier);
  sessionStorage.setItem('spotify_auth_state', state);

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPES,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  });

  window.location.href = `${SPOTIFY_AUTH_URL}?${params}`;
}

/**
 * Exchange the authorization code for tokens. Called from the callback page.
 */
export async function exchangeCode(code: string): Promise<void> {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();
  const verifier = sessionStorage.getItem('spotify_code_verifier');
  if (!verifier) throw new Error('Missing code_verifier — login flow was not started correctly');

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId,
      code_verifier: verifier,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed (${res.status}): ${text}`);
  }

  const data = await res.json();
  saveTokens(data);

  // Clean up
  sessionStorage.removeItem('spotify_code_verifier');
  sessionStorage.removeItem('spotify_auth_state');
}

/**
 * Refresh the access token using the stored refresh token.
 */
export async function refreshAccessToken(): Promise<string> {
  const clientId = getClientId();
  const refreshToken = sessionStorage.getItem('spotify_refresh_token');
  if (!refreshToken) throw new Error('No refresh token available — please reconnect to Spotify');

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: clientId,
    }),
  });

  if (!res.ok) {
    clearTokens();
    throw new Error('Token refresh failed — please reconnect to Spotify');
  }

  const data = await res.json();
  saveTokens(data);
  return data.access_token;
}

// ─── Token storage (sessionStorage) ──────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

function saveTokens(data: TokenResponse): void {
  sessionStorage.setItem('spotify_access_token', data.access_token);
  if (data.refresh_token) {
    sessionStorage.setItem('spotify_refresh_token', data.refresh_token);
  }
  // Store expiry time (current time + expires_in seconds, minus buffer)
  const expiresAt = Date.now() + (data.expires_in - TOKEN_REFRESH_BUFFER_SECONDS) * 1000;
  sessionStorage.setItem('spotify_token_expires_at', String(expiresAt));
}

/**
 * Get a valid access token, refreshing if needed.
 */
export async function getAccessToken(): Promise<string | null> {
  const token = sessionStorage.getItem('spotify_access_token');
  if (!token) return null;

  const expiresAt = Number(sessionStorage.getItem('spotify_token_expires_at') || '0');
  if (Date.now() >= expiresAt) {
    try {
      return await refreshAccessToken();
    } catch {
      return null;
    }
  }

  return token;
}

/**
 * Check if the user is currently authenticated with Spotify.
 */
export function isSpotifyAuthenticated(): boolean {
  return !!sessionStorage.getItem('spotify_access_token');
}

/**
 * Clear all Spotify tokens — effectively "disconnect".
 */
export function clearTokens(): void {
  sessionStorage.removeItem('spotify_access_token');
  sessionStorage.removeItem('spotify_refresh_token');
  sessionStorage.removeItem('spotify_token_expires_at');
  sessionStorage.removeItem('spotify_code_verifier');
  sessionStorage.removeItem('spotify_auth_state');
}

/**
 * Get the stored auth state for CSRF verification on the callback page.
 */
export function getStoredState(): string | null {
  return sessionStorage.getItem('spotify_auth_state');
}
