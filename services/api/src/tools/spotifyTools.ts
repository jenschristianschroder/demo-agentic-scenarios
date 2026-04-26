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

    // Log full error details to help diagnose persistent issues
    console.error(
      `[Spotify API Error] ${options.method ?? 'GET'} ${url} → ${res.status}: ${errorMessage}`
    );

    // Provide actionable guidance for 403 errors
    if (res.status === 403) {
      const hint =
        'This usually means the access token does not have the required scopes (e.g. playlist-modify-public, playlist-modify-private). ' +
        'Common causes:\n' +
        '1. The OAuth scope parameter was not encoded correctly (spaces must be %20, not +).\n' +
        '2. The user needs to disconnect and reconnect to Spotify to obtain a fresh token with the correct scopes.\n' +
        '3. If the Spotify app is in Development Mode, verify the user is listed under Settings → User Management in the Spotify Developer Dashboard.';
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
  const data = (await spotifyFetch(token, '/me')) as Record<string, unknown>;
  // Return only the fields needed by the agent to avoid confusion between
  // `id` (the plain user ID required by other endpoints) and similar-looking
  // fields like `uri` ("spotify:user:xxx") or `href` (a full URL).
  return {
    id: data.id,
    display_name: data.display_name,
    email: data.email,
  };
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
  args: { name: string; description?: string; public?: boolean }
): Promise<unknown> {
  // POST /me/playlists — the only supported create-playlist endpoint since the
  // February 2026 Spotify API migration removed POST /users/{id}/playlists.
  const data = (await spotifyFetch(token, '/me/playlists', {
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

// ─── Tool: web_search ────────────────────────────────────────────────────────
// Uses the Tavily Search API to research music topics (artists, genres, curated
// track lists, etc.) from the web, enriching the agent's context before
// querying Spotify. Requires the TAVILY_API_KEY environment variable.

const TAVILY_API_URL = 'https://api.tavily.com/search';

export async function webSearch(args: { query: string; count?: number }): Promise<unknown> {
  const apiKey = process.env.TAVILY_API_KEY;
  if (!apiKey) {
    return { error: 'Web search is unavailable: TAVILY_API_KEY is not configured.' };
  }

  const maxResults = Math.min(args.count ?? 5, 10);

  let res: globalThis.Response;
  try {
    res = await fetch(TAVILY_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        query: args.query,
        search_depth: 'basic',
        max_results: maxResults,
      }),
    });
  } catch (err) {
    return { error: `Web search network error: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return { error: `Tavily search failed (${res.status}): ${body}` };
  }

  const data = (await res.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return {
    results: (data.results ?? []).map((r) => ({
      title: r.title ?? '',
      url: r.url ?? '',
      snippet: r.content ?? '',
    })),
  };
}

// ─── Tool: get_page_content ──────────────────────────────────────────────
// Fetches a web page and returns its text content so the agent can use the
// information as knowledge (e.g. reading an article about an artist or a
// curated track list linked from a web search result).

const MAX_PAGE_CONTENT_LENGTH = 20_000;

export async function getPageContent(args: { url: string }): Promise<unknown> {
  const { url } = args;

  // Basic URL validation
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { error: 'Invalid URL provided.' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { error: 'Only http and https URLs are supported.' };
  }

  let res: globalThis.Response;
  try {
    res = await fetch(url, {
      headers: {
        'User-Agent': 'SpotifyPlaylistAgent/1.0',
        Accept: 'text/html, application/xhtml+xml, text/plain',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(8_000),
    });
  } catch (err) {
    return { error: `Failed to fetch page: ${err instanceof Error ? err.message : String(err)}` };
  }

  if (!res.ok) {
    return { error: `Page returned HTTP ${res.status}` };
  }

  let body: string;
  try {
    body = await res.text();
  } catch (err) {
    return { error: `Failed to read page body: ${err instanceof Error ? err.message : String(err)}` };
  }

  // Strip HTML to extract readable text content.
  // Use loops to handle nested/malformed script and style blocks that a single
  // pass may miss (addresses CodeQL incomplete-multi-character-sanitization).
  let stripped = body;

  // Remove script blocks (allow optional whitespace in closing tag)
  let prev = '';
  while (prev !== stripped) {
    prev = stripped;
    stripped = stripped.replace(/<script\b[^>]*>[\s\S]*?<\/\s*script[^>]*>/gi, '');
  }

  // Remove style blocks
  prev = '';
  while (prev !== stripped) {
    prev = stripped;
    stripped = stripped.replace(/<style\b[^>]*>[\s\S]*?<\/\s*style[^>]*>/gi, '');
  }

  // Remove remaining HTML tags and decode common entities.
  // Decode &amp; last to avoid double-unescaping (e.g. &amp;lt; → &lt; → <).
  const text = stripped
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

  if (!text) {
    return { error: 'Page contained no readable text content.' };
  }

  // Truncate to keep token usage reasonable
  const truncated = text.length > MAX_PAGE_CONTENT_LENGTH;
  const content = truncated ? text.slice(0, MAX_PAGE_CONTENT_LENGTH) : text;

  return {
    url,
    content,
    truncated,
    originalLength: text.length,
  };
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
      case 'web_search':
        return await webSearch(args as Parameters<typeof webSearch>[0]);
      case 'get_page_content':
        return await getPageContent(args as Parameters<typeof getPageContent>[0]);
      default:
        return { error: `Unknown Spotify tool: ${name}` };
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Spotify API call failed' };
  }
}
