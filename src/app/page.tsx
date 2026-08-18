import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-[calc(100vh-65px)] items-center justify-center p-6">
      <section className="grid w-full max-w-6xl grid-cols-2 gap-6">
        <Link
          href="/program-reduction"
          className="flex min-h-[320px] items-center justify-center rounded-lg bg-[var(--app-accent)] p-8 text-center text-3xl font-bold text-[var(--app-accent-text)] transition hover:bg-[var(--app-accent-hover)]"
        >
          Program Reduction
        </Link>

        <Link
          href="/compiler-optimisation"
          className="flex min-h-[320px] items-center justify-center rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-8 text-center text-3xl font-bold text-[var(--app-text-primary)] shadow-[var(--app-shadow)] shadow-sm transition hover:border-[var(--app-accent)]"
        >
          Compiler Optimisation
        </Link>
      </section>
    </main>
  );
}
