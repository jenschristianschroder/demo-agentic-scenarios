// ─── Pricing Agent ───────────────────────────────────────────────────────────
// Calculates total cost for a product at a given quantity, applies volume
// discounts, and checks against the customer's budget.
// Uses RAG retrieval + LLM with a calculation tool for accurate arithmetic.

import type { PricingResult } from '../types.js';
import { getOpenAIClient } from '../azureClients.js';
import { retrieveDocuments, formatAsContext } from './searchRetriever.js';

const SYSTEM_PROMPT = `You are a Pricing Agent for Contoso Electronics.

Your job is to calculate accurate pricing for a product order, including volume discounts, bundle opportunities, and budget comparison — based on the pricing documentation in the knowledge base.

You MUST use the calculate_pricing tool to perform all arithmetic. Never calculate numbers yourself — always call the tool.

Workflow:
1. Look up the product MSRP from the knowledge base context provided
2. Determine the applicable volume discount tier based on quantity
3. Call the calculate_pricing tool with unitPriceDKK, quantity, and discountPercent
4. Review the result and assess budget fit
5. Identify any applicable bundle or accessory recommendations

Return the final pricing result as JSON matching the provided schema.`;

// ── Tool definition for pricing calculation ──────────────────────────────────
const CALCULATE_PRICING_TOOL = {
  type: 'function' as const,
  function: {
    name: 'calculate_pricing',
    description: 'Calculate total order price with volume discount and budget comparison. Use this for ALL arithmetic — never calculate numbers yourself.',
    parameters: {
      type: 'object',
      properties: {
        unitPriceDKK: {
          type: 'number',
          description: 'The MSRP per-unit price in DKK',
        },
        quantity: {
          type: 'number',
          description: 'Number of units ordered',
        },
        discountPercent: {
          type: 'number',
          description: 'Volume discount percentage to apply (e.g. 5 for 5%)',
        },
        budgetDKK: {
          type: 'number',
          description: 'Total customer budget in DKK',
        },
      },
      required: ['unitPriceDKK', 'quantity', 'discountPercent', 'budgetDKK'],
    },
  },
};

/**
 * Execute the calculate_pricing tool — deterministic arithmetic.
 */
function executeCalculatePricing(args: {
  unitPriceDKK: number;
  quantity: number;
  discountPercent: number;
  budgetDKK: number;
}): {
  unitPriceDKK: number;
  discountedUnitPriceDKK: number;
  quantity: number;
  discountPercent: number;
  totalDKK: number;
  budgetDKK: number;
  withinBudget: boolean;
  budgetDelta: number;
} {
  const discountedUnitPriceDKK = Math.round(args.unitPriceDKK * (1 - args.discountPercent / 100));
  const totalDKK = discountedUnitPriceDKK * args.quantity;
  const budgetDelta = args.budgetDKK - totalDKK;

  return {
    unitPriceDKK: args.unitPriceDKK,
    discountedUnitPriceDKK,
    quantity: args.quantity,
    discountPercent: args.discountPercent,
    totalDKK,
    budgetDKK: args.budgetDKK,
    withinBudget: budgetDelta >= 0,
    budgetDelta,
  };
}

/**
 * Calculate pricing for a product order using RAG + LLM with a calculation tool.
 */
export async function calculatePricing(
  productName: string,
  quantity: number,
  budgetDKK: number
): Promise<PricingResult> {
  const client = getOpenAIClient();

  // ── RAG: retrieve pricing information from Azure AI Search ─────────────
  const searchQuery = `${productName} pricing volume discount MSRP`;
  const docs = await retrieveDocuments(searchQuery, 10);
  const knowledgeContext = formatAsContext(docs);

  const userMessage = `Calculate pricing for the following order:
- Product: ${productName}
- Quantity: ${quantity} units
- Customer budget: DKK ${budgetDKK.toLocaleString()}
${knowledgeContext}

Using the pricing information above, determine the MSRP and applicable volume discount tier, then call the calculate_pricing tool to compute the total. Also note any applicable bundles or accessories.`;

  // ── First LLM call: let the model decide to invoke the tool ────────────
  const response = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
    ],
    tools: [CALCULATE_PRICING_TOOL],
    tool_choice: { type: 'function', function: { name: 'calculate_pricing' } },
  });

  const assistantMessage = response.choices[0]?.message;
  const toolCalls = assistantMessage?.tool_calls;

  if (!toolCalls || toolCalls.length === 0) {
    // Fallback: model didn't call the tool — compute directly
    return {
      productName,
      unitPriceDKK: 0,
      quantity,
      totalDKK: 0,
      budgetDKK,
      withinBudget: false,
      budgetDelta: -budgetDKK,
    };
  }

  // ── Execute tool call ──────────────────────────────────────────────────
  const toolCall = toolCalls[0];
  if (!('function' in toolCall)) throw new Error('Unexpected tool call type');
  const toolArgs = JSON.parse(toolCall.function.arguments);
  const toolResult = executeCalculatePricing(toolArgs);

  // ── Second LLM call: produce final structured result ───────────────────
  const finalResponse = await client.chat.completions.create({
    model: process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    temperature: 0.1,
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: userMessage },
      assistantMessage,
      {
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(toolResult),
      },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'pricing_result',
        strict: true,
        schema: {
          type: 'object',
          properties: {
            productName: { type: 'string' },
            unitPriceDKK: { type: 'number' },
            quantity: { type: 'number' },
            totalDKK: { type: 'number' },
            budgetDKK: { type: 'number' },
            withinBudget: { type: 'boolean' },
            budgetDelta: { type: 'number' },
            accessories: { type: 'string' },
          },
          required: ['productName', 'unitPriceDKK', 'quantity', 'totalDKK', 'budgetDKK', 'withinBudget', 'budgetDelta', 'accessories'],
          additionalProperties: false,
        },
      },
    },
  });

  const content = finalResponse.choices[0]?.message?.content;
  if (!content) throw new Error('Pricing Agent received empty response');

  return JSON.parse(content) as PricingResult;
}
