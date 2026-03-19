import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <section className="grid w-full max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
        <Link
          href="/program-reduction"
          className="flex min-h-[280px] items-center justify-center rounded-2xl bg-blue-700 p-8 text-center text-3xl font-bold text-white transition hover:bg-blue-800"
        >
          Program Reduction
        </Link>

        <Link
          href="/compiler-optimisation"
          className="flex min-h-[280px] items-center justify-center rounded-2xl bg-emerald-700 p-8 text-center text-3xl font-bold text-white transition hover:bg-emerald-800"
        >
          Compiler Optimisation
        </Link>
      </section>
    </main>
  );
}
