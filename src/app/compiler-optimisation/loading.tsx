import { StatusPanel } from "./_components/status-panel";

export default function CompilerOptimisationLoading() {
  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-4xl">
        <StatusPanel
          eyebrow="Loading"
          title="Loading optimisation result"
          description="Validating the compiler payload and preparing functions, Passes, metrics, and IR differences."
        />
      </div>
    </main>
  );
}
