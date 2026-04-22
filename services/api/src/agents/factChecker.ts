// ─── Fact-Checker Agent ──────────────────────────────────────────────────────
// Validates generated content against the knowledge source.
// When Azure AI Search is configured, queries the index for evidence.
// Falls back to mock fact-checking for local development.

import type { FactCheckerOutput, FactualClaim, ClaimStatus } from '../types.js';
import { isAzureConfigured } from '../azureClients.js';

/**
 * Fact-check a list of claims against the knowledge source.
 *
 * @param claims - Claims extracted by the generator
 * @param draftText - The full draft text for context
 */
export async function runFactChecker(
  claims: FactualClaim[],
  draftText: string
): Promise<FactCheckerOutput> {
  if (isAzureConfigured()) {
    return runAzureFactChecker(claims, draftText);
  }
  return runMockFactChecker(claims, draftText);
}

// ─── Azure AI Search implementation (seam for real integration) ──────────────

async function runAzureFactChecker(
  claims: FactualClaim[],
  draftText: string
): Promise<FactCheckerOutput> {
  // TODO: Integrate with Azure AI Search + Azure OpenAI
  // - Use getSearchConfig() for search endpoint/index/credential
  // - For each claim, search the index for supporting evidence
  // - Use Azure OpenAI to evaluate if the evidence supports the claim
  // - Return structured verdict with claim-by-claim status
  console.log('Azure fact-checker not yet implemented — falling back to mock');
  return runMockFactChecker(claims, draftText);
}

// ─── Mock implementation for local dev ───────────────────────────────────────

async function runMockFactChecker(
  claims: FactualClaim[],
  _draftText: string
): Promise<FactCheckerOutput> {
  // Simulate processing delay
  await delay(1000 + Math.random() * 800);

  // Mock knowledge base for verification
  const knownFacts: Record<string, { status: ClaimStatus; evidence: string }> = {
    'wind power': {
      status: 'supported',
      evidence: 'Danish Energy Agency reports confirm >50% wind electricity share.',
    },
    'samsø': {
      status: 'supported',
      evidence: 'Samsø achieved 100% renewable energy status, widely documented.',
    },
    'nuclear fusion': {
      status: 'unsupported',
      evidence: 'No evidence of Denmark building a nuclear fusion reactor.',
    },
    'greenhouse gas': {
      status: 'supported',
      evidence: 'Danish Climate Act of 2020 codifies 70% reduction target by 2030.',
    },
    '70%': {
      status: 'supported',
      evidence: 'Danish Climate Act of 2020 codifies 70% reduction target by 2030.',
    },
  };

  const checkedClaims: FactualClaim[] = claims.map((claim) => {
    const lowerText = claim.text.toLowerCase();
    let matchedStatus: ClaimStatus = 'uncertain';
    let matchedEvidence = 'No matching evidence found in knowledge base.';

    for (const [keyword, info] of Object.entries(knownFacts)) {
      if (lowerText.includes(keyword)) {
        matchedStatus = info.status;
        matchedEvidence = info.evidence;
        break;
      }
    }

    return {
      ...claim,
      status: matchedStatus,
      evidence: matchedEvidence,
    };
  });

  const supportedCount = checkedClaims.filter((c) => c.status === 'supported').length;
  const unsupportedCount = checkedClaims.filter((c) => c.status === 'unsupported').length;
  const score = checkedClaims.length > 0 ? supportedCount / checkedClaims.length : 1;

  let verdict: FactCheckerOutput['verdict'];
  let revisionInstructions: string | undefined;

  if (unsupportedCount === 0) {
    verdict = 'approved';
  } else if (unsupportedCount > checkedClaims.length / 2) {
    verdict = 'rejected';
    revisionInstructions = `Multiple claims are unsupported. Remove or correct: ${checkedClaims
      .filter((c) => c.status === 'unsupported')
      .map((c) => `"${c.text}"`)
      .join(', ')}`;
  } else {
    verdict = 'needs-revision';
    revisionInstructions = `The following claims need correction: ${checkedClaims
      .filter((c) => c.status === 'unsupported')
      .map((c) => `"${c.text}"`)
      .join(', ')}. Replace with verified facts from the knowledge base.`;
  }

  const evidenceReferences = checkedClaims
    .filter((c) => c.evidence && c.status === 'supported')
    .map((c) => c.evidence!);

  return {
    verdict,
    score,
    claims: checkedClaims,
    revisionInstructions,
    evidenceReferences: [...new Set(evidenceReferences)],
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
