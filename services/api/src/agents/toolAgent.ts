// ─── Tool-Use Agent ──────────────────────────────────────────────────────────
// Uses Azure OpenAI function calling to let the model decide which tools to
// invoke. Streams tool call events via SSE so the UI can visualize each step.

import type { Response } from 'express';
import type { ToolEvent, ToolCallRecord, ToolDefinition } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';
import { executeTool } from '../tools/toolImplementations.js';
import type { ChatCompletionMessageParam, ChatCompletionTool } from 'openai/resources/chat/completions';

// ─── Tool schemas for OpenAI function calling ────────────────────────────────

const TOOLS: ChatCompletionTool[] = [
  {
    type: 'function',
    function: {
      name: 'search_knowledge_base',
      description: 'Search the knowledge base for documents relevant to a query. Use this when you need to find information from product documentation, technical specs, or company data.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query to find relevant documents' },
          top_k: { type: 'number', description: 'Number of results to return (default: 5)' },
        },
        required: ['query'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_details',
      description: 'Get detailed specifications for a specific Contoso Electronics product by name. Returns structured data including display, processor, memory, storage, price, and more.',
      parameters: {
        type: 'object',
        properties: {
          product_name: { type: 'string', description: 'The name of the product (e.g. "Contoso ProBook X1")' },
        },
        required: ['product_name'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_products',
      description: 'Compare two Contoso Electronics products side by side on key specifications like display, processor, memory, storage, price, and warranty.',
      parameters: {
        type: 'object',
        properties: {
          product_a: { type: 'string', description: 'Name of the first product to compare' },
          product_b: { type: 'string', description: 'Name of the second product to compare' },
        },
        required: ['product_a', 'product_b'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'calculate_price',
      description: 'Calculate the price of a Contoso product in a target currency and optionally for a given quantity. Supports DKK, EUR, USD, GBP, SEK, NOK.',
      parameters: {
        type: 'object',
        properties: {
          product_name: { type: 'string', description: 'The name of the product' },
          target_currency: { type: 'string', description: 'Target currency code (e.g. USD, EUR, GBP)' },
          quantity: { type: 'number', description: 'Number of units (default: 1)' },
        },
        required: ['product_name', 'target_currency'],
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'check_warranty_status',
      description: 'Check whether a product warranty is still active based on the purchase date. Returns warranty expiry date and days remaining.',
      parameters: {
        type: 'object',
        properties: {
          product_name: { type: 'string', description: 'The name of the product' },
          purchase_date: { type: 'string', description: 'Purchase date in YYYY-MM-DD format' },
        },
        required: ['product_name', 'purchase_date'],
        additionalProperties: false,
      },
    },
  },
];

/** Tool definitions for the UI (without the JSON Schema details) */
export const TOOL_DEFINITIONS: ToolDefinition[] = TOOLS.map((t) => {
  if (!('function' in t)) throw new Error('Expected function tool');
  return {
    name: t.function.name,
    description: t.function.description ?? '',
    parameters: t.function.parameters as Record<string, unknown>,
  };
});

const SYSTEM_PROMPT = `You are a helpful Contoso Electronics product assistant. You have access to tools that let you search a knowledge base, look up product details, compare products, calculate prices in different currencies, and check warranty status.

IMPORTANT RULES:
- Use the tools to answer the user's question accurately. Do NOT guess product details.
- You may call multiple tools if needed.
- When the user asks about prices in a different currency, use the calculate_price tool rather than converting yourself.
- When comparing products, use the compare_products tool for accurate side-by-side data.
- Always provide a clear, well-formatted final answer based on the tool results.
- If a product is not found, tell the user and list available products.`;

const MAX_TOOL_ROUNDS = 10;

/**
 * Run the tool-use agent, streaming events via SSE.
 */
export async function runToolAgent(
  prompt: string,
  creativityLevel: number,
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
  emit(res, { type: 'step-start', step: 'reasoning', timestamp: ts(), data: { tools: TOOL_DEFINITIONS } });

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
      // Reasoning complete
      emit(res, { type: 'step-complete', step: 'reasoning', timestamp: ts(), data: { message: 'Model decided no more tools needed' } });
      break;
    }

    // Process each tool call
    for (const tc of assistantMessage.tool_calls) {
      if (!('function' in tc)) continue;
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
      const result = await executeTool(toolName, toolArgs);
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

  // If the loop ended because of MAX_TOOL_ROUNDS, get a final response
  const lastMessage = messages[messages.length - 1];
  let finalText: string;

  if (lastMessage.role === 'assistant' && 'content' in lastMessage && typeof lastMessage.content === 'string') {
    finalText = lastMessage.content;
  } else {
    // Need one more call to get the final response
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
