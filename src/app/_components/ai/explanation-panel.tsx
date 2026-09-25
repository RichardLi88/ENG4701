"use client";

import { useId } from "react";
import type { ExplainInput, ExplanationRecord } from "~/server/ai/schema";
import { aiContent as c } from "./content";

type Props = {
  input: ExplainInput;
  pending: boolean;
  records: ExplanationRecord[];
  error: string | null;
  disabled: boolean;
  onExplain: () => void;
};
export function ExplanationPanel({
  input,
  pending,
  records,
  error,
  disabled,
  onExplain,
}: Props) {
  const id = useId();
  const record = records.at(-1);
  function download() {
    if (!record) return;
    const blob = new Blob(
      [
        JSON.stringify(
          { latest: record, previousAttempts: records.slice(0, -1) },
          null,
          2,
        ),
      ],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `explanation-${record.id}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <section
      aria-labelledby={`${id}-title`}
      aria-busy={pending}
      className="mt-6 space-y-4 rounded-xl border border-[var(--workspace-border)] bg-[var(--workspace-surface)] p-4 text-sm text-[var(--workspace-text)] sm:p-6"
    >
      <div>
        <h3 id={`${id}-title`} className="text-lg font-semibold">
          {c.title}
        </h3>
        <p className="mt-1 text-xs text-[var(--workspace-text-muted)]">
          {c.model}
        </p>
      </div>
      <p>{c.notice}</p>
      {!record && <p>{c.idle}</p>}
      <p className="text-xs text-[var(--workspace-text-muted)]">{c.privacy}</p>
      <div className="flex flex-wrap gap-3">
        {record?.status !== "completed" && (
          <button
            type="button"
            disabled={pending || disabled}
            onClick={onExplain}
            className="rounded-lg border border-[var(--workspace-border)] px-4 py-2 font-semibold hover:bg-[var(--workspace-surface-muted)] disabled:opacity-50"
          >
            {pending ? c.loading : record || error ? c.retry : c.explain}
          </button>
        )}
        {record && (
          <button
            type="button"
            onClick={download}
            className="rounded-lg border border-[var(--workspace-border)] px-4 py-2"
          >
            {c.download}
          </button>
        )}
      </div>
      {pending && <p role="status">{c.loading}</p>}
      {(error ?? record?.message) && (
        <p role="alert" className="font-medium">
          {error ?? record?.message}
        </p>
      )}
      {record?.output && (
        <>
          {Object.entries(c.sections).map(([key, heading]) => (
            <div key={key}>
              <h4 className="font-semibold">{heading}</h4>
              <ul className="mt-2 space-y-2">
                {record.output![key as keyof typeof c.sections].map(
                  (statement, index) => (
                    <li key={index} className="leading-6">
                      {statement.text}{" "}
                      <span className="inline-flex gap-2">
                        {statement.evidenceIds.map((ref) => (
                          <a
                            key={ref}
                            href={`#${id}-${ref}`}
                            className="text-[var(--workspace-accent)] underline"
                          >
                            [{ref}]
                          </a>
                        ))}
                      </span>
                    </li>
                  ),
                )}
              </ul>
            </div>
          ))}
          {record.checks.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <caption className="mb-2 text-left font-semibold">
                  {c.metrics}
                </caption>
                <thead>
                  <tr>
                    {[c.metric, c.claimed, c.actual, c.check].map((label) => (
                      <th key={label} scope="col" className="p-2">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {record.checks.map((check, index) => (
                    <tr key={index}>
                      <th scope="row" className="p-2">
                        {check.metric}
                      </th>
                      <td className="p-2">{check.claimedDelta}</td>
                      <td className="p-2">
                        {check.actualDelta ?? c.unavailable}
                      </td>
                      <td className="p-2">{c.verdict[check.status]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
      {record && (
        <>
          <div>
            <h4 className="font-semibold">{c.references}</h4>
            {record.knowledge.map((k) => (
              <article
                id={`${id}-${k.id}`}
                key={k.id}
                tabIndex={-1}
                className="mt-3 space-y-1 rounded border border-[var(--workspace-border)] p-3"
              >
                <h5 className="font-medium">
                  [{k.id}] {k.title}
                </h5>
                <p>{k.text}</p>
                <p className="text-xs">
                  {c.sourceVersion}: {k.sourceVersion} · {c.scope}: {k.scope}
                </p>
                {k.source.startsWith("https://") ? (
                  <a
                    href={k.source}
                    target="_blank"
                    rel="noreferrer"
                    className="break-all underline"
                  >
                    {k.source}
                  </a>
                ) : (
                  <p className="break-all">{k.source}</p>
                )}
              </article>
            ))}
          </div>
          <div>
            <h4 className="font-semibold">{c.evidence}</h4>
            {record.evidence.map((e) => (
              <details key={e.id} className="mt-2">
                <summary id={`${id}-${e.id}`} className="cursor-pointer">
                  [{e.id}] {e.label}
                </summary>
                <pre className="mt-2 max-h-72 overflow-auto rounded border border-[var(--workspace-border)] p-3 text-xs break-all whitespace-pre-wrap">
                  {e.text}
                </pre>
              </details>
            ))}
          </div>
          <details>
            <summary className="cursor-pointer font-semibold">
              {c.record}
            </summary>
            <dl className="mt-2 space-y-2 break-all">
              {[
                [c.fields.status, c.statuses[record.status]],
                [c.fields.model, record.returnedModel ?? record.model],
                [c.fields.strategy, record.strategy],
                [c.fields.version, record.recordVersion],
                [c.fields.tool, input.toolVersion ?? c.unavailable],
                [c.fields.prompt, record.promptHash],
                [c.fields.knowledge, record.knowledgeHash],
                [c.fields.input, record.evidenceHash],
                [c.fields.elapsed, String(record.usage.latencyMs)],
              ].map(([label, value]) => (
                <div key={label}>
                  <dt className="font-medium">{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
          </details>
          {records.length > 1 && <p className="text-xs">{c.history}</p>}
        </>
      )}
    </section>
  );
}
