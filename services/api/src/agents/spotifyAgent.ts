// ─── Spotify Playlist Agent ──────────────────────────────────────────────────
// Uses Azure OpenAI function calling to let the model manage Spotify playlists
// on behalf of the user. The access token is passed from the frontend (PKCE)
// and used for all Spotify API calls. Streams tool call events via SSE.

import type { Response } from 'express';
import type { ToolEvent, ToolCallRecord, ToolDefinition } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';
import { executeSpotifyTool } from '../tools/spotifyTools.js';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

// ─── Tool schemas for OpenAI function calling ────────────────────────────────

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'get_current_user',
      description: 'Get the current Spotify user profile. Use this to obtain the user ID needed to create playlists.',
      parameters: {
        type: 'object',
        properties: {},
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'search_tracks',
      description: 'Search for tracks on Spotify by query (artist, track name, genre, etc). Returns track IDs, names, artists, and URIs.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search query (e.g. "energetic running songs", "Miles Davis jazz")' },
          limit: { type: 'number', description: 'Number of results to return (default: 10, max: 50)' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_recommendations',
      description: 'Get track recommendations based on seed tracks and/or genres. Optionally target energy, danceability, or valence.',
      parameters: {
        type: 'object',
        properties: {
          seed_tracks: {
            type: 'array',
            items: { type: 'string' },
            description: 'Up to 5 Spotify track IDs to use as seeds',
          },
          seed_genres: {
            type: 'array',
            items: { type: 'string' },
            description: 'Up to 5 genre names (e.g. "rock", "jazz", "electronic")',
          },
          limit: { type: 'number', description: 'Number of recommendations (default: 10, max: 100)' },
          target_energy: { type: 'number', description: 'Target energy 0.0–1.0 (1.0 = most energetic)' },
          target_danceability: { type: 'number', description: 'Target danceability 0.0–1.0' },
          target_valence: { type: 'number', description: 'Target valence 0.0–1.0 (1.0 = most positive/happy)' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_user_playlists',
      description: 'List the current user\'s playlists. Returns playlist IDs, names, descriptions, and track counts.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number', description: 'Number of playlists to return (default: 20, max: 50)' },
        },
        required: [],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_playlist',
      description: 'Get full details of a specific playlist including its tracks.',
      parameters: {
        type: 'object',
        properties: {
          playlist_id: { type: 'string', description: 'The Spotify playlist ID' },
        },
        required: ['playlist_id'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'create_playlist',
      description: 'Create a new playlist for the current authenticated user.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Name of the new playlist' },
          description: { type: 'string', description: 'Description for the playlist' },
          public: { type: 'boolean', description: 'Whether the playlist should be public (default: false)' },
        },
        required: ['name'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'add_tracks_to_playlist',
      description: 'Add tracks to an existing playlist. Provide Spotify track URIs (e.g. "spotify:track:xxxxx").',
      parameters: {
        type: 'object',
        properties: {
          playlist_id: { type: 'string', description: 'The Spotify playlist ID' },
          track_uris: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of Spotify track URIs to add (e.g. ["spotify:track:abc123"])',
          },
        },
        required: ['playlist_id', 'track_uris'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_tracks_from_playlist',
      description: 'Remove tracks from an existing playlist. Provide Spotify track URIs.',
      parameters: {
        type: 'object',
        properties: {
          playlist_id: { type: 'string', description: 'The Spotify playlist ID' },
          track_uris: {
            type: 'array',
            items: { type: 'string' },
            description: 'Array of Spotify track URIs to remove',
          },
        },
        required: ['playlist_id', 'track_uris'],
        additionalProperties: false,
      },
    },
  },
];

/** Tool definitions for the UI (without the JSON Schema details) */
export const SPOTIFY_TOOL_DEFINITIONS: ToolDefinition[] = TOOLS.map((t) => ({
  name: t.function.name,
  description: t.function.description ?? '',
  parameters: t.function.parameters as Record<string, unknown>,
}));

const SYSTEM_PROMPT = `You are a Spotify music curator and playlist manager. You help users create, manage, and discover music through their Spotify account.

IMPORTANT RULES:
- Use the tools to interact with Spotify on behalf of the user. Do NOT make up track names, IDs, or URIs.
- When adding tracks to a playlist, first search for or get recommendations to obtain valid track URIs.
- When the user asks you to create a playlist with tracks, follow this workflow:
  1. search_tracks or get_recommendations → get track URIs
  2. create_playlist → get playlist_id (the user ID is resolved automatically)
  3. add_tracks_to_playlist → add the tracks
- You may call multiple tools if needed.
- When the user mentions a genre or mood, use search queries or get_recommendations with appropriate parameters.
- Always provide a clear, well-formatted final answer summarizing what you did, including playlist names, track lists, and links when available.
- If a Spotify API error occurs, explain it clearly to the user.
- If a 403 Forbidden error occurs on a write operation (creating playlists, adding/removing tracks), explain that the access token likely lacks the required scopes (playlist-modify-public / playlist-modify-private). The most common fix is to disconnect and reconnect to Spotify to obtain a fresh token. If the Spotify app is in Development Mode, the user may also need to be added under Settings → User Management in the Spotify Developer Dashboard.`;

// Higher than the default 10 because Spotify workflows often require several
// sequential steps (get user → search → create playlist → add tracks).
const MAX_TOOL_ROUNDS = 15;

/**
 * Run the Spotify playlist agent, streaming events via SSE.
 */
export async function runSpotifyAgent(
  prompt: string,
  creativityLevel: number,
  accessToken: string,
  res: Response
): Promise<void> {
  const client = getOpenAIClient();
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o';
  const toolCalls: ToolCallRecord[] = [];
  let callCounter = 0;

  const ts = () => new Date().toISOString();

  // ── Step 1: User request ───────────────────────────────────────────────
  emit(res, { type: 'step-start', step: 'user-request', timestamp: ts(), data: { prompt } });
  emit(res, { type: 'step-complete', step: 'user-request', timestamp: ts(), data: { prompt } });

  // ── Step 2: Show available tools ───────────────────────────────────────
  emit(res, { type: 'step-start', step: 'reasoning', timestamp: ts(), data: { tools: SPOTIFY_TOOL_DEFINITIONS } });

  // ── Step 3: Tool-calling loop ──────────────────────────────────────────
  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: prompt },
  ];

  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;

    const response = await client.chat.completions.create({
      model: deployment,
      temperature: creativityLevel,
      messages,
      tools: TOOLS,
    });

    const choice = response.choices[0];
    if (!choice) throw new Error('No response from Azure OpenAI');

    const assistantMessage = choice.message;
    messages.push(assistantMessage);

    // If no tool calls, we have the final answer
    if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      emit(res, { type: 'step-complete', step: 'reasoning', timestamp: ts(), data: { message: 'Model decided no more tools needed' } });
      break;
    }

    // Process each tool call
    for (const tc of assistantMessage.tool_calls) {
      callCounter++;
      const toolName = tc.function.name;
      const toolArgs = JSON.parse(tc.function.arguments);
      const callId = `call-${callCounter}`;

      // Emit tool call start
      emit(res, {
        type: 'tool-call-start',
        step: 'tool-call',
        timestamp: ts(),
        data: { id: callId, toolName, arguments: toolArgs, result: null, durationMs: 0 },
      });

      const startTime = Date.now();
      const result = await executeSpotifyTool(toolName, toolArgs, accessToken);
      const durationMs = Date.now() - startTime;

      const record: ToolCallRecord = {
        id: callId,
        toolName,
        arguments: toolArgs,
        result,
        durationMs,
      };
      toolCalls.push(record);

      // Emit tool call complete
      emit(res, {
        type: 'tool-call-complete',
        step: 'tool-call',
        timestamp: ts(),
        data: record,
      });

      // Feed result back to the model
      messages.push({
        role: 'tool',
        tool_call_id: tc.id,
        content: JSON.stringify(result),
      });
    }
  }

  // ── Step 4: Final answer ───────────────────────────────────────────────
  emit(res, { type: 'step-start', step: 'final-answer', timestamp: ts(), data: null });

  const lastMessage = messages[messages.length - 1];
  let finalText: string;

  if (lastMessage.role === 'assistant' && 'content' in lastMessage && typeof lastMessage.content === 'string') {
    finalText = lastMessage.content;
  } else {
    const finalResponse = await client.chat.completions.create({
      model: deployment,
      temperature: creativityLevel,
      messages,
    });
    finalText = finalResponse.choices[0]?.message?.content ?? 'No response generated.';
  }

  emit(res, {
    type: 'step-complete',
    step: 'final-answer',
    timestamp: ts(),
    data: { text: finalText, toolCalls },
  });

  res.write('data: [DONE]\n\n');
  res.end();
}

function emit(res: Response, event: ToolEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}
