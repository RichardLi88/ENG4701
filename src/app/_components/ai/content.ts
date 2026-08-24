import type { AiErrorCode } from "~/server/ai/errors";

export const aiExplanationContent = {
  headings: {
    panel: "AI explanation",
    mechanism: "How it works",
    claims: "Metric claims",
  },
  labels: {
    explain: "Explain this transformation",
    pending: "Generating explanation",
    retry: "Try again",
    claims: "Metric claims checked against the trace",
    verifiedClaim: "Claim verified against the trace",
    mismatchedClaim: "Claim contradicts the trace",
    unsupportedClaim: "Claim not supported by the trace",
    confidence: "Model confidence",
    idle: "Generate a grounded explanation of the selected transformation.",
    noClaims: "The model made no numeric claims.",
  },
  columns: {
    metric: "Metric",
    claimed: "Model says",
    actual: "Trace says",
    verdict: "Verdict",
  },
  verdicts: {
    match: "Verified",
    mismatch: "Contradicted",
    unsupported: "Unsupported",
  },
  errors: {
    "missing-api-key":
      "No usable API key is configured for the AI provider. Check the server environment.",
    "rate-limited":
      "The AI provider's rate limit was reached. Wait a moment and try again.",
    timeout: "The model did not respond in time. Try again.",
    "content-blocked":
      "The provider blocked this input, so no explanation was produced.",
    "invalid-output":
      "The model returned a response that could not be read as an explanation.",
    "provider-unavailable":
      "The AI provider could not be reached. Check the connection and try again.",
    "evidence-too-large":
      "This transformation is too large to explain. Select a smaller pass or candidate.",
  } satisfies Record<AiErrorCode, string>,
} as const;
