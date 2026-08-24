"use client";

import { isTRPCClientError } from "@trpc/client";
import { useEffect, useRef, useState } from "react";

import type { AppRouter } from "~/server/api/root";
import { api } from "~/trpc/react";

import { compilerWorkflowContent } from "../content";
import { parseOptimisationResult } from "../_lib/optimisation-adapter";
import {
  DEFAULT_OPTIMISATION_LEVEL,
  OPTIMISATION_LEVELS,
  type OptimisationLevel,
} from "../_lib/optimisation-levels";
import type { OptimisationViewModel } from "../_lib/optimisation-types";
import {
  classifyCompilerWorkflowFailure,
  isCompilerWorkflowPending,
  type CompilerWorkflowRemoteStage,
  type CompilerWorkflowState,
  validateCompilerInput,
} from "../_lib/compiler-workflow";
import { StatusPanel } from "./status-panel";

const initialWorkflowState: CompilerWorkflowState = { status: "idle" };

type CompilerWorkflowFormProps = Readonly<{
  onRunStart: () => void;
  onResult: (model: OptimisationViewModel) => void;
  compact?: boolean;
}>;

export function CompilerWorkflowForm({
  onRunStart,
  onResult,
  compact = false,
}: CompilerWorkflowFormProps) {
  const [workflowState, setWorkflowState] =
    useState<CompilerWorkflowState>(initialWorkflowState);
  const [level, setLevel] = useState<OptimisationLevel>(
    DEFAULT_OPTIMISATION_LEVEL,
  );
  const submissionInProgressRef = useRef(false);
  const mountedRef = useRef(true);
  const compileMutation = api.compiler.compile.useMutation();
  const optimiseMutation = api.compiler.optimiseStructured.useMutation();
  const isPending = isCompilerWorkflowPending(workflowState.status);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (file === undefined || submissionInProgressRef.current) {
      return;
    }

    if (!/\.(c|cpp)$/i.test(file.name)) {
      setWorkflowState({ status: "failure", code: "unsupportedExtension" });
      return;
    }

    submissionInProgressRef.current = true;
    setWorkflowState({ status: "validating" });

    let fileSource: string;

    try {
      fileSource = await file.text();
    } catch {
      if (mountedRef.current) {
        setWorkflowState({ status: "failure", code: "fileReadFailed" });
      }

      submissionInProgressRef.current = false;
      return;
    }

    if (!mountedRef.current) {
      submissionInProgressRef.current = false;
      return;
    }

    const validation = validateCompilerInput(file.name, fileSource);

    if (!validation.ok) {
      setWorkflowState({ status: "failure", code: validation.code });
      submissionInProgressRef.current = false;
      return;
    }

    let remoteStage: CompilerWorkflowRemoteStage = "compile";
    onRunStart();

    try {
      setWorkflowState({ status: "compiling" });
      const compilation = await compileMutation.mutateAsync({
        filename: validation.filename,
        source: validation.source,
      });

      remoteStage = "optimise";
      setWorkflowState({ status: "optimising" });
      const payload = await optimiseMutation.mutateAsync({
        filename: validation.filename,
        ir: compilation.ir,
        level,
      });

      if (mountedRef.current) {
        setWorkflowState({ status: "processing" });
        const result = parseOptimisationResult(payload);

        if (!result.ok) {
          setWorkflowState({ status: "failure", code: "schemaInvalid" });
          return;
        }

        onResult(result.data);
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }

      if (mountedRef.current) {
        setWorkflowState({ status: "success" });
      }
    } catch (error) {
      if (mountedRef.current) {
        const remoteError = isTRPCClientError<AppRouter>(error)
          ? {
              code: error.data?.code,
              hasSchemaIssues:
                error.data?.zodError !== null &&
                error.data?.zodError !== undefined,
            }
          : { hasSchemaIssues: false };

        setWorkflowState({
          status: "failure",
          code: classifyCompilerWorkflowFailure(remoteStage, remoteError),
        });
      }
    } finally {
      submissionInProgressRef.current = false;
    }
  }

  const statusContent =
    workflowState.status === "failure"
      ? {
          title: "Workflow failed",
          description: compilerWorkflowContent.errors[workflowState.code],
        }
      : compilerWorkflowContent.status[workflowState.status];

  if (compact) {
    return (
      <section
        aria-label={compilerWorkflowContent.compactRegionLabel}
        className="flex justify-end"
      >
        <label className="inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 transition-colors focus-within:ring-2 focus-within:ring-cyan-300 focus-within:outline-none hover:border-slate-600 hover:bg-slate-800 has-disabled:cursor-not-allowed has-disabled:opacity-50">
          <UploadIcon />
          {isPending
            ? compilerWorkflowContent.actions.uploading
            : compilerWorkflowContent.actions.uploadAnother}
          <input
            type="file"
            accept=".c,.cpp,text/x-c,text/x-c++"
            disabled={isPending}
            onChange={handleFileSelect}
            className="sr-only"
          />
        </label>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-3xl rounded-2xl border border-slate-800 bg-slate-900/60 p-6 sm:p-8">
      <div className="max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight text-white sm:text-3xl">
          {compilerWorkflowContent.heading}
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-400 sm:text-base">
          {compilerWorkflowContent.description}
        </p>
      </div>

      <div className="mt-6">
        <label
          htmlFor="optimisation-level"
          className="block text-sm font-medium text-slate-300"
        >
          {compilerWorkflowContent.level.label}
        </label>
        <div className="relative mt-2 inline-block">
          <select
            id="optimisation-level"
            aria-label={compilerWorkflowContent.level.selectLabel}
            value={level}
            disabled={isPending}
            onChange={(event) =>
              setLevel(event.target.value as OptimisationLevel)
            }
            className="min-h-11 appearance-none rounded-xl border border-slate-700 bg-slate-900 py-2 pr-10 pl-3 text-sm font-semibold text-slate-200 transition-colors focus:ring-2 focus:ring-cyan-300 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
          >
            {OPTIMISATION_LEVELS.map((option) => (
              <option key={option} value={option}>
                {compilerWorkflowContent.level.descriptions[option]}
              </option>
            ))}
          </select>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-slate-400"
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </div>
      </div>

      <div className="mt-6">
        <label className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-cyan-400/10 px-5 py-3 text-sm font-semibold text-cyan-100 transition-colors focus-within:ring-2 focus-within:ring-cyan-300 focus-within:ring-offset-2 focus-within:ring-offset-slate-900 focus-within:outline-none hover:bg-cyan-400/20 has-disabled:cursor-not-allowed has-disabled:opacity-50 sm:w-auto">
          <UploadIcon />
          {isPending
            ? compilerWorkflowContent.actions.uploading
            : compilerWorkflowContent.actions.upload}
          <input
            type="file"
            accept=".c,.cpp,text/x-c,text/x-c++"
            disabled={isPending}
            onChange={handleFileSelect}
            aria-describedby="compiler-upload-help"
            className="sr-only"
          />
        </label>
        <p
          id="compiler-upload-help"
          className="mt-3 text-xs leading-5 text-slate-500"
        >
          {compilerWorkflowContent.uploadHelp}
        </p>
      </div>

      {workflowState.status !== "idle" ? (
        <div className="mt-6">
          <StatusPanel
            eyebrow={workflowState.status}
            title={statusContent.title}
            description={statusContent.description}
            tone={workflowState.status === "failure" ? "error" : "info"}
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
