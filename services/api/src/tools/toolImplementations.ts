// ─── Tool Implementations ────────────────────────────────────────────────────
// Each tool is a function that takes parsed arguments and returns a result.
// These are invoked by the tool agent when the model requests a function call.

import { findProduct, listProductNames, type Product } from './productCatalog.js';
import { retrieveDocuments } from '../agents/searchRetriever.js';

// ─── Exchange rates (fixed for demo reproducibility) ─────────────────────────

const EXCHANGE_RATES: Record<string, number> = {
  DKK: 1,
  EUR: 0.1341,
  USD: 0.1462,
  GBP: 0.1159,
  SEK: 1.4876,
  NOK: 1.4512,
};

// ─── Tool: search_knowledge_base ─────────────────────────────────────────────

export async function searchKnowledgeBase(args: { query: string; top_k?: number }): Promise<unknown> {
  const docs = await retrieveDocuments(args.query, args.top_k ?? 5);
  if (docs.length === 0) {
    return { results: [], message: 'No matching documents found in the knowledge base.' };
  }
  return {
    results: docs.map((d, i) => ({
      rank: i + 1,
      title: d.title,
      source: d.source,
      score: d.score,
      content: d.content,
    })),
  };
}

// ─── Tool: get_product_details ───────────────────────────────────────────────

export function getProductDetails(args: { product_name: string }): unknown {
  const product = findProduct(args.product_name);
  if (!product) {
    return {
      error: `Product "${args.product_name}" not found.`,
      available_products: listProductNames(),
    };
  }
  return product;
}

// ─── Tool: compare_products ──────────────────────────────────────────────────

export function compareProducts(args: { product_a: string; product_b: string }): unknown {
  const a = findProduct(args.product_a);
  const b = findProduct(args.product_b);

  if (!a || !b) {
    const missing = [];
    if (!a) missing.push(args.product_a);
    if (!b) missing.push(args.product_b);
    return {
      error: `Product(s) not found: ${missing.join(', ')}`,
      available_products: listProductNames(),
    };
  }

  const fields: (keyof Product)[] = ['category', 'display', 'processor', 'memory', 'storage', 'graphics', 'battery', 'weight', 'priceDKK', 'priceEUR', 'warranty'];
  const comparison: Record<string, { [key: string]: unknown }> = {};

  for (const field of fields) {
    comparison[field] = {
      [a.name]: a[field] ?? 'N/A',
      [b.name]: b[field] ?? 'N/A',
    };
  }

  return { comparison, products: [a.name, b.name] };
}

// ─── Tool: calculate_price ───────────────────────────────────────────────────

export function calculatePrice(args: {
  product_name: string;
  target_currency: string;
  quantity?: number;
}): unknown {
  const product = findProduct(args.product_name);
  if (!product) {
    return {
      error: `Product "${args.product_name}" not found.`,
      available_products: listProductNames(),
    };
  }

  const currency = args.target_currency.toUpperCase();
  const rate = EXCHANGE_RATES[currency];
  if (!rate) {
    return {
      error: `Unsupported currency: ${currency}`,
      supported_currencies: Object.keys(EXCHANGE_RATES),
    };
  }

  const qty = args.quantity ?? 1;
  const unitPrice = Math.round(product.priceDKK * rate * 100) / 100;
  const totalPrice = Math.round(unitPrice * qty * 100) / 100;

  return {
    product: product.name,
    unit_price_dkk: product.priceDKK,
    unit_price_converted: unitPrice,
    currency,
    quantity: qty,
    total_price: totalPrice,
    exchange_rate: `1 DKK = ${rate} ${currency}`,
  };
}

// ─── Tool: check_warranty_status ─────────────────────────────────────────────

export function checkWarrantyStatus(args: {
  product_name: string;
  purchase_date: string;
}): unknown {
  const product = findProduct(args.product_name);
  if (!product) {
    return {
      error: `Product "${args.product_name}" not found.`,
      available_products: listProductNames(),
    };
  }

  const purchaseDate = new Date(args.purchase_date);
  if (isNaN(purchaseDate.getTime())) {
    return { error: `Invalid date: "${args.purchase_date}". Use YYYY-MM-DD format.` };
  }

  // Extract warranty years from string like "3 years on-site"
  const yearsMatch = product.warranty.match(/(\d+)\s*year/i);
  const warrantyYears = yearsMatch ? parseInt(yearsMatch[1], 10) : 1;

  const expiryDate = new Date(purchaseDate);
  expiryDate.setFullYear(expiryDate.getFullYear() + warrantyYears);

  const now = new Date();
  const isValid = now < expiryDate;
  const daysRemaining = Math.ceil((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  return {
    product: product.name,
    warranty_terms: product.warranty,
    warranty_years: warrantyYears,
    purchase_date: args.purchase_date,
    expiry_date: expiryDate.toISOString().split('T')[0],
    is_valid: isValid,
    days_remaining: isValid ? daysRemaining : 0,
    status: isValid ? 'ACTIVE' : 'EXPIRED',
  };
}

// ─── Tool dispatcher ─────────────────────────────────────────────────────────

export async function executeTool(
  name: string,
  args: Record<string, unknown>
): Promise<unknown> {
  switch (name) {
    case 'search_knowledge_base':
      return searchKnowledgeBase(args as Parameters<typeof searchKnowledgeBase>[0]);
    case 'get_product_details':
      return getProductDetails(args as Parameters<typeof getProductDetails>[0]);
    case 'compare_products':
      return compareProducts(args as Parameters<typeof compareProducts>[0]);
    case 'calculate_price':
      return calculatePrice(args as Parameters<typeof calculatePrice>[0]);
    case 'check_warranty_status':
      return checkWarrantyStatus(args as Parameters<typeof checkWarrantyStatus>[0]);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}
