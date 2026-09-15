import { passDescriptionContent } from "../content.ts";
import type {
  DataAvailability,
  OptimisationPassViewModel,
} from "./optimisation-types";

const CURATED_DESCRIPTIONS: Readonly<Record<string, string | undefined>> =
  passDescriptionContent.descriptions;

export type PassDescriptionSource = "curated" | "generated";

export type PassDescriptionViewModel = Readonly<{
  text: string;
  /**
   * "curated" is a hand-written description keyed on the LLVM Pass name;
   * "generated" is the backend's regex-derived transformation summary.
   */
  source: PassDescriptionSource;
  category: DataAvailability<string>;
}>;

function lookUpCuratedDescription(
  pass: OptimisationPassViewModel,
): string | undefined {
  return pass.fullName.status === "available"
    ? CURATED_DESCRIPTIONS[pass.fullName.data]
    : undefined;
}

/**
 * Describe what a Pass does in general. Deliberately never describes what it
 * did to the program on screen, so the reader still has to combine this with
 * the metrics, Diff and CFG to work out what happened here.
 */
export function describePassBehaviour(
  pass: OptimisationPassViewModel,
): DataAvailability<PassDescriptionViewModel> {
  const category: DataAvailability<string> =
    pass.transformation.status === "available"
      ? { status: "available", data: pass.transformation.data.category }
      : { status: "unavailable", reason: "not-provided" };
  const curated = lookUpCuratedDescription(pass);

  if (curated !== undefined) {
    return {
      status: "available",
      data: { text: curated, source: "curated", category },
    };
  }

  if (pass.transformation.status === "available") {
    return {
      status: "available",
      data: {
        text: pass.transformation.data.summary,
        source: "generated",
        category,
      },
    };
  }

  return { status: "unavailable", reason: "not-provided" };
}
