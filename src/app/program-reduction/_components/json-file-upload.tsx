"use client";

import { useState } from "react";

import { StatusPanel } from "~/app/_components/status-panel";

import type { JsonValue } from "../../_helpers/json";
import { jsonFileUploadContent, programReductionContent } from "../content";
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
  const [uploadState, setUploadState] = useState<UploadState>({
    status: "idle",
  });

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file === undefined) {
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

      setUploadState({ status: "idle" });
      onTraceLoaded(result.data, file.name);
    } catch {
      setUploadState({
        status: "error",
        code: "invalidJson",
      });
    }
  }

  if (hasLoadedTrace) {
    return (
      <section
        aria-label={jsonFileUploadContent.compactRegionLabel}
        className="flex justify-end"
      >
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors focus-within:ring-2 focus-within:ring-cyan-300 focus-within:outline-none hover:border-slate-600 hover:bg-slate-800">
          <UploadIcon />
          {jsonFileUploadContent.replaceButton}
          <input
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelect}
            className="sr-only"
          />
        </label>
      </section>
    );
  }

  const errorDescription =
    uploadState.status === "error" && uploadState.detail !== undefined
      ? `${jsonFileUploadContent.errors[uploadState.code]} ${uploadState.detail}`
      : uploadState.status === "error"
        ? `${jsonFileUploadContent.errors[uploadState.code]} ${jsonFileUploadContent.status.errorDescription}`
        : null;

  return (
    <section className="mx-auto w-full max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
      <div className="max-w-2xl">
        <p className="text-xs font-semibold tracking-[0.18em] text-cyan-300 uppercase">
          {programReductionContent.eyebrow}
        </p>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {programReductionContent.heading}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
          {programReductionContent.description}
        </p>
      </div>

      <div className="mt-6">
        <label className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition-colors focus-within:ring-2 focus-within:ring-cyan-300 focus-within:ring-offset-2 focus-within:ring-offset-slate-900 focus-within:outline-none hover:bg-cyan-400/20 sm:w-auto">
          <UploadIcon />
          {jsonFileUploadContent.uploadButton}
          <input
            type="file"
            accept="application/json,.json"
            onChange={handleFileSelect}
            aria-describedby="reduction-upload-help"
            className="sr-only"
          />
        </label>
        <p
          id="reduction-upload-help"
          className="mt-3 text-xs leading-5 text-slate-500"
        >
          {jsonFileUploadContent.uploadHelp}
        </p>
      </div>

      {errorDescription !== null ? (
        <div className="mt-6">
          <StatusPanel
            eyebrow={jsonFileUploadContent.status.errorEyebrow}
            title={jsonFileUploadContent.status.errorTitle}
            description={errorDescription}
            tone="error"
            compact
          />
        </div>
      ) : null}
    </section>
  );
}

function UploadIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
    >
      <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
      <path d="M5 14.5v3A2.5 2.5 0 0 0 7.5 20h9a2.5 2.5 0 0 0 2.5-2.5v-3" />
    </svg>
  );
}
