import { z } from "zod";

import type { EvidencePack } from "./evidence.ts";

/**
 * Metric claims are extracted as typed data rather than left in prose so that
 * factual accuracy can be checked against the pack mechanically.
 */
export const explanationOutputSchema = z.object({
  summary: z.string().min(1),
  mechanism: z.string().min(1),
  metricClaims: z.array(
    z.object({ metric: z.string().min(1), claimedDelta: z.number() }),
  ),
  confidence: z.enum(["low", "medium", "high"]),
});

export type ExplanationOutput = z.infer<typeof explanationOutputSchema>;

export const metricClaimCheckSchema = z.object({
  metric: z.string(),
  claimedDelta: z.number(),
  actualDelta: z.number().nullable(),
  status: z.enum(["match", "mismatch", "unsupported"]),
});

export type MetricClaimCheck = z.infer<typeof metricClaimCheckSchema>;

export function verifyMetricClaims(
  pack: EvidencePack,
  output: Pick<ExplanationOutput, "metricClaims">,
): MetricClaimCheck[] {
  return output.metricClaims.map((claim) => {
    const metric = pack.metrics.find((entry) => entry.key === claim.metric);

    if (metric === undefined) {
      return {
        metric: claim.metric,
        claimedDelta: claim.claimedDelta,
        actualDelta: null,
        status: "unsupported" as const,
      };
    }

    return {
      metric: claim.metric,
      claimedDelta: claim.claimedDelta,
      actualDelta: metric.delta,
      status:
        metric.delta === claim.claimedDelta
          ? ("match" as const)
          : ("mismatch" as const),
    };
  });
}
