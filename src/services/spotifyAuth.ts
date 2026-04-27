// ─── Spotify PKCE Auth Utilities ─────────────────────────────────────────────
// Implements the Authorization Code with PKCE flow for Spotify Web API.
// All tokens are stored in localStorage and refreshed before expiry.

const SPOTIFY_AUTH_URL = 'https://accounts.spotify.com/authorize';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';

// Buffer in seconds before token expiry to trigger a refresh
const TOKEN_REFRESH_BUFFER_SECONDS = 60;

// Scopes for playlist management and user profile access
const SCOPES = [
  'user-read-private',
  'user-read-email',
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
 * Start the Spotify login flow using a popup window.
 *
 * Spotify blocks being framed by non-Spotify domains (CSP / X-Frame-Options),
 * so we cannot load their login page inside this iframe.  Instead of navigating
 * away (which loses UI state) or opening a new tab (confusing UX), we open a
 * small popup window.  The popup handles the OAuth redirect and, once the
 * token exchange is complete, sends a `postMessage` back to this window and
 * closes itself.
 *
 * Call {@link onSpotifyAuthComplete} to register a listener for the result.
 */
export async function startSpotifyLogin(): Promise<void> {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();
  const verifier = generateCodeVerifier();
  const challenge = await generateCodeChallenge(verifier);
  const state = generateCodeVerifier().slice(0, 16);

  // Persist for the callback (use localStorage so it's accessible across
  // browsing contexts, e.g. popup → opener)
  localStorage.setItem('spotify_code_verifier', verifier);
  localStorage.setItem('spotify_auth_state', state);

  // Build the authorization URL using encodeURIComponent for every value.
  // URLSearchParams encodes spaces as '+', but Spotify's OAuth server
  // requires '%20'.  When spaces are encoded as '+' the entire scope list
  // is interpreted as a single unrecognized scope, resulting in a token
  // with **no** valid scopes – reads that don't require a scope still
  // work (profile, search) while writes (create playlist) fail with 403.
  // Using encodeURIComponent for all values avoids this class of bug.
  const queryParts = [
    `client_id=${encodeURIComponent(clientId)}`,
    'response_type=code',
    `redirect_uri=${encodeURIComponent(redirectUri)}`,
    'code_challenge_method=S256',
    `code_challenge=${encodeURIComponent(challenge)}`,
    `state=${encodeURIComponent(state)}`,
    'show_dialog=true',
    `scope=${encodeURIComponent(SCOPES)}`,
  ];

  const authUrl = `${SPOTIFY_AUTH_URL}?${queryParts.join('&')}`;

  // Open a centered popup window for the Spotify login.
  const width = 500;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;
  const features = `width=${width},height=${height},left=${left},top=${top},popup=yes`;

  const popup = window.open(authUrl, 'spotify-auth', features);
  if (!popup) {
    throw new Error(
      'Could not open Spotify login — please allow pop-ups for this site.',
    );
  }
}

/**
 * Register a listener that fires when Spotify auth completes in the popup.
 * Returns a cleanup function to remove the listener.
 */
export function onSpotifyAuthComplete(
  callback: (result: { success: boolean; error?: string }) => void,
): () => void {
  const handler = (event: MessageEvent) => {
    // Only accept messages from our own origin
    if (event.origin !== window.location.origin) return;
    if (event.data?.type === 'spotify-auth-complete') {
      callback(event.data as { success: boolean; error?: string });
    }
  };
  window.addEventListener('message', handler);
  return () => window.removeEventListener('message', handler);
}

/**
 * Exchange the authorization code for tokens. Called from the callback page.
 */
export async function exchangeCode(code: string): Promise<void> {
  const clientId = getClientId();
  const redirectUri = getRedirectUri();
  const verifier = localStorage.getItem('spotify_code_verifier');
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

  // Verify that the token carries the scopes we need for playlist management.
  // Throw an error immediately so the failure surfaces on the callback page
  // (which has error rendering) rather than silently deferring to playlist
  // creation where it would produce a confusing 403.
  if (data.scope) {
    const grantedSet = new Set((data.scope as string).split(' '));
    const missing = REQUIRED_SCOPES.filter((s) => !grantedSet.has(s));
    if (missing.length > 0) {
      throw new Error(
        `Spotify authorization is missing required scopes: ${missing.join(', ')}. ` +
        `Granted scopes: ${data.scope}. ` +
        `If your Spotify app is in Development Mode, ensure your account is listed under ` +
        `Settings → User Management in the Spotify Developer Dashboard, then try connecting again.`,
      );
    }
  } else {
    throw new Error(
      'Spotify did not return granted scopes — cannot verify that playlist-modify permissions were granted. ' +
      'If your Spotify app is in Development Mode, ensure your account is listed under ' +
      'Settings → User Management in the Spotify Developer Dashboard, then try connecting again.',
    );
  }

  // Clean up
  localStorage.removeItem('spotify_code_verifier');
  localStorage.removeItem('spotify_auth_state');
}

/**
 * Refresh the access token using the stored refresh token.
 */
export async function refreshAccessToken(): Promise<string> {
  const clientId = getClientId();
  const refreshToken = localStorage.getItem('spotify_refresh_token');
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

// ─── Token storage (localStorage) ────────────────────────────────────────────

interface TokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
}

/** Scopes required for full playlist management functionality */
const REQUIRED_SCOPES = [
  'playlist-modify-public',
  'playlist-modify-private',
];

function saveTokens(data: TokenResponse): void {
  localStorage.setItem('spotify_access_token', data.access_token);
  if (data.refresh_token) {
    localStorage.setItem('spotify_refresh_token', data.refresh_token);
  }
  if (data.scope) {
    localStorage.setItem('spotify_granted_scopes', data.scope);
  }
  // Store expiry time (current time + expires_in seconds, minus buffer)
  const expiresAt = Date.now() + (data.expires_in - TOKEN_REFRESH_BUFFER_SECONDS) * 1000;
  localStorage.setItem('spotify_token_expires_at', String(expiresAt));
}

/**
 * Get a valid access token, refreshing if needed.
 */
export async function getAccessToken(): Promise<string | null> {
  const token = localStorage.getItem('spotify_access_token');
  if (!token) return null;

  const expiresAt = Number(localStorage.getItem('spotify_token_expires_at') || '0');
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
 * Only returns true if a token exists AND has not expired.
 */
export function isSpotifyAuthenticated(): boolean {
  const token = localStorage.getItem('spotify_access_token');
  if (!token) return false;

  const expiresAt = Number(localStorage.getItem('spotify_token_expires_at') || '0');
  // If no expiry is stored or the stored expiry is in the past, treat as unauthenticated
  if (expiresAt <= 0 || Date.now() >= expiresAt) return false;

  return true;
}

// ─── Spotify user profile ────────────────────────────────────────────────────

export interface SpotifyUserProfile {
  displayName: string;
  email?: string;
  imageUrl?: string;
  id: string;
}

/**
 * Fetch the current user's Spotify profile using the provided access token.
 * This also serves as a token validation check — if the token is invalid the
 * call will fail.
 */
export async function fetchSpotifyProfile(accessToken: string): Promise<SpotifyUserProfile> {
  const res = await fetch('https://api.spotify.com/v1/me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Failed to fetch Spotify profile (${res.status}): ${text}`);
  }

  const data = await res.json();
  return {
    id: data.id,
    displayName: data.display_name ?? data.id,
    email: data.email,
    imageUrl: data.images?.[0]?.url,
  };
}

/**
 * Clear all Spotify tokens — effectively "disconnect".
 */
export function clearTokens(): void {
  localStorage.removeItem('spotify_access_token');
  localStorage.removeItem('spotify_refresh_token');
  localStorage.removeItem('spotify_token_expires_at');
  localStorage.removeItem('spotify_granted_scopes');
  localStorage.removeItem('spotify_code_verifier');
  localStorage.removeItem('spotify_auth_state');
}

/**
 * Get the list of required scopes that are missing from those granted by Spotify.
 * Returns the full REQUIRED_SCOPES list when no scope data is stored (conservative
 * fallback — treats unknown scope state as missing to prevent silent 403 errors).
 */
export function getMissingScopes(): string[] {
  const granted = localStorage.getItem('spotify_granted_scopes');
  if (!granted) return [...REQUIRED_SCOPES]; // No scope info — assume all required scopes are missing
  const grantedSet = new Set(granted.split(' '));
  return REQUIRED_SCOPES.filter((s) => !grantedSet.has(s));
}

/**
 * Get the scopes that were granted by Spotify during authorization.
 */
export function getGrantedScopes(): string | null {
  return localStorage.getItem('spotify_granted_scopes');
}

/**
 * Get the stored auth state for CSRF verification on the callback page.
 */
export function getStoredState(): string | null {
  return localStorage.getItem('spotify_auth_state');
}
