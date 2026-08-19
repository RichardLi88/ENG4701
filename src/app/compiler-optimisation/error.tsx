"use client";

import Link from "next/link";

import { routeErrorContent } from "./content";

type CompilerOptimisationErrorProps = Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>;

export default function CompilerOptimisationError({
  error,
  reset,
}: CompilerOptimisationErrorProps) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-10 text-slate-100 sm:px-6 lg:px-8">
      <section
        className="w-full max-w-2xl rounded-2xl border border-rose-400/30 bg-rose-400/10 p-6 shadow-2xl shadow-black/20 sm:p-8"
        role="alert"
        aria-labelledby="compiler-optimisation-error-heading"
      >
        <div className="flex items-start gap-4">
          <span
            className="flex size-10 shrink-0 items-center justify-center rounded-full border border-rose-300/70 font-mono text-sm font-bold text-rose-100"
            aria-hidden="true"
          >
            !
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-[0.18em] text-rose-200/80 uppercase">
              {routeErrorContent.eyebrow}
            </p>
            <h1
              id="compiler-optimisation-error-heading"
              className="mt-2 text-2xl font-semibold text-balance text-rose-50"
            >
              {routeErrorContent.title}
            </h1>
            <p className="mt-3 text-sm leading-6 text-rose-100/80">
              {routeErrorContent.description}
            </p>
            {error.digest ? (
              <p className="mt-4 text-xs text-rose-200/70">
                {routeErrorContent.referenceLabel}:{" "}
                <code className="break-all text-rose-100">{error.digest}</code>
              </p>
            ) : null}
          </div>
        </div>

        <div className="mt-7 flex flex-wrap gap-3 pl-0 sm:pl-14">
          <button
            type="button"
            onClick={reset}
            className="rounded-lg bg-rose-100 px-4 py-2 text-sm font-semibold text-rose-950 transition hover:bg-white focus-visible:ring-2 focus-visible:ring-rose-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none"
          >
            {routeErrorContent.actions.retry}
          </button>
          <Link
            href="/"
            className="rounded-lg border border-rose-300/40 px-4 py-2 text-sm font-semibold text-rose-100 transition hover:border-rose-200 hover:bg-rose-100/10 focus-visible:ring-2 focus-visible:ring-rose-200 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 focus-visible:outline-none"
          >
            {routeErrorContent.actions.home}
          </Link>
        </div>
      </section>
    </main>
  );
}
