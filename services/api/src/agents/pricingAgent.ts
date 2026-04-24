// ─── Pricing Agent ───────────────────────────────────────────────────────────
// Calculates total cost for a product at a given quantity and checks
// against the customer's budget. Deterministic — no LLM needed.

import type { PricingResult } from '../types.js';
import { findProduct } from '../tools/productCatalog.js';

/**
 * Calculate pricing for a product order and check budget fit.
 */
export function calculatePricing(
  productName: string,
  quantity: number,
  budgetDKK: number
): PricingResult {
  const product = findProduct(productName);
  if (!product) {
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

  const totalDKK = product.priceDKK * quantity;
  const budgetDelta = budgetDKK - totalDKK;

  return {
    productName: product.name,
    unitPriceDKK: product.priceDKK,
    quantity,
    totalDKK,
    budgetDKK,
    withinBudget: budgetDelta >= 0,
    budgetDelta,
  };
}
