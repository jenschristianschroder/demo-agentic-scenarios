// ─── Smart Home Bundle Orchestrator ──────────────────────────────────────────
// Coordinates the Smart Home Bundle Builder agents:
//   User → Needs → Device → Privacy → Compatibility → Bundle
// Streams all steps and inter-agent communication via SSE.

import type { Response } from 'express';
import type {
  SmartHomeRequest,
  SmartHomeEvent,
  SmartHomeAgentMessage,
  SmartHomeBundleSummary,
  HomeNeeds,
  DeviceRecommendation,
  PrivacyAssessment,
  CompatibilityResult,
} from '../types.js';
import { analyzeNeeds } from './smartHome/needsAgent.js';
import { recommendDevices } from './smartHome/deviceAgent.js';
import { reviewPrivacy } from './smartHome/privacyAgent.js';
import { checkCompatibility } from './smartHome/compatibilityAgent.js';
import { assembleBundle } from './smartHome/bundleAgent.js';

export async function runSmartHomeOrchestrator(
  request: SmartHomeRequest,
  res: Response
): Promise<void> {
  const { prompt, creativityLevel } = request;
  const agentMessages: SmartHomeAgentMessage[] = [];

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

    // ── Orchestrator → Needs Agent ─────────────────────────────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'orchestrator',
      to: 'needs-agent',
      message: `New smart home request received. Analyze the following: "${prompt}"`,
      timestamp: now(),
      type: 'instruction',
    });

    // ── Step 2: Needs Analysis ─────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'needs-analysis',
      timestamp: now(),
      data: null,
    });

    const needs: HomeNeeds = await analyzeNeeds(prompt, creativityLevel);

    sendEvent(res, {
      type: 'step-complete',
      step: 'needs-analysis',
      timestamp: now(),
      data: needs,
    });

    // ── Needs Agent → Orchestrator ─────────────────────────────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'needs-agent',
      to: 'orchestrator',
      message: `Needs identified: ${needs.spaceType} (${needs.spaceSize}), privacy level: ${needs.privacyLevel}, budget: DKK ${needs.budgetDKK.toLocaleString()}. Priorities: ${needs.priorities.join(', ')}.`,
      timestamp: now(),
      type: 'finding',
    });

    // ── Orchestrator → Device Agent ────────────────────────────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'orchestrator',
      to: 'device-agent',
      message: `Recommend smart home devices for a ${needs.spaceType} with ${needs.privacyLevel} privacy needs. Budget: DKK ${needs.budgetDKK.toLocaleString()}.`,
      timestamp: now(),
      type: 'handoff',
    });

    // ── Step 3: Device Recommendation ──────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'device-recommendation',
      timestamp: now(),
      data: null,
    });

    const devices: DeviceRecommendation[] = await recommendDevices(needs);

    sendEvent(res, {
      type: 'step-complete',
      step: 'device-recommendation',
      timestamp: now(),
      data: devices,
    });

    // ── Device Agent → Orchestrator ────────────────────────────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'device-agent',
      to: 'orchestrator',
      message: `Recommending ${devices.length} devices: ${devices.map(d => d.name).join(', ')}. Total estimated: DKK ${devices.reduce((s, d) => s + d.priceDKK, 0).toLocaleString()}.`,
      timestamp: now(),
      type: 'finding',
    });

    // ── Device Agent → Privacy Agent (key communication!) ──────────────────
    const hubDevice = devices.find(d => d.category.toLowerCase().includes('hub'));
    if (hubDevice) {
      sendAgentMessage(res, agentMessages, {
        from: 'device-agent',
        to: 'privacy-agent',
        message: `Candidate device: ${hubDevice.name}. ${hubDevice.privacyFeatures.length > 0 ? `Privacy features: ${hubDevice.privacyFeatures.join(', ')}.` : 'No privacy features listed.'}`,
        timestamp: now(),
        type: 'handoff',
      });
    }

    // ── Step 4: Privacy Review ─────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'privacy-review',
      timestamp: now(),
      data: null,
    });

    const privacyAssessments: PrivacyAssessment[] = [];
    for (const device of devices) {
      const assessment = await reviewPrivacy(device, needs.privacyLevel);
      privacyAssessments.push(assessment);
    }

    // Send the primary privacy assessment (hub) as step-complete data
    const primaryAssessment = privacyAssessments.find(p =>
      p.hasCamera || p.hasMicrophone
    ) ?? privacyAssessments[0];

    sendEvent(res, {
      type: 'step-complete',
      step: 'privacy-review',
      timestamp: now(),
      data: primaryAssessment,
    });

    // ── Privacy Agent → Device Agent (approval/condition/objection) ────────
    for (const assessment of privacyAssessments) {
      if (assessment.privacyRating === 'approved') {
        sendAgentMessage(res, agentMessages, {
          from: 'privacy-agent',
          to: 'device-agent',
          message: `${assessment.deviceName}: APPROVED. ${assessment.hasPrivacyShutter ? 'Hardware privacy shutter confirmed.' : ''} ${assessment.hasHardwareMuteSwitch ? 'Hardware mute switch confirmed.' : ''} ${assessment.localProcessing ? 'Local processing available.' : ''}`,
          timestamp: now(),
          type: 'approval',
        });
      } else if (assessment.privacyRating === 'conditional') {
        sendAgentMessage(res, agentMessages, {
          from: 'privacy-agent',
          to: 'device-agent',
          message: `${assessment.deviceName}: CONDITIONAL. ${assessment.conditions.join('. ')}.`,
          timestamp: now(),
          type: 'condition',
        });
      } else {
        sendAgentMessage(res, agentMessages, {
          from: 'privacy-agent',
          to: 'device-agent',
          message: `${assessment.deviceName}: REJECTED. ${assessment.concerns.join('. ')}.`,
          timestamp: now(),
          type: 'objection',
        });
      }
    }

    // ── Orchestrator → Compatibility Agent ─────────────────────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'orchestrator',
      to: 'compatibility-agent',
      message: `Check protocol compatibility between: ${devices.map(d => d.name).join(', ')}.`,
      timestamp: now(),
      type: 'handoff',
    });

    // ── Step 5: Compatibility Check ────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'compatibility-check',
      timestamp: now(),
      data: null,
    });

    const compatResults: CompatibilityResult[] = await checkCompatibility(devices);

    sendEvent(res, {
      type: 'step-complete',
      step: 'compatibility-check',
      timestamp: now(),
      data: compatResults,
    });

    // ── Compatibility Agent → Bundle Agent (key communication!) ────────────
    const allCompatible = compatResults.every(c => c.issues.length === 0);
    const compatSummary = compatResults.map(c =>
      `${c.deviceName}: ${c.protocols.join(', ')}${c.issues.length > 0 ? ` — ISSUES: ${c.issues.join('; ')}` : ''}`
    ).join('. ');

    sendAgentMessage(res, agentMessages, {
      from: 'compatibility-agent',
      to: 'bundle-agent',
      message: `Compatibility check ${allCompatible ? 'passed' : 'has issues'}. ${compatSummary}.`,
      timestamp: now(),
      type: allCompatible ? 'finding' : 'concern',
    });

    // ── Orchestrator → Bundle Agent ────────────────────────────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'orchestrator',
      to: 'bundle-agent',
      message: `All reviews complete. Assemble the final bundle for ${needs.spaceType}. Privacy: ${privacyAssessments.every(p => p.privacyRating !== 'rejected') ? 'all approved' : 'some rejected'}. Compatibility: ${allCompatible ? 'all compatible' : 'issues found'}.`,
      timestamp: now(),
      type: 'handoff',
    });

    // ── Step 6: Bundle Assembly ────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'bundle-assembly',
      timestamp: now(),
      data: null,
    });

    const bundle = await assembleBundle(
      needs,
      devices,
      privacyAssessments,
      compatResults,
      agentMessages
    );

    sendEvent(res, {
      type: 'step-complete',
      step: 'bundle-assembly',
      timestamp: now(),
      data: { text: bundle.setupPlan },
    });

    // ── Bundle Agent → Orchestrator ────────────────────────────────────────
    sendAgentMessage(res, agentMessages, {
      from: 'bundle-agent',
      to: 'orchestrator',
      message: `Bundle "${bundle.bundleName}" assembled. ${bundle.items.length} items, total DKK ${bundle.totalPriceDKK.toLocaleString()}. ${bundle.withinBudget ? 'Within budget.' : 'Over budget.'} Setup plan ready.`,
      timestamp: now(),
      type: 'recommendation',
    });

    // ── Step 7: Final Bundle ───────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'final-bundle',
      timestamp: now(),
      data: null,
    });

    sendAgentMessage(res, agentMessages, {
      from: 'orchestrator',
      to: 'bundle-agent',
      message: `Bundle approved and delivered to customer.`,
      timestamp: now(),
      type: 'recommendation',
    });

    sendEvent(res, {
      type: 'step-complete',
      step: 'final-bundle',
      timestamp: now(),
      data: bundle,
    });

    // ── Run complete ───────────────────────────────────────────────────────
    sendEvent(res, {
      type: 'run-complete',
      step: 'final-bundle',
      timestamp: now(),
      data: bundle,
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

function sendEvent(res: Response, event: SmartHomeEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function sendAgentMessage(
  res: Response,
  messages: SmartHomeAgentMessage[],
  msg: SmartHomeAgentMessage
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
