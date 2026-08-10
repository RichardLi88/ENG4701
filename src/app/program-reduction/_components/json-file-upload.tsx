"use client";

import { useRef, useState } from "react";

import {
  getJsonRootType,
  type JsonRootType,
  type JsonValue,
} from "../../_helpers/json";
import { jsonFileUploadContent, jsonRootTypeLabels, units } from "../content";

type UploadState =
  | { status: "idle" }
  | {
      status: "loaded";
      fileName: string;
      size: number;
      topLevelType: JsonRootType;
    }
  | { status: "error"; code: keyof typeof jsonFileUploadContent.errors };

export function JsonFileUpload() {
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

      setUploadState({
        status: "loaded",
        fileName: file.name,
        size: file.size,
        topLevelType: getJsonRootType(parsedJson),
      });
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
    <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm">
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        onChange={handleFileSelect}
      />

      <button
        type="button"
        className="rounded-md bg-violet-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-800 focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 focus:outline-none"
        onClick={() => fileInputRef.current?.click()}
      >
        {jsonFileUploadContent.uploadButton}
      </button>

      <div className="mt-5 min-h-16 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm">
        {uploadState.status === "idle" ? (
          <p className="text-slate-600">{jsonFileUploadContent.idleMessage}</p>
        ) : null}

        {uploadState.status === "loaded" ? (
          <dl className="grid gap-2 text-slate-700 sm:grid-cols-3">
            <div>
              <dt className="font-semibold text-slate-950">
                {jsonFileUploadContent.labels.file}
              </dt>
              <dd className="break-all">{uploadState.fileName}</dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-950">
                {jsonFileUploadContent.labels.size}
              </dt>
              <dd>
                {uploadState.size.toLocaleString()} {units.bytes}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-950">
                {jsonFileUploadContent.labels.jsonRoot}
              </dt>
              <dd>{jsonRootTypeLabels[uploadState.topLevelType]}</dd>
            </div>
          </dl>
        ) : null}

        {uploadState.status === "error" ? (
          <p className="font-medium text-red-700">
            {jsonFileUploadContent.errors[uploadState.code]}
          </p>
        ) : null}
      </div>
    </div>
  );
}
