import type { Metadata } from "next";

import emptyFunctionsFixture from "~/test-data/compiler-optimisation/empty-functions.json";
import emptyPassesFixture from "~/test-data/compiler-optimisation/empty-passes.json";
import invalidFixture from "~/test-data/compiler-optimisation/invalid.json";
import longContentFixture from "~/test-data/compiler-optimisation/long-content.json";
import manyPassesFixture from "~/test-data/compiler-optimisation/many-passes";
import multiFunctionFixture from "~/test-data/compiler-optimisation/multi-function.json";
import partialDataFixture from "~/test-data/compiler-optimisation/partial-data.json";
import { api } from "~/trpc/server";

import { CompilerOptimisationExplorer } from "./_components/compiler-optimisation-explorer";
import { parseOptimisationResult } from "./_lib/optimisation-adapter";
import type { OptimisationViewModel } from "./_lib/optimisation-types";

export const metadata: Metadata = {
  title: "Compiler optimisation workspace",
  description: "Inspect compiler optimisation passes and their LLVM IR output.",
};

const fixtures = {
  multi: multiFunctionFixture,
  partial: partialDataFixture,
  "empty-passes": emptyPassesFixture,
  "empty-functions": emptyFunctionsFixture,
  invalid: invalidFixture,
  "long-content": longContentFixture,
  "many-passes": manyPassesFixture,
} as const;

type FixtureKey = keyof typeof fixtures | "real";

function isFixtureKey(value: string | undefined): value is FixtureKey {
  return value === "real" || (value !== undefined && value in fixtures);
}

/** Remove null-prototype implementation details at the RSC serialization edge. */
function toClientViewModel(
  model: OptimisationViewModel,
): OptimisationViewModel {
  return JSON.parse(JSON.stringify(model)) as OptimisationViewModel;
}

type CompilerOptimisationPageProps = Readonly<{
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}>;

export default async function CompilerOptimisationPage({
  searchParams,
}: CompilerOptimisationPageProps) {
  const requestedFixture = (await searchParams).fixture;
  const fixtureCandidate =
    typeof requestedFixture === "string" ? requestedFixture : undefined;
  const fixtureKey: FixtureKey = isFixtureKey(fixtureCandidate)
    ? fixtureCandidate
    : "multi";
  const payload =
    fixtureKey === "real"
      ? await api.compiler.getRealOptimisationPayload()
      : fixtures[fixtureKey];
  const result = parseOptimisationResult(payload);

  if (!result.ok) {
    return (
      <CompilerOptimisationExplorer
        fixtureKey={fixtureKey}
        initialError={`${result.error.message} ${result.error.issues
          .slice(0, 3)
          .map(
            (issue) => `${issue.path.join(".") || "payload"}: ${issue.message}`,
          )
          .join("; ")}`}
      />
    );
  }

  return (
    <CompilerOptimisationExplorer
      fixtureKey={fixtureKey}
      initialModel={toClientViewModel(result.data)}
    />
  );
}
