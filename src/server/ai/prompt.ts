import type { EvidencePack } from "./schema/evidence.ts";

/**
 * Latch on any wording change so a generated explanation stays attributable to
 * the exact prompt that produced it (probably could be improved here).
 */
export const PROMPT_VERSION = "metrics-augmented@1";

export type PromptBuildResult = Readonly<{
  version: string;
  system: string;
  user: string;
}>;

const SYSTEM_PROMPT = [
  "You explain compiler optimisation passes and program reduction steps to a",
  "software developer debugging a compiler.",
  "",
  "Rules:",
  "- Ground every statement in the evidence supplied. Do not speculate about",
  "  code, passes or metrics that are not present.",
  "- Only cite a metric that appears under 'Measured metrics'. If no metrics",
  "  are supplied, report no metric claims at all rather than estimating.",
  "- Report every numeric change you mention in metricClaims, using the exact",
  "  metric name from the evidence and the signed delta.",
  "- State the mechanism of the transformation, not just its outcome.",
  "- Set confidence to low when the evidence is thin or ambiguous.",
].join("\n");

const DOMAIN_LABEL: Record<EvidencePack["domain"], string> = {
  "compiler-optimisation": "LLVM optimisation pass",
  "program-reduction": "Perses reduction step",
};

export function buildPrompt(pack: EvidencePack): PromptBuildResult {
  const sections: string[] = [
    `Subject: ${DOMAIN_LABEL[pack.domain]} "${pack.subject.label}" (${pack.subject.scope})`,
  ];

  if (pack.transformation !== null) {
    sections.push(
      `Transformation: ${pack.transformation.category} — ${pack.transformation.summary}`,
    );
  }

  if (pack.metrics.length > 0) {
    sections.push(
      ["Measured metrics:", ...pack.metrics.map(renderMetric)].join("\n"),
    );
  }

  sections.push(`Program before:\n${pack.code.before}`);

  if (pack.code.after !== null) {
    sections.push(`Program after:\n${pack.code.after}`);
  } else if (pack.code.patch !== null) {
    sections.push(`Proposed patch (never applied):\n${pack.code.patch}`);
  }

  sections.push("Explain what this transformation did and why.");

  return {
    version: PROMPT_VERSION,
    system: SYSTEM_PROMPT,
    user: sections.join("\n\n"),
  };
}

function renderMetric(metric: EvidencePack["metrics"][number]): string {
  const suffix = metric.estimated ? " (estimated)" : "";
  return `- ${metric.key}: ${metric.before} -> ${metric.after} (delta ${metric.delta})${suffix}`;
}
