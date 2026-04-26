// ─── Spotify Web API Tool Implementations ────────────────────────────────────
// Each tool wraps a Spotify Web API endpoint. The access token is provided by
// the frontend (obtained via the PKCE flow) and passed through on every call.
// All helpers use `spotifyFetch` which implements exponential backoff on 429s.

const SPOTIFY_BASE = 'https://api.spotify.com/v1';

// ─── Rate-limited fetch helper ───────────────────────────────────────────────

const MAX_RETRIES = 5;
const INITIAL_BACKOFF_MS = 1000;

async function spotifyFetch(
  token: string,
  path: string,
  options: RequestInit = {}
): Promise<unknown> {
  const url = path.startsWith('http') ? path : `${SPOTIFY_BASE}${path}`;
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> ?? {}),
  };

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(url, { ...options, headers });

    if (res.ok) {
      // Some endpoints return 204 with no body
      if (res.status === 204) return { success: true };
      return res.json();
    }

    // Rate limited — back off
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After');
      const waitMs = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : INITIAL_BACKOFF_MS * Math.pow(2, attempt);
      await sleep(waitMs);
      continue;
    }

    // Other errors — read body and throw
    const errorBody = await res.text().catch(() => '');
    let errorMessage: string;
    try {
      const parsed = JSON.parse(errorBody);
      errorMessage = parsed?.error?.message ?? errorBody;
    } catch {
      errorMessage = errorBody;
    }

    // Provide actionable guidance for 403 errors
    if (res.status === 403) {
      const hint =
        'This usually means the Spotify app is in Development Mode and the user has not been added ' +
        'in the Spotify Developer Dashboard (Settings → User Management). ' +
        'Ask the app owner to add your Spotify account, or submit the app for a quota extension. ' +
        'If scopes were recently changed, disconnect and reconnect to Spotify to re-authorize.';
      lastError = new Error(`Spotify API 403 Forbidden: ${errorMessage}. ${hint}`);
    } else {
      lastError = new Error(`Spotify API ${res.status}: ${errorMessage}`);
    }

    // Only retry on server errors
    if (res.status >= 500 && attempt < MAX_RETRIES) {
      await sleep(INITIAL_BACKOFF_MS * Math.pow(2, attempt));
      continue;
    }

    throw lastError;
  }

  throw lastError ?? new Error('Spotify API request failed after retries');
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ─── Tool: get_current_user ──────────────────────────────────────────────────

export async function getCurrentUser(token: string): Promise<unknown> {
  return spotifyFetch(token, '/me');
}

// ─── Tool: search_tracks ─────────────────────────────────────────────────────

export async function searchTracks(
  token: string,
  args: { query: string; limit?: number }
): Promise<unknown> {
  const limit = Math.min(args.limit ?? 10, 50);
  const params = new URLSearchParams({
    q: args.query,
    type: 'track',
    limit: String(limit),
  });
  const data = (await spotifyFetch(token, `/search?${params}`)) as {
    tracks?: { items?: Array<Record<string, unknown>> };
  };
  const items = data?.tracks?.items ?? [];
  return {
    tracks: items.map((t: Record<string, unknown>) => ({
      id: t.id,
      name: t.name,
      uri: t.uri,
      artists: (t.artists as Array<{ name: string }>)?.map((a) => a.name).join(', '),
      album: (t.album as { name: string })?.name,
      duration_ms: t.duration_ms,
    })),
  };
}

// ─── Tool: get_recommendations ───────────────────────────────────────────────

export async function getRecommendations(
  token: string,
  args: {
    seed_tracks?: string[];
    seed_genres?: string[];
    limit?: number;
    target_energy?: number;
    target_danceability?: number;
    target_valence?: number;
  }
): Promise<unknown> {
  const params = new URLSearchParams();
  if (args.seed_tracks?.length) params.set('seed_tracks', args.seed_tracks.slice(0, 5).join(','));
  if (args.seed_genres?.length) params.set('seed_genres', args.seed_genres.slice(0, 5).join(','));
  params.set('limit', String(Math.min(args.limit ?? 10, 100)));
  if (args.target_energy !== undefined) params.set('target_energy', String(args.target_energy));
  if (args.target_danceability !== undefined) params.set('target_danceability', String(args.target_danceability));
  if (args.target_valence !== undefined) params.set('target_valence', String(args.target_valence));

  // Need at least one seed
  if (!params.has('seed_tracks') && !params.has('seed_genres')) {
    return { error: 'At least one of seed_tracks or seed_genres is required.' };
  }

  const data = (await spotifyFetch(token, `/recommendations?${params}`)) as {
    tracks?: Array<Record<string, unknown>>;
  };
  const tracks = data?.tracks ?? [];
  return {
    tracks: tracks.map((t: Record<string, unknown>) => ({
      id: t.id,
      name: t.name,
      uri: t.uri,
      artists: (t.artists as Array<{ name: string }>)?.map((a) => a.name).join(', '),
      album: (t.album as { name: string })?.name,
    })),
  };
}

// ─── Tool: get_user_playlists ────────────────────────────────────────────────

export async function getUserPlaylists(
  token: string,
  args: { limit?: number }
): Promise<unknown> {
  const limit = Math.min(args.limit ?? 20, 50);
  const data = (await spotifyFetch(token, `/me/playlists?limit=${limit}`)) as {
    items?: Array<Record<string, unknown>>;
  };
  const items = data?.items ?? [];
  return {
    playlists: items.map((p: Record<string, unknown>) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      public: p.public,
      tracks_total: (p.tracks as { total: number })?.total,
      uri: p.uri,
    })),
  };
}

// ─── Tool: get_playlist ──────────────────────────────────────────────────────

export async function getPlaylist(
  token: string,
  args: { playlist_id: string }
): Promise<unknown> {
  const data = (await spotifyFetch(token, `/playlists/${encodeURIComponent(args.playlist_id)}`)) as Record<string, unknown>;
  const tracks = (data?.tracks as { items?: Array<Record<string, unknown>> })?.items ?? [];
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    public: data.public,
    tracks: tracks.map((item: Record<string, unknown>) => {
      const t = item.track as Record<string, unknown> | null;
      if (!t) return null;
      return {
        id: t.id,
        name: t.name,
        uri: t.uri,
        artists: (t.artists as Array<{ name: string }>)?.map((a) => a.name).join(', '),
        album: (t.album as { name: string })?.name,
      };
    }).filter(Boolean),
  };
}

// ─── Tool: create_playlist ───────────────────────────────────────────────────

export async function createPlaylist(
  token: string,
  args: { user_id: string; name: string; description?: string; public?: boolean }
): Promise<unknown> {
  const data = (await spotifyFetch(token, `/users/${encodeURIComponent(args.user_id)}/playlists`, {
    method: 'POST',
    body: JSON.stringify({
      name: args.name,
      description: args.description ?? '',
      public: args.public ?? false,
    }),
  })) as Record<string, unknown>;
  return {
    id: data.id,
    name: data.name,
    description: data.description,
    uri: data.uri,
    external_url: (data.external_urls as { spotify?: string })?.spotify,
  };
}

// ─── Tool: add_tracks_to_playlist ────────────────────────────────────────────

export async function addTracksToPlaylist(
  token: string,
  args: { playlist_id: string; track_uris: string[] }
): Promise<unknown> {
  if (!args.track_uris.length) {
    return { error: 'track_uris must contain at least one URI.' };
  }
  // Spotify allows max 100 tracks per request
  const uris = args.track_uris.slice(0, 100);
  return spotifyFetch(token, `/playlists/${encodeURIComponent(args.playlist_id)}/items`, {
    method: 'POST',
    body: JSON.stringify({ uris }),
  });
}

// ─── Tool: remove_tracks_from_playlist ───────────────────────────────────────

export async function removeTracksFromPlaylist(
  token: string,
  args: { playlist_id: string; track_uris: string[] }
): Promise<unknown> {
  if (!args.track_uris.length) {
    return { error: 'track_uris must contain at least one URI.' };
  }
  return spotifyFetch(token, `/playlists/${encodeURIComponent(args.playlist_id)}/items`, {
    method: 'DELETE',
    body: JSON.stringify({
      tracks: args.track_uris.map((uri) => ({ uri })),
    }),
  });
}

// ─── Tool dispatcher ─────────────────────────────────────────────────────────

export async function executeSpotifyTool(
  name: string,
  args: Record<string, unknown>,
  token: string
): Promise<unknown> {
  try {
    switch (name) {
      case 'get_current_user':
        return await getCurrentUser(token);
      case 'search_tracks':
        return await searchTracks(token, args as Parameters<typeof searchTracks>[1]);
      case 'get_recommendations':
        return await getRecommendations(token, args as Parameters<typeof getRecommendations>[1]);
      case 'get_user_playlists':
        return await getUserPlaylists(token, args as Parameters<typeof getUserPlaylists>[1]);
      case 'get_playlist':
        return await getPlaylist(token, args as Parameters<typeof getPlaylist>[1]);
      case 'create_playlist':
        return await createPlaylist(token, args as Parameters<typeof createPlaylist>[1]);
      case 'add_tracks_to_playlist':
        return await addTracksToPlaylist(token, args as Parameters<typeof addTracksToPlaylist>[1]);
      case 'remove_tracks_from_playlist':
        return await removeTracksFromPlaylist(token, args as Parameters<typeof removeTracksFromPlaylist>[1]);
      default:
        return { error: `Unknown Spotify tool: ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Spotify API call failed' };
  }
}
