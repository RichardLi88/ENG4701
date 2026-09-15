import { compilerWorkspaceContent } from "../content.ts";
import type {
  DataAvailability,
  OptimisationViewModel,
} from "./optimisation-types";

const { summary: summaryLabels } = compilerWorkspaceContent.overallIr;

/**
 * The IR entering the first Pass and leaving the last one, which together
 * bracket the whole pipeline. No Pass is attributed, by design.
 */
export type OverallIrComparison = Readonly<{
  before: string;
  after: string;
  beforeLineCount: number;
  afterLineCount: number;
  summary: string;
}>;

function countIrLines(ir: string): number {
  if (ir.length === 0) return 0;

  const withoutTrailingNewline = ir.endsWith("\n") ? ir.slice(0, -1) : ir;
  return withoutTrailingNewline.split("\n").length;
}

function formatCount(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatOverallSummary(
  model: OptimisationViewModel,
  beforeLineCount: number,
  afterLineCount: number,
): string {
  return [
    formatCount(
      model.summary.totalPassCount,
      summaryLabels.passRan,
      summaryLabels.passesRan,
    ),
    `${model.summary.changedPassCount} ${summaryLabels.changedProgram}`,
    [
      formatCount(beforeLineCount, summaryLabels.line, summaryLabels.lines),
      formatCount(afterLineCount, summaryLabels.line, summaryLabels.lines),
    ].join(summaryLabels.linesArrow),
  ].join(summaryLabels.separator);
}

/** Bracket the run with its first and last IR snapshot, or report why not. */
export function deriveOverallIrComparison(
  model: OptimisationViewModel,
): DataAvailability<OverallIrComparison> {
  const firstPass = model.passes[0];
  const lastPass = model.passes[model.passes.length - 1];

  if (firstPass === undefined || lastPass === undefined) {
    return { status: "unavailable", reason: "not-provided" };
  }

  const before = firstPass.ir.before;
  const after = lastPass.ir.after;
  const beforeLineCount = countIrLines(before);
  const afterLineCount = countIrLines(after);

  return {
    status: "available",
    data: {
      before,
      after,
      beforeLineCount,
      afterLineCount,
      summary: formatOverallSummary(model, beforeLineCount, afterLineCount),
    },
  };
}
