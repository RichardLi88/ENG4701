import Link from "next/link";

const fixtureOptions = [
  { key: "multi", label: "Multi-function" },
  { key: "partial", label: "Partial data" },
  { key: "empty-passes", label: "No passes" },
  { key: "empty-functions", label: "No functions" },
  { key: "invalid", label: "Invalid data" },
  { key: "long-content", label: "Long content" },
] as const;

type FixtureSelectorProps = Readonly<{
  selectedFixture: (typeof fixtureOptions)[number]["key"];
}>;

export function FixtureSelector({ selectedFixture }: FixtureSelectorProps) {
  return (
    <nav aria-label="Optimisation test data" className="min-w-0">
      <p className="mb-2 text-xs font-semibold tracking-[0.18em] text-slate-500 uppercase">
        Fixture
      </p>
      <ul className="flex gap-2 overflow-x-auto pb-2">
        {fixtureOptions.map((fixture) => {
          const selected = fixture.key === selectedFixture;

          return (
            <li key={fixture.key} className="shrink-0">
              <Link
                href={
                  fixture.key === "multi"
                    ? "/compiler-optimisation"
                    : `/compiler-optimisation?fixture=${fixture.key}`
                }
                aria-current={selected ? "page" : undefined}
                className={`inline-flex rounded-full border px-3 py-1.5 text-xs font-medium transition focus-visible:ring-2 focus-visible:ring-cyan-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none ${
                  selected
                    ? "border-cyan-400/60 bg-cyan-400/10 text-cyan-100"
                    : "border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-500 hover:text-slate-200"
                }`}
              >
                {fixture.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
