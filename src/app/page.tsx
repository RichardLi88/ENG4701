import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6">
      <section className="grid w-full max-w-6xl grid-cols-2 gap-6">
        <Link
          href="/program-reduction"
          className="flex min-h-[320px] items-center justify-center rounded-2xl bg-violet-600 p-8 text-center text-3xl font-bold text-white transition hover:bg-violet-700"
        >
          Program Reduction
        </Link>

        <Link
          href="/compiler-optimisation"
          className="flex min-h-[320px] items-center justify-center rounded-2xl bg-teal-500 p-8 text-center text-3xl font-bold text-black transition hover:bg-teal-400"
        >
          Compiler Optimisation
        </Link>
      </section>
    </main>
  );
}
