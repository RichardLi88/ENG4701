import { passChangeSummaryContent } from "../content.ts";
import type {
  DataAvailability,
  MetricKey,
  OptimisationPassViewModel,
} from "./optimisation-types";

const content = passChangeSummaryContent;

/**
 * Countable metrics only, in the order they read best in a sentence.
 * Cyclomatic complexity is excluded: it is a score, not a count of things
 * added or removed, so it cannot be phrased this way without misleading.
 */
const COUNTABLE_METRICS = [
  "basicBlocks",
  "instructions",
  "memoryOperations",
  "branches",
] as const satisfies ReadonlyArray<MetricKey>;

type CountableMetric = (typeof COUNTABLE_METRICS)[number];

type MetricMovement = Readonly<{ key: CountableMetric; delta: number }>;

function pluralise(
  count: number,
  noun: Readonly<{ one: string; other: string }>,
): string {
  return `${count} ${count === 1 ? noun.one : noun.other}`;
}

function joinPhrases(phrases: ReadonlyArray<string>): string {
  if (phrases.length <= 1) return phrases[0] ?? "";

  return [
    phrases.slice(0, -1).join(content.listSeparator),
    phrases[phrases.length - 1],
  ].join(content.listConjunction);
}

function describeMovements(movements: ReadonlyArray<MetricMovement>): string {
  const phrase = (movement: MetricMovement) =>
    pluralise(Math.abs(movement.delta), content.metricNouns[movement.key]);
  const removed = movements
    .filter((movement) => movement.delta < 0)
    .map(phrase);
  const added = movements.filter((movement) => movement.delta > 0).map(phrase);

  if (removed.length > 0 && added.length > 0) {
    return `${content.removed} ${joinPhrases(removed)}${content.listConjunction}${content.addedContinued} ${joinPhrases(added)}.`;
  }

  if (removed.length > 0) {
    return `${content.removed} ${joinPhrases(removed)}.`;
  }

  return `${content.added} ${joinPhrases(added)}.`;
}

function describeControlFlow(
  pass: OptimisationPassViewModel,
): string | undefined {
  if (pass.cfg.status !== "available") return undefined;

  const before = pass.cfg.data.before.nodes.length;
  const after = pass.cfg.data.after.nodes.length;

  if (before === after) return content.controlFlow.unchanged;

  const verb =
    after < before
      ? content.controlFlow.simplified
      : content.controlFlow.expanded;

  return `${verb} ${pluralise(before, content.controlFlow.blockNoun)} ${content.controlFlow.to} ${after}.`;
}

/**
 * One sentence describing what measurably changed, built only from measured
 * metric deltas and CFG block counts. Estimated numbers are refused rather
 * than reported, so this line cannot overstate what the payload knows.
 */
export function summarisePassChange(
  pass: OptimisationPassViewModel,
): DataAvailability<string, "not-provided" | "not-applicable"> {
  if (!pass.changed) {
    return { status: "unavailable", reason: "not-applicable" };
  }

  if (pass.metrics.status !== "available") {
    return { status: "unavailable", reason: "not-provided" };
  }

  const values = pass.metrics.data.values;
  const movements: Array<MetricMovement> = [];

  for (const key of COUNTABLE_METRICS) {
    const metric = values[key];

    if (metric.status !== "available" || metric.data.delta === 0) continue;

    // An estimated number must never be reported as a measured change.
    if (metric.data.estimated) {
      return { status: "unavailable", reason: "not-applicable" };
    }

    movements.push({ key, delta: metric.data.delta });
  }

  const controlFlow = describeControlFlow(pass);
  const sentences =
    movements.length === 0
      ? [content.noMetricMovement]
      : [describeMovements(movements)];

  if (controlFlow !== undefined) sentences.push(controlFlow);

  return { status: "available", data: sentences.join(" ") };
}
