// ─── Product Specialist Agent ────────────────────────────────────────────────
// Searches the Contoso product catalog to find devices matching customer
// requirements. Uses deterministic catalog lookups for reliability.

import type { CustomerRequirements, ProductCandidate } from '../types.js';
import { PRODUCTS } from '../tools/productCatalog.js';
import type { Product } from '../tools/productCatalog.js';

/**
 * Parse battery hours from the battery string (e.g. "72 Wh, up to 16 hours" → 16).
 */
function parseBatteryHours(battery: string): number {
  const match = battery.match(/up to (\d+) hours/);
  return match ? parseInt(match[1], 10) : 0;
}

/**
 * Parse weight in kg from the weight string (e.g. "1.29 kg (2.84 lbs)" → 1.29).
 */
function parseWeightKg(weight: string): number {
  const match = weight.match(/([\d.]+)\s*kg/);
  return match ? parseFloat(match[1]) : 99;
}

/**
 * Score a product against customer requirements.
 */
function scoreProduct(product: Product, reqs: CustomerRequirements): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Only consider laptops (not tablets)
  if (product.os.includes('Android')) {
    return { score: -1, reasons: ['Not a laptop — tablet excluded'] };
  }

  // Battery priority
  const batteryHours = parseBatteryHours(product.battery);
  if (reqs.priorities.some(p => p.toLowerCase().includes('battery'))) {
    if (batteryHours >= 16) { score += 3; reasons.push(`Excellent battery: ${batteryHours}h`); }
    else if (batteryHours >= 12) { score += 2; reasons.push(`Good battery: ${batteryHours}h`); }
    else { score += 1; reasons.push(`Moderate battery: ${batteryHours}h`); }
  } else {
    if (batteryHours >= 12) { score += 1; reasons.push(`${batteryHours}h battery`); }
  }

  // Weight priority
  const weightKg = parseWeightKg(product.weight);
  if (reqs.priorities.some(p => p.toLowerCase().includes('weight') || p.toLowerCase().includes('light') || p.toLowerCase().includes('portable'))) {
    if (weightKg <= 1.0) { score += 3; reasons.push(`Ultra-light: ${product.weight}`); }
    else if (weightKg <= 1.5) { score += 2; reasons.push(`Lightweight: ${product.weight}`); }
    else { score += 1; reasons.push(`${product.weight}`); }
  }

  // Business OS
  if (product.os.includes('Pro')) { score += 2; reasons.push('Windows 11 Pro'); }
  else if (product.os.includes('Home')) { score += 1; reasons.push('Windows 11 Home (not Pro)'); }
  else { reasons.push(product.os); }

  // Warranty/business support
  if (product.warranty.includes('on-site')) { score += 2; reasons.push(`Business warranty: ${product.warranty}`); }
  else { reasons.push(`Warranty: ${product.warranty}`); }

  // Budget fit (per unit)
  const perUnitBudget = reqs.budgetDKK / reqs.quantity;
  if (product.priceDKK <= perUnitBudget) { score += 2; reasons.push('Within per-unit budget'); }
  else { reasons.push(`Over per-unit budget by DKK ${(product.priceDKK - perUnitBudget).toLocaleString()}`); }

  return { score, reasons };
}

/**
 * Find candidate products sorted by fit score.
 */
export function findProductCandidates(reqs: CustomerRequirements): ProductCandidate[] {
  const candidates: ProductCandidate[] = [];

  for (const product of Object.values(PRODUCTS)) {
    const { score, reasons } = scoreProduct(product, reqs);
    if (score < 0) continue; // excluded (e.g. tablets)

    candidates.push({
      name: product.name,
      category: product.category,
      priceDKK: product.priceDKK,
      keySpecs: `${product.processor}, ${product.memory}, ${product.storage}`,
      batteryLife: product.battery,
      weight: product.weight,
      warranty: product.warranty,
      fitScore: score,
      fitReason: reasons.join('. '),
    });
  }

  return candidates.sort((a, b) => b.fitScore - a.fitScore);
}
