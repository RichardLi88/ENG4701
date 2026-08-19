"use client";

import { useRef, useState } from "react";

import { fileLoaderContent, units } from "../content";
import { parseReductionTrace } from "../_lib/trace-parser";
import type { TraceParseResult, TraceProgress } from "../_lib/trace-model";

type JsonlFileLoaderProps = Readonly<{
  onLoaded: (fileName: string, result: TraceParseResult) => void;
}>;

const INITIAL_PROGRESS: TraceProgress = {
  parsedBytes: 0,
  totalBytes: 0,
  eventCount: 0,
  diagnosticCount: 0,
};

export function JsonlFileLoader({ onLoaded }: JsonlFileLoaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const controllerRef = useRef<AbortController>(null);
  const [progress, setProgress] = useState(INITIAL_PROGRESS);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const [message, setMessage] = useState<string>();
  const [dragging, setDragging] = useState(false);

  async function loadFile(file: File) {
    if (!file.name.toLocaleLowerCase().endsWith(".jsonl")) {
      setState("error");
      setMessage(fileLoaderContent.invalidType);
      if (inputRef.current !== null) inputRef.current.value = "";
      return;
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    setProgress({ ...INITIAL_PROGRESS, totalBytes: file.size });
    setMessage(undefined);
    setState("loading");
    try {
      const result = await parseReductionTrace(file.stream(), {
        totalBytes: file.size,
        signal: controller.signal,
        onProgress: setProgress,
      });
      onLoaded(file.name, result);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setMessage(fileLoaderContent.cancelled);
      } else {
        setMessage(error instanceof Error ? error.message : String(error));
      }
      setState("error");
    } finally {
      controllerRef.current = null;
      if (inputRef.current !== null) inputRef.current.value = "";
    }
  }

  function selectFiles(files: FileList | null) {
    if (state === "loading") return;
    const file = files?.[0];
    if (file !== undefined) void loadFile(file);
  }

  const percent =
    progress.totalBytes === 0
      ? 0
      : Math.min(100, (progress.parsedBytes / progress.totalBytes) * 100);

  return (
    <section className="rounded-2xl border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-shadow)] shadow-sm">
      <input
        ref={inputRef}
        type="file"
        accept=".jsonl,application/x-ndjson"
        className="sr-only"
        onChange={(event) => selectFiles(event.target.files)}
      />
      <div
        className={`flex min-h-64 flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 text-center transition ${dragging ? "border-[var(--app-accent)] bg-[var(--app-panel)]" : "border-[var(--app-border)]"}`}
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => event.preventDefault()}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          selectFiles(event.dataTransfer.files);
        }}
      >
        {state === "loading" ? (
          <div className="w-full max-w-lg" role="status">
            <p className="font-semibold">{fileLoaderContent.parsing}</p>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--app-border-subtle)]">
              <div
                className="h-full bg-[var(--app-accent)] transition-[width]"
                style={{ width: `${percent}%` }}
              />
            </div>
            <p className="mt-3 text-sm text-[var(--app-text-muted)]">
              {progress.parsedBytes.toLocaleString()} /{" "}
              {progress.totalBytes.toLocaleString()} {units.bytes} ·{" "}
              {progress.eventCount.toLocaleString()} {units.events} ·{" "}
              {progress.diagnosticCount.toLocaleString()} {units.errors}
            </p>
            <button
              type="button"
              className="mt-5 rounded-md border border-[var(--app-border)] px-4 py-2 text-sm font-semibold hover:bg-[var(--app-panel)]"
              onClick={() => controllerRef.current?.abort()}
            >
              {fileLoaderContent.cancel}
            </button>
          </div>
        ) : (
          <>
            <p className="text-lg font-semibold">{fileLoaderContent.drop}</p>
            <p className="mt-2 text-sm text-[var(--app-text-muted)]">
              {fileLoaderContent.accepted}
            </p>
            <button
              type="button"
              className="mt-6 rounded-md bg-[var(--app-accent)] px-5 py-3 text-sm font-semibold text-[var(--app-accent-text)] hover:bg-[var(--app-accent-hover)] focus-visible:ring-2 focus-visible:ring-[var(--app-focus)] focus-visible:outline-none"
              onClick={() => inputRef.current?.click()}
            >
              {fileLoaderContent.choose}
            </button>
            {state === "error" ? (
              <p
                className="mt-4 font-medium text-[var(--app-error)]"
                role="alert"
              >
                {message}
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
