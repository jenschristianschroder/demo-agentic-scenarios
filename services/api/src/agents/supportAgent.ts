// ─── Support & Warranty Agent ────────────────────────────────────────────────
// Assesses whether a product's warranty and support terms are suitable
// for a business deployment. Deterministic — uses catalog data directly.

import type { SupportAssessment } from '../types.js';
import { findProduct } from '../tools/productCatalog.js';

/**
 * Assess the support and warranty suitability of a product for business use.
 */
export function assessSupport(productName: string): SupportAssessment {
  const product = findProduct(productName);
  if (!product) {
    return {
      productName,
      warrantyType: 'Unknown',
      warrantyDuration: 'Unknown',
      businessSupport: false,
      onsiteService: false,
      replacementTerms: 'Unknown',
      suitability: 'not-recommended',
      concerns: ['Product not found in catalog'],
    };
  }

  const warranty = product.warranty.toLowerCase();
  const onsiteService = warranty.includes('on-site');
  const hasAccidentalDamage = warranty.includes('accidental damage');
  const businessSupport = onsiteService || product.os.includes('Pro');
  const concerns: string[] = [];

  // Parse warranty duration
  const durationMatch = product.warranty.match(/(\d+)\s*year/);
  const durationYears = durationMatch ? parseInt(durationMatch[1], 10) : 1;

  // Determine replacement terms
  let replacementTerms: string;
  if (warranty.includes('next-business-day')) {
    replacementTerms = 'Next-business-day replacement';
  } else if (onsiteService) {
    replacementTerms = 'On-site repair within 2 business days';
  } else {
    replacementTerms = 'Carry-in repair, 5 business days average turnaround';
  }

  // Build concerns
  if (!onsiteService) {
    concerns.push('No on-site service — carry-in only');
  }
  if (!product.os.includes('Pro')) {
    concerns.push(`Ships with ${product.os} — not Windows 11 Pro`);
  }
  if (durationYears < 3) {
    concerns.push(`Only ${durationYears}-year warranty — below typical 3-year business standard`);
  }
  if (warranty.includes('carry-in') && !warranty.includes('on-site')) {
    concerns.push('Carry-in warranty requires shipping device — field sales downtime risk');
  }

  // Determine suitability
  let suitability: SupportAssessment['suitability'];
  if (onsiteService && businessSupport && durationYears >= 3) {
    suitability = 'recommended';
  } else if (businessSupport || durationYears >= 2) {
    suitability = 'acceptable';
  } else {
    suitability = 'not-recommended';
  }

  return {
    productName: product.name,
    warrantyType: hasAccidentalDamage ? 'On-site with accidental damage protection' : product.warranty,
    warrantyDuration: `${durationYears} year${durationYears > 1 ? 's' : ''}`,
    businessSupport,
    onsiteService,
    replacementTerms,
    suitability,
    concerns,
  };
}
