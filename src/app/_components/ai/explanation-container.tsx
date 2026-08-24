"use client";

import { useMemo } from "react";

import type { ExplainInput } from "~/server/ai/schema/evidence-input";
import type { AiErrorCode } from "~/server/ai/errors";
import { api } from "~/trpc/react";

import {
  ExplanationPanel,
  type ExplanationPanelState,
} from "./explanation-panel";

export type ExplanationContainerProps = Readonly<{
  input: ExplainInput;
  selectionKey: string;
}>;

export function ExplanationContainer({
  input,
  selectionKey,
}: ExplanationContainerProps) {
  return <ExplanationSession key={selectionKey} input={input} />;
}

function ExplanationSession({ input }: Readonly<{ input: ExplainInput }>) {
  const explain = api.ai.explain.useMutation();

  const state = useMemo<ExplanationPanelState>(() => {
    if (explain.isPending) {
      return { status: "loading" };
    }
    if (explain.error) {
      return { status: "error", code: readErrorCode(explain.error) };
    }
    if (explain.data) {
      return { status: "ready", result: explain.data };
    }
    return { status: "idle" };
  }, [explain.isPending, explain.error, explain.data]);

  return (
    <ExplanationPanel
      state={state}
      onExplain={() => {
        explain.mutate(input);
      }}
    />
  );
}

/** The router surfaces AiError through the tRPC error shape*/
function readErrorCode(error: { data?: unknown }): AiErrorCode {
  const data = error.data as { aiError?: { code?: AiErrorCode } } | undefined;
  return data?.aiError?.code ?? "provider-unavailable";
}
