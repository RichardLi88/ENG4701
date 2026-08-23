import Link from "next/link";

import { homeContent } from "./content";

const destinationClassName =
  "flex min-h-[320px] items-center justify-center rounded-2xl border border-[var(--workspace-border-muted)] bg-[var(--workspace-surface)] p-8 text-center text-3xl font-bold text-[var(--workspace-text)] shadow-[var(--workspace-shadow)] shadow-sm transition-colors hover:border-[var(--workspace-accent)] hover:bg-[var(--workspace-accent-soft)] focus-visible:ring-2 focus-visible:ring-[var(--workspace-focus)] focus-visible:outline-none";

export default function Home() {
  const { programReduction, compilerOptimisation } = homeContent.destinations;

  return (
    <main
      data-workspace-theme
      className="flex min-h-[calc(100vh-65px)] items-center justify-center bg-[var(--workspace-page-bg)] p-6 text-[var(--workspace-text)] transition-colors"
    >
      <section className="grid w-full max-w-6xl grid-cols-2 gap-6">
        <Link href={programReduction.href} className={destinationClassName}>
          {programReduction.label}
        </Link>

        <Link href={compilerOptimisation.href} className={destinationClassName}>
          {compilerOptimisation.label}
        </Link>
      </section>
    </main>
  );
}
