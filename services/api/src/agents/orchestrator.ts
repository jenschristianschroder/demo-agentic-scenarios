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
  AgentMessage,
  RevisionOutput,
} from '../types.js';
import { runGenerator } from './generator.js';
import { runFactChecker } from './factChecker.js';
import { runRevisionAgent } from './revisionAgent.js';
import { retrieveDocuments, formatAsContext } from './searchRetriever.js';

/**
 * Run the full orchestration workflow, streaming events via SSE.
 */
export async function runOrchestrator(
  request: OrchestrationRequest,
  res: Response
): Promise<void> {
  const { prompt, creativityLevel, workflowMode, acceptanceThreshold, maxIterations, generatorKnowledgeSource } = request;
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
      generatorKnowledgeSource,
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

function sendAgentMessage(
  res: Response,
  msg: AgentMessage
): void {
  sendEvent(res, {
    type: 'agent-message',
    step: msg.from,
    timestamp: msg.timestamp,
    data: msg,
  });
}

/**
 * Run the RAG Failure & Recovery orchestration workflow.
 * Generator → Fact-Checker → Revision Agent → re-verify loop.
 * Emits visible inter-agent communication messages showing the full
 * delegation chain between agents.
 */
export async function runRagFailureOrchestrator(
  request: OrchestrationRequest,
  res: Response
): Promise<void> {
  const { prompt, creativityLevel, acceptanceThreshold, maxIterations } = request;
  const iterations: IterationRecord[] = [];

  // ── Step 1: User request ───────────────────────────────────────────────
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
    data: makeDecision('generate', 'Starting RAG failure & recovery workflow — generating initial draft', 1, maxIterations),
  });

  let currentIteration = 1;
  let approved = false;
  let lastGeneratorOutput: GeneratorOutput | undefined;
  let lastFactCheckerOutput: FactCheckerOutput | undefined;
  let currentDraftText: string | undefined;

  while (currentIteration <= maxIterations && !approved) {
    const iterationMessages: AgentMessage[] = [];

    // ── Orchestrator assigns task to Generator ─────────────────────────
    const assignMsg: AgentMessage = {
      from: 'orchestrator',
      to: 'generator',
      message: currentIteration === 1
        ? `Generate a product page for the Contoso AirBook S5 based on the user's prompt. Extract all factual claims for verification.`
        : `Re-extract factual claims from the revised draft and prepare them for re-verification.`,
      timestamp: now(),
      type: 'instruction',
    };
    iterationMessages.push(assignMsg);
    sendAgentMessage(res, assignMsg);

    // ── Generate ───────────────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'generator',
      timestamp: now(),
      data: { message: currentIteration === 1
        ? 'Generating initial product page draft'
        : `Re-extracting claims from revised text (iteration ${currentIteration})` },
    });

    if (currentIteration === 1) {
      // First iteration: generator creates initial draft (intentionally without knowledge source)
      lastGeneratorOutput = await runGenerator(
        prompt,
        creativityLevel,
        currentIteration,
        false, // no knowledge source on first pass — let it hallucinate
      );
      currentDraftText = lastGeneratorOutput.draftText;
    } else {
      // Subsequent iterations: generator re-extracts claims from the revised text
      lastGeneratorOutput = await runGenerator(
        `Extract factual claims from this product page and verify them:\n\n${currentDraftText}`,
        0.1, // low creativity for claim extraction
        currentIteration,
        true, // use knowledge source for verification
      );
      // Keep the revised text, just update claims
      lastGeneratorOutput = {
        ...lastGeneratorOutput,
        draftText: currentDraftText!,
      };
    }

    sendEvent(res, {
      type: 'step-complete',
      step: 'generator',
      timestamp: now(),
      data: lastGeneratorOutput,
    });

    // ── Generator hands off to Fact Checker ────────────────────────────
    const handoffToFcMsg: AgentMessage = {
      from: 'generator',
      to: 'fact-checker',
      message: currentIteration === 1
        ? `Draft complete with ${lastGeneratorOutput.claims.length} factual claims extracted. Sending for fact-check verification.`
        : `Re-extracted ${lastGeneratorOutput.claims.length} claims from revised draft. Sending for re-verification.`,
      timestamp: now(),
      type: 'handoff',
    };
    iterationMessages.push(handoffToFcMsg);
    sendAgentMessage(res, handoffToFcMsg);

    // ── Fact-check ─────────────────────────────────────────────────────
    sendEvent(res, {
      type: 'step-start',
      step: 'fact-checker',
      timestamp: now(),
      data: { message: `Checking ${lastGeneratorOutput.claims.length} claims against product catalog` },
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

    // ── Fact Checker reports findings to Orchestrator ───────────────────
    const unsupportedClaims = lastFactCheckerOutput.claims.filter(c => c.status === 'unsupported');
    const supportedCount = lastFactCheckerOutput.claims.filter(c => c.status === 'supported').length;

    if (unsupportedClaims.length > 0) {
      // Consolidate all unsupported claims into a single finding message
      const claimDetails = unsupportedClaims
        .map((c, i) => `(${i + 1}) "${c.text}" — ${c.evidence ?? 'No matching catalog entry'}`)
        .join(' ');
      const findingMsg: AgentMessage = {
        from: 'fact-checker',
        to: 'orchestrator',
        message: `Found ${unsupportedClaims.length} unsupported claim${unsupportedClaims.length > 1 ? 's' : ''}: ${claimDetails}`,
        timestamp: now(),
        type: 'finding',
      };
      iterationMessages.push(findingMsg);
      sendAgentMessage(res, findingMsg);
    } else {
      // All claims verified — emit confirmation
      const confirmMsg: AgentMessage = {
        from: 'fact-checker',
        to: 'orchestrator',
        message: `All ${supportedCount} claims verified against the product catalog. Score: ${(lastFactCheckerOutput.score * 100).toFixed(0)}%. Draft is now fully grounded.`,
        timestamp: now(),
        type: 'confirmation',
      };
      iterationMessages.push(confirmMsg);
      sendAgentMessage(res, confirmMsg);
    }

    // ── Evaluate result ────────────────────────────────────────────────
    const decision = evaluateResult(
      lastFactCheckerOutput,
      acceptanceThreshold,
      currentIteration,
      maxIterations,
      'auto-revise'
    );

    sendEvent(res, {
      type: 'step-complete',
      step: 'orchestrator',
      timestamp: now(),
      data: decision,
    });

    let revisionOutput: RevisionOutput | undefined;

    if (decision.action === 'approve') {
      approved = true;
    } else if (decision.action === 'revise') {
      // ── Orchestrator instructs Revision Agent ────────────────────────
      const instructionMsg: AgentMessage = {
        from: 'orchestrator',
        to: 'revision',
        message: lastFactCheckerOutput.revisionInstructions
          ?? 'Revise the product page. Replace unsupported claims with catalog-backed facts.',
        timestamp: now(),
        type: 'instruction',
      };
      iterationMessages.push(instructionMsg);
      sendAgentMessage(res, instructionMsg);

      // ── Revision Agent ───────────────────────────────────────────────
      sendEvent(res, {
        type: 'step-start',
        step: 'revision',
        timestamp: now(),
        data: { message: `Revision agent rewriting draft to fix ${unsupportedClaims.length} unsupported claim(s)` },
      });

      // Retrieve knowledge for revision context
      const knowledgeDocs = await retrieveDocuments(prompt);
      const knowledgeContext = formatAsContext(knowledgeDocs);

      revisionOutput = await runRevisionAgent(
        lastGeneratorOutput.draftText,
        unsupportedClaims,
        lastFactCheckerOutput.revisionInstructions ?? 'Replace unsupported claims with catalog-backed facts.',
        currentIteration,
        knowledgeContext
      );

      sendEvent(res, {
        type: 'step-complete',
        step: 'revision',
        timestamp: now(),
        data: revisionOutput,
      });

      // ── Revision Agent hands off to Generator ────────────────────────
      const changesPreview = revisionOutput.changesApplied.length > 0
        ? ` Changes: ${revisionOutput.changesApplied.join('; ')}.`
        : '';
      const revisionHandoffMsg: AgentMessage = {
        from: 'revision',
        to: 'generator',
        message: `Revised draft ready.${changesPreview} Sending for claim re-extraction and re-verification.`,
        timestamp: now(),
        type: 'handoff',
      };
      iterationMessages.push(revisionHandoffMsg);
      sendAgentMessage(res, revisionHandoffMsg);

      // Update current draft text for next iteration
      currentDraftText = revisionOutput.revisedText;

      currentIteration++;
      if (currentIteration <= maxIterations) {
        sendEvent(res, {
          type: 'step-start',
          step: 'orchestrator',
          timestamp: now(),
          data: makeDecision('revise', `Verifying revised content (iteration ${currentIteration})`, currentIteration, maxIterations),
        });
      }
    } else {
      // Rejected — stop
      break;
    }

    iterations.push({
      iteration: currentIteration > 1 && decision.action !== 'approve' ? currentIteration - 1 : currentIteration,
      generatorOutput: lastGeneratorOutput,
      factCheckerOutput: lastFactCheckerOutput,
      revisionOutput,
      orchestratorDecision: decision,
      agentMessages: iterationMessages,
    });
  }

  // ── Final summary ────────────────────────────────────────────────────
  const totalClaims = iterations.flatMap((i) => i.factCheckerOutput?.claims ?? []);
  const unsupportedCount = totalClaims.filter((c) => c.status === 'unsupported').length;

  const finalStatus: RunSummary['finalStatus'] = approved
    ? 'approved'
    : unsupportedCount > 0 ? 'rejected' : 'approved';

  const summary: RunSummary = {
    draftCount: iterations.length,
    claimsChecked: totalClaims.length,
    unsupportedClaims: unsupportedCount,
    finalStatus,
    finalText: currentDraftText ?? lastGeneratorOutput?.draftText ?? '',
    iterations,
  };

  sendEvent(res, {
    type: 'step-start',
    step: 'final-answer',
    timestamp: now(),
    data: { message: 'Compiling final grounded answer' },
  });

  sendEvent(res, {
    type: 'run-complete',
    step: 'final-answer',
    timestamp: now(),
    data: summary,
  });

  res.write('data: [DONE]\n\n');
  res.end();
}

// ─── Shared Helpers ──────────────────────────────────────────────────────────

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
