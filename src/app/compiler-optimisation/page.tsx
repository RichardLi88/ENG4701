import type { Metadata } from "next";

import emptyFunctionsFixture from "~/test-data/compiler-optimisation/empty-functions.json";
import emptyPassesFixture from "~/test-data/compiler-optimisation/empty-passes.json";
import invalidFixture from "~/test-data/compiler-optimisation/invalid.json";
import longContentFixture from "~/test-data/compiler-optimisation/long-content.json";
import multiFunctionFixture from "~/test-data/compiler-optimisation/multi-function.json";
import partialDataFixture from "~/test-data/compiler-optimisation/partial-data.json";

import { FixtureSelector } from "./_components/fixture-selector";
import { OptimisationWorkspace } from "./_components/optimisation-workspace";
import { StatusPanel } from "./_components/status-panel";
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
} as const;

type FixtureKey = keyof typeof fixtures;

function isFixtureKey(value: string | undefined): value is FixtureKey {
  return value !== undefined && value in fixtures;
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
  const result = parseOptimisationResult(fixtures[fixtureKey]);

  if (!result.ok) {
    return (
      <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <FixtureSelector selectedFixture={fixtureKey} />
          <div className="mt-8">
            <StatusPanel
              eyebrow="Invalid data"
              title="The optimisation result could not be displayed"
              description={`${result.error.message} ${result.error.issues
                .slice(0, 3)
                .map(
                  (issue) =>
                    `${issue.path.join(".") || "payload"}: ${issue.message}`,
                )
                .join("; ")}`}
              tone="error"
            />
          </div>
        </div>
      </main>
    );
  }

  return (
    <OptimisationWorkspace
      key={fixtureKey}
      model={toClientViewModel(result.data)}
    >
      <FixtureSelector selectedFixture={fixtureKey} />
    </OptimisationWorkspace>
  );
}
