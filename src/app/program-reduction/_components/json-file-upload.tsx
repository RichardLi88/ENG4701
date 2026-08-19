"use client";

import { useRef, useState } from "react";

import type { JsonValue } from "../../_helpers/json";
import { jsonFileUploadContent, units } from "../content";
import { parseReductionTrace } from "../_lib/reduction-trace-adapter";
import type { ReductionTraceViewModel } from "../_lib/reduction-trace-adapter";
import type { UploadState } from "../models/json-file-upload.types";

type JsonFileUploadProps = Readonly<{
  hasLoadedTrace: boolean;
  onTraceLoaded: (model: ReductionTraceViewModel, fileName: string) => void;
}>;

export function JsonFileUpload({
  hasLoadedTrace,
  onTraceLoaded,
}: JsonFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
  });

  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
      setUploadState({
        status: "error",
        code: "invalidFileType",
      });
      return;
    }

    try {
      const parsedJson = JSON.parse(await file.text()) as JsonValue;
      const result = parseReductionTrace(parsedJson);

      if (!result.ok) {
        setUploadState({
          status: "error",
          code: "invalidTrace",
          detail: result.message,
        });
        return;
      }

      setUploadState({
        status: "loaded",
        fileName: file.name,
        size: file.size,
      });
      onTraceLoaded(result.data, file.name);
    } catch {
      setUploadState({
        status: "error",
        code: "invalidJson",
      });
    } finally {
      event.target.value = "";
    }
  };

  return (
    <div className="rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] p-6 shadow-[var(--app-shadow)] shadow-sm transition-colors">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={handleFileSelect}
      />

      <button
        type="button"
        className="rounded-md bg-[var(--app-accent)] px-5 py-3 text-sm font-semibold text-[var(--app-accent-text)] transition hover:bg-[var(--app-accent-hover)] focus:ring-2 focus:ring-[var(--app-focus)] focus:ring-offset-2 focus:ring-offset-[var(--app-surface)] focus:outline-none"
        onClick={() => fileInputRef.current?.click()}
      >
        {hasLoadedTrace
          ? jsonFileUploadContent.replaceButton
          : jsonFileUploadContent.uploadButton}
      </button>

      <div className="mt-5 min-h-16 rounded-md border border-[var(--app-border-subtle)] bg-[var(--app-panel)] p-4 text-sm transition-colors">
        {uploadState.status === "idle" ? (
          <p className="text-[var(--app-text-muted)]">
            {jsonFileUploadContent.idleMessage}
          </p>
        ) : null}

        {uploadState.status === "loaded" ? (
          <dl className="grid gap-2 text-[var(--app-text-secondary)] sm:grid-cols-2">
            <div>
              <dt className="font-semibold text-[var(--app-text-primary)]">
                {jsonFileUploadContent.labels.file}
              </dt>
              <dd className="break-all">{uploadState.fileName}</dd>
            </div>
            <div>
              <dt className="font-semibold text-[var(--app-text-primary)]">
                {jsonFileUploadContent.labels.size}
              </dt>
              <dd>
                {uploadState.size.toLocaleString()} {units.bytes}
              </dd>
            </div>
          </dl>
        ) : null}

        {uploadState.status === "error" ? (
          <div role="alert" className="text-[var(--app-error)]">
            <p className="font-medium">
              {jsonFileUploadContent.errors[uploadState.code]}
            </p>
            {uploadState.detail !== undefined ? (
              <p className="mt-1 font-mono text-xs break-words">
                {uploadState.detail}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
