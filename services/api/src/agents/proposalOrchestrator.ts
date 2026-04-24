// ─── Sales Proposal Orchestrator ─────────────────────────────────────────────
// Coordinates the Sales Proposal Team:
//   User → Customer Intake → Product Specialist → Pricing → Support → Proposal Writer
// Streams all steps and inter-agent communication via SSE.

import type { Response } from 'express';
import type {
  ProposalRequest,
  ProposalEvent,
  ProposalAgentMessage,
  ProposalSummary,
  CustomerRequirements,
  ProductCandidate,
  PricingResult,
  SupportAssessment,
} from '../types.js';
import { runCustomerIntake } from './customerIntake.js';
import { findProductCandidates } from './productSpecialist.js';
import { calculatePricing } from './pricingAgent.js';
import { assessSupport } from './supportAgent.js';
import { writeProposal } from './proposalWriter.js';

export async function runProposalOrchestrator(
  request: ProposalRequest,
  res: Response
): Promise<void> {
  const { prompt, creativityLevel } = request;
  const agentMessages: ProposalAgentMessage[] = [];

  try {
    // ── Step 1: User request ───────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'user-request',
      timestamp: now(),
      data: { text: prompt },
    });
    sendEvent(res, {
      type: 'step-complete',
      step: 'user-request',
      timestamp: now(),
      data: { text: prompt },
    });

    // ── Agent message: Orchestrator assigns intake ─────────────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'orchestrator',
      to: 'customer-intake',
      message: `New customer request received. Parse the following into structured requirements: "${prompt}"`,
      timestamp: now(),
      type: 'instruction',
    });

    // ── Step 2: Customer Intake ────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'customer-intake',
      timestamp: now(),
      data: null,
    });

    const requirements: CustomerRequirements = await runCustomerIntake(prompt, creativityLevel);

    sendEvent(res, {
      type: 'step-complete',
      step: 'customer-intake',
      timestamp: now(),
      data: requirements,
    });

    // ── Agent message: Intake reports back ─────────────────────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'customer-intake',
      to: 'orchestrator',
      message: `Requirements extracted: ${requirements.quantity} devices, budget DKK ${requirements.budgetDKK.toLocaleString()}, use case: ${requirements.useCase}. Priorities: ${requirements.priorities.join(', ')}.`,
      timestamp: now(),
      type: 'finding',
    });

    // ── Agent message: Orchestrator hands off to product specialist ────────
    sendAgentMessage(res, agentMessages, {
      from: 'orchestrator',
      to: 'product-specialist',
      message: `Search the catalog for ${requirements.quantity} laptops matching: ${requirements.priorities.join(', ')}. Budget per unit: DKK ${Math.floor(requirements.budgetDKK / requirements.quantity).toLocaleString()}.`,
      timestamp: now(),
      type: 'handoff',
    });

    // ── Step 3: Product Search ─────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'product-search',
      timestamp: now(),
      data: null,
    });

    const candidates: ProductCandidate[] = await findProductCandidates(requirements);
    const topCandidates = candidates.slice(0, 3); // Top 3 for the demo

    sendEvent(res, {
      type: 'step-complete',
      step: 'product-search',
      timestamp: now(),
      data: topCandidates,
    });

    // ── Agent message: Specialist reports findings ─────────────────────────
    const recommended = topCandidates[0];
    const alternative = topCandidates[1];

    sendAgentMessage(res, agentMessages, {
      from: 'product-specialist',
      to: 'orchestrator',
      message: `Found ${candidates.length} products. Top recommendation: ${recommended.name} (fit score ${recommended.fitScore}). ${recommended.fitReason}. Alternative: ${alternative?.name ?? 'none'}.`,
      timestamp: now(),
      type: 'finding',
    });

    // ── Agent message: Orchestrator sends to pricing ───────────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'orchestrator',
      to: 'pricing',
      message: `Calculate pricing for ${requirements.quantity}× ${recommended.name} (DKK ${recommended.priceDKK.toLocaleString()}/unit) against budget DKK ${requirements.budgetDKK.toLocaleString()}.${alternative ? ` Also price ${alternative.name} as alternative.` : ''}`,
      timestamp: now(),
      type: 'handoff',
    });

    // ── Step 4: Pricing ────────────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'pricing',
      timestamp: now(),
      data: null,
    });

    const pricing: PricingResult = calculatePricing(
      recommended.name,
      requirements.quantity,
      requirements.budgetDKK
    );
    let altPricing: PricingResult | undefined;
    if (alternative) {
      altPricing = calculatePricing(alternative.name, requirements.quantity, requirements.budgetDKK);
    }

    sendEvent(res, {
      type: 'step-complete',
      step: 'pricing',
      timestamp: now(),
      data: pricing,
    });

    // ── Agent message: Pricing reports ─────────────────────────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'pricing',
      to: 'orchestrator',
      message: `${recommended.name}: ${requirements.quantity}× DKK ${pricing.unitPriceDKK.toLocaleString()} = DKK ${pricing.totalDKK.toLocaleString()}. ${pricing.withinBudget ? `Within budget (DKK ${pricing.budgetDelta.toLocaleString()} remaining).` : `Over budget by DKK ${Math.abs(pricing.budgetDelta).toLocaleString()}.`}${altPricing ? ` Alternative ${alternative!.name}: DKK ${altPricing.totalDKK.toLocaleString()} (${altPricing.withinBudget ? 'within' : 'over'} budget).` : ''}`,
      timestamp: now(),
      type: pricing.withinBudget ? 'finding' : 'concern',
    });

    // ── Agent message: Orchestrator sends to support ───────────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'orchestrator',
      to: 'support-warranty',
      message: `Assess warranty and business support for ${recommended.name}.${alternative ? ` Also assess ${alternative.name}.` : ''} Customer needs: ${requirements.warrantyNeeds}.`,
      timestamp: now(),
      type: 'handoff',
    });

    // ── Step 5: Support Check ──────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'support-check',
      timestamp: now(),
      data: null,
    });

    const support: SupportAssessment = assessSupport(recommended.name);
    let altSupport: SupportAssessment | undefined;
    if (alternative) {
      altSupport = assessSupport(alternative.name);
    }

    sendEvent(res, {
      type: 'step-complete',
      step: 'support-check',
      timestamp: now(),
      data: support,
    });

    // ── Agent message: Support reports ─────────────────────────────────────
    if (support.concerns.length > 0) {
      sendAgentMessage(res, agentMessages, {
        from: 'support-warranty',
        to: 'orchestrator',
        message: `${recommended.name} support assessment: ${support.suitability}. Concerns: ${support.concerns.join('; ')}.`,
        timestamp: now(),
        type: 'concern',
      });
    } else {
      sendAgentMessage(res, agentMessages, {
        from: 'support-warranty',
        to: 'orchestrator',
        message: `${recommended.name} support assessment: ${support.suitability}. ${support.warrantyType}, ${support.warrantyDuration}, on-site: ${support.onsiteService ? 'yes' : 'no'}.`,
        timestamp: now(),
        type: 'finding',
      });
    }

    // ── Build trade-offs ───────────────────────────────────────────────────
    const tradeOffs: string[] = [];
    if (!pricing.withinBudget) {
      tradeOffs.push(`${recommended.name} exceeds budget by DKK ${Math.abs(pricing.budgetDelta).toLocaleString()}`);
    }
    if (support.suitability !== 'recommended') {
      tradeOffs.push(`${recommended.name} warranty rated "${support.suitability}" — ${support.concerns.join('; ')}`);
    }
    if (alternative && altPricing && altPricing.withinBudget && !pricing.withinBudget) {
      tradeOffs.push(`Alternative ${alternative.name} fits budget at DKK ${altPricing.totalDKK.toLocaleString()} but may have different specs`);
    }

    // ── Agent message: Orchestrator assigns proposal writer ────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'orchestrator',
      to: 'proposal-writer',
      message: `All specialist analyses complete. Draft a proposal recommending ${recommended.name}${alternative ? ` with ${alternative.name} as alternative` : ''}. ${tradeOffs.length > 0 ? `Trade-offs to address: ${tradeOffs.join('; ')}` : 'No major trade-offs.'}`,
      timestamp: now(),
      type: 'handoff',
    });

    // ── Step 6: Proposal Draft ─────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'proposal-draft',
      timestamp: now(),
      data: null,
    });

    const proposal = await writeProposal(
      requirements,
      recommended,
      pricing,
      support,
      alternative,
      altPricing,
      altSupport,
      tradeOffs
    );

    sendEvent(res, {
      type: 'step-complete',
      step: 'proposal-draft',
      timestamp: now(),
      data: { text: proposal.proposalText },
    });

    // ── Agent message: Writer delivers proposal ────────────────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'proposal-writer',
      to: 'orchestrator',
      message: `Proposal draft complete. Recommending ${recommended.name} for ${requirements.quantity} units at DKK ${pricing.totalDKK.toLocaleString()}.`,
      timestamp: now(),
      type: 'recommendation',
    });

    // ── Step 7: Final Proposal ─────────────────────────────────────────────
    const summary: ProposalSummary = {
      recommendedProduct: recommended.name,
      alternativeProduct: alternative?.name,
      totalCost: pricing.totalDKK,
      budgetDKK: requirements.budgetDKK,
      withinBudget: pricing.withinBudget,
      warrantyOk: support.suitability !== 'not-recommended',
      proposalText: proposal.proposalText,
      tradeOffs: proposal.tradeOffs,
      agentMessages,
    };

    sendEvent(res, {
      type: 'step-start',
      step: 'final-proposal',
      timestamp: now(),
      data: null,
    });

    sendAgentMessage(res, agentMessages, {
      from: 'orchestrator',
      to: 'proposal-writer',
      message: `Proposal approved and delivered to customer.`,
      timestamp: now(),
      type: 'recommendation',
    });

    sendEvent(res, {
      type: 'step-complete',
      step: 'final-proposal',
      timestamp: now(),
      data: summary,
    });

    // ── Run complete ───────────────────────────────────────────────────────
    sendEvent(res, {
      type: 'run-complete',
      step: 'final-proposal',
      timestamp: now(),
      data: summary,
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    sendEvent(res, {
      type: 'error',
      step: 'user-request',
      timestamp: now(),
      data: { message },
    });
  }

  res.end();
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function sendEvent(res: Response, event: ProposalEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function sendAgentMessage(
  res: Response,
  messages: ProposalAgentMessage[],
  msg: ProposalAgentMessage
): void {
  messages.push(msg);
  sendEvent(res, {
    type: 'agent-message',
    step: 'user-request',
    timestamp: msg.timestamp,
    data: msg,
  });
}

function now(): string {
  return new Date().toISOString();
}
