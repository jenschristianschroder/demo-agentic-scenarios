// ─── Orchestrator Agent ──────────────────────────────────────────────────────
// Coordinates the sequential workflow: generate → fact-check → (revise loop).
// Implements the Microsoft Agent Framework pattern of explicit, deterministic
// workflow orchestration with a conditional revision loop.
//
// Two workflow modes:
//   "review-after-first"  — run one generate + fact-check pass, then stop
//   "auto-revise"         — loop generate → fact-check until approved or max iterations

import type { Response } from 'express';
import type {
  OrchestrationRequest,
  OrchestrationEvent,
  OrchestratorDecision,
  IterationRecord,
  RunSummary,
  GeneratorOutput,
  FactCheckerOutput,
} from '../types.js';
import { runGenerator } from './generator.js';
import { runFactChecker } from './factChecker.js';

/**
 * Run the full orchestration workflow, streaming events via SSE.
 */
export async function runOrchestrator(
  request: OrchestrationRequest,
  res: Response
): Promise<void> {
  const { prompt, creativityLevel, workflowMode, acceptanceThreshold, maxIterations } = request;
  const iterations: IterationRecord[] = [];

  // ── Step 1: User request acknowledged ──────────────────────────────────
  sendEvent(res, {
    type: 'step-start',
    step: 'user-request',
    timestamp: now(),
    data: { message: prompt },
  });
  sendEvent(res, {
    type: 'step-complete',
    step: 'user-request',
    timestamp: now(),
    data: { message: prompt },
  });

  // ── Step 2: Orchestrator starts ────────────────────────────────────────
  sendEvent(res, {
    type: 'step-start',
    step: 'orchestrator',
    timestamp: now(),
    data: makeDecision('generate', 'Starting content generation workflow', 1, maxIterations),
  });

  let currentIteration = 1;
  let approved = false;
  let lastGeneratorOutput: GeneratorOutput | undefined;
  let lastFactCheckerOutput: FactCheckerOutput | undefined;

  while (currentIteration <= maxIterations && !approved) {
    // ── Generate ───────────────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'generator',
      timestamp: now(),
      data: { message: `Generating draft (iteration ${currentIteration})` },
    });

    lastGeneratorOutput = await runGenerator(
      prompt,
      creativityLevel,
      currentIteration,
      lastGeneratorOutput?.draftText,
      lastFactCheckerOutput?.revisionInstructions
    );

    sendEvent(res, {
      type: 'step-complete',
      step: 'generator',
      timestamp: now(),
      data: lastGeneratorOutput,
    });

    // ── Fact-check ─────────────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'fact-checker',
      timestamp: now(),
      data: { message: `Checking ${lastGeneratorOutput.claims.length} claims` },
    });

    lastFactCheckerOutput = await runFactChecker(
      lastGeneratorOutput.claims,
      lastGeneratorOutput.draftText
    );

    sendEvent(res, {
      type: 'step-complete',
      step: 'fact-checker',
      timestamp: now(),
      data: lastFactCheckerOutput,
    });

    // ── Record iteration ───────────────────────────────────────────────
    const decision = evaluateResult(
      lastFactCheckerOutput,
      acceptanceThreshold,
      currentIteration,
      maxIterations,
      workflowMode
    );

    sendEvent(res, {
      type: 'step-complete',
      step: 'orchestrator',
      timestamp: now(),
      data: decision,
    });

    iterations.push({
      iteration: currentIteration,
      generatorOutput: lastGeneratorOutput,
      factCheckerOutput: lastFactCheckerOutput,
      orchestratorDecision: decision,
    });

    // ── Decide next action ─────────────────────────────────────────────
    if (decision.action === 'approve') {
      approved = true;
    } else if (decision.action === 'revise' && workflowMode === 'auto-revise') {
      // Loop: orchestrator sends back to generator
      currentIteration++;
      if (currentIteration <= maxIterations) {
        sendEvent(res, {
          type: 'step-start',
          step: 'orchestrator',
          timestamp: now(),
          data: makeDecision('revise', `Sending back for revision (iteration ${currentIteration})`, currentIteration, maxIterations),
        });
      }
    } else {
      // "review-after-first" mode or rejected — stop after first pass
      break;
    }
  }

  // ── Final summary ────────────────────────────────────────────────────
  const totalClaims = iterations.flatMap((i) => i.factCheckerOutput?.claims ?? []);
  const unsupported = totalClaims.filter((c) => c.status === 'unsupported').length;

  let finalStatus: RunSummary['finalStatus'];
  if (approved) {
    finalStatus = 'approved';
  } else if (workflowMode === 'review-after-first') {
    finalStatus = 'review';
  } else {
    finalStatus = unsupported > 0 ? 'rejected' : 'approved';
  }

  const summary: RunSummary = {
    draftCount: iterations.length,
    claimsChecked: totalClaims.length,
    unsupportedClaims: unsupported,
    finalStatus,
    finalText: lastGeneratorOutput?.draftText ?? '',
    iterations,
  };

  sendEvent(res, {
    type: 'step-start',
    step: 'final-answer',
    timestamp: now(),
    data: { message: 'Compiling final answer' },
  });

  sendEvent(res, {
    type: 'run-complete',
    step: 'final-answer',
    timestamp: now(),
    data: summary,
  });

  // End SSE stream
  res.write('data: [DONE]\n\n');
  res.end();
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function evaluateResult(
  fcOutput: FactCheckerOutput,
  threshold: number,
  iteration: number,
  maxIterations: number,
  workflowMode: string
): OrchestratorDecision {
  if (fcOutput.score >= threshold) {
    return makeDecision(
      'approve',
      `Fact-check score ${(fcOutput.score * 100).toFixed(0)}% meets threshold ${(threshold * 100).toFixed(0)}%`,
      iteration,
      maxIterations
    );
  }

  if (workflowMode === 'review-after-first') {
    return makeDecision(
      'fact-check',
      `Score ${(fcOutput.score * 100).toFixed(0)}% below threshold. Presenting for review.`,
      iteration,
      maxIterations
    );
  }

  if (iteration >= maxIterations) {
    return makeDecision(
      'reject',
      `Max iterations reached. Final score ${(fcOutput.score * 100).toFixed(0)}% still below threshold.`,
      iteration,
      maxIterations
    );
  }

  return makeDecision(
    'revise',
    `Score ${(fcOutput.score * 100).toFixed(0)}% below threshold ${(threshold * 100).toFixed(0)}%. Requesting revision.`,
    iteration,
    maxIterations
  );
}

function makeDecision(
  action: OrchestratorDecision['action'],
  reason: string,
  iteration: number,
  maxIterations: number
): OrchestratorDecision {
  return { action, reason, iteration, maxIterations };
}

function sendEvent(res: Response, event: OrchestrationEvent): void {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function now(): string {
  return new Date().toISOString();
}
