"use client";

import { lazy, Suspense, useEffect, useRef, useState } from "react";

import { cfgContent } from "../content";
import type {
  DataAvailability,
  PassControlFlowGraphViewModel,
} from "../_lib/optimisation-types";

const LazyCfgView = lazy(async () => {
  const { CfgView } = await import("./cfg-view");
  return { default: CfgView };
});

type DeferredCfgViewProps = Readonly<{
  cfg: DataAvailability<PassControlFlowGraphViewModel>;
}>;

type CfgPlaceholderProps = Readonly<{
  loading: boolean;
}>;

function CfgPlaceholder({ loading }: CfgPlaceholderProps) {
  return (
    <section
      className="mt-6 min-h-80 rounded-xl border border-dashed border-slate-800 bg-slate-950/30 p-4"
      aria-labelledby="deferred-cfg-heading"
      aria-busy={loading}
    >
      <h3
        id="deferred-cfg-heading"
        className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase"
      >
        {cfgContent.heading}
      </h3>
      <p className="mt-1 text-xs text-slate-500">{cfgContent.description}</p>
      <div
        className="mt-5 h-56 animate-pulse rounded-lg border border-slate-800 bg-slate-900/50"
        aria-hidden="true"
      />
      <p className="mt-3 text-sm text-slate-400" role="status">
        {loading ? cfgContent.lazy.loading : cfgContent.lazy.waiting}
      </p>
    </section>
  );
}

export function DeferredCfgView({ cfg }: DeferredCfgViewProps) {
  const [shouldLoad, setShouldLoad] = useState(false);
  const boundaryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shouldLoad) {
      return;
    }

    const boundary = boundaryRef.current;
    if (!boundary || typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "600px 0px" },
    );

    observer.observe(boundary);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={boundaryRef}>
      {shouldLoad ? (
        <Suspense fallback={<CfgPlaceholder loading />}>
          <LazyCfgView cfg={cfg} />
        </Suspense>
      ) : (
        <CfgPlaceholder loading={false} />
      )}
    </div>
  );
}
