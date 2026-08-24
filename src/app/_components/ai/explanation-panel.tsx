"use client";

import type { ExplanationResult } from "~/server/ai/client";
import type { AiErrorCode } from "~/server/ai/errors";
import type { MetricClaimCheck } from "~/server/ai/schema/explanation";

import { aiExplanationContent } from "./content";

export type ExplanationPanelState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "error"; code: AiErrorCode }>
  | Readonly<{ status: "ready"; result: ExplanationResult }>;

export type ExplanationPanelProps = Readonly<{
  state: ExplanationPanelState;
  onExplain: () => void;
}>;

const CLAIM_LABEL: Record<MetricClaimCheck["status"], string> = {
  match: aiExplanationContent.labels.verifiedClaim,
  mismatch: aiExplanationContent.labels.mismatchedClaim,
  unsupported: aiExplanationContent.labels.unsupportedClaim,
};

export function ExplanationPanel({ state, onExplain }: ExplanationPanelProps) {
  const pending = state.status === "loading";

  return (
    <section aria-label={aiExplanationContent.headings.panel}>
      <h3>{aiExplanationContent.headings.panel}</h3>

      {state.status !== "ready" && (
        <button type="button" onClick={onExplain} disabled={pending}>
          {pending
            ? aiExplanationContent.labels.pending
            : aiExplanationContent.labels.explain}
        </button>
      )}

      {state.status === "idle" && <p>{aiExplanationContent.labels.idle}</p>}

      {state.status === "error" && (
        <p role="alert">{aiExplanationContent.errors[state.code]}</p>
      )}

      {state.status === "ready" && <ExplanationBody result={state.result} />}
    </section>
  );
}

function ExplanationBody({ result }: Readonly<{ result: ExplanationResult }>) {
  return (
    <div>
      <p>{result.explanation.summary}</p>

      <h4>{aiExplanationContent.headings.mechanism}</h4>
      <p>{result.explanation.mechanism}</p>

      <p>
        {aiExplanationContent.labels.confidence}:{" "}
        {result.explanation.confidence}
      </p>

      <h4>{aiExplanationContent.headings.claims}</h4>
      {result.claimChecks.length === 0 ? (
        <p>{aiExplanationContent.labels.noClaims}</p>
      ) : (
        <ClaimTable checks={result.claimChecks} />
      )}
    </div>
  );
}

function ClaimTable({
  checks,
}: Readonly<{ checks: ReadonlyArray<MetricClaimCheck> }>) {
  return (
    <table aria-label={aiExplanationContent.labels.claims}>
      <thead>
        <tr>
          <th scope="col">{aiExplanationContent.columns.metric}</th>
          <th scope="col">{aiExplanationContent.columns.claimed}</th>
          <th scope="col">{aiExplanationContent.columns.actual}</th>
          <th scope="col">{aiExplanationContent.columns.verdict}</th>
        </tr>
      </thead>
      <tbody>
        {checks.map((check) => (
          <tr key={check.metric} aria-label={CLAIM_LABEL[check.status]}>
            <th scope="row">{check.metric}</th>
            <td>{check.claimedDelta}</td>
            <td>{check.actualDelta ?? "—"}</td>
            <td>{aiExplanationContent.verdicts[check.status]}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
