"use client";

import {
  createContext,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { api } from "~/trpc/react";
import {
  AI_RELEASE,
  explainInputSchema,
  type ExplainInput,
  type ExplanationRecord,
} from "~/server/ai/schema";
import { aiContent } from "./content";
import { ExplanationPanel } from "./explanation-panel";

type SessionEntry = {
  pending: boolean;
  records: ExplanationRecord[];
  error: string | null;
};
type Session = {
  entries: Map<string, SessionEntry>;
  generate: (key: string, input: ExplainInput) => void;
};
const Context = createContext<Session | null>(null);

/** One loaded trace owns its cache. No database, browser storage or cross-user results. */
export function ExplanationSessionProvider({
  children,
}: {
  children: ReactNode;
}) {
  const mutation = api.ai.explain.useMutation();
  const [entries, setEntries] = useState(new Map<string, SessionEntry>());
  const active = useRef(new Set<string>());
  function update(key: string, change: (entry: SessionEntry) => SessionEntry) {
    setEntries((previous) => {
      const next = new Map(previous);
      next.set(
        key,
        change(next.get(key) ?? { pending: false, records: [], error: null }),
      );
      // Bound session memory without evicting in-flight records.
      if (next.size > 32)
        for (const [oldKey, entry] of next) {
          if (oldKey !== key && !entry.pending) {
            next.delete(oldKey);
            break;
          }
        }
      return next;
    });
  }
  function generate(key: string, input: ExplainInput) {
    if (active.current.has(key)) return;
    active.current.add(key);
    update(key, (entry) => ({ ...entry, pending: true, error: null }));
    void mutation
      .mutateAsync(input)
      .then((record) => {
        update(key, (entry) => ({
          pending: false,
          error: null,
          records: [...entry.records, record],
        }));
      })
      .catch(() => {
        update(key, (entry) => ({
          ...entry,
          pending: false,
          error: aiContent.error,
        }));
      })
      .finally(() => active.current.delete(key));
  }
  return (
    <Context.Provider value={{ entries, generate }}>
      {children}
    </Context.Provider>
  );
}

export function ExplanationContainer({ input }: { input: ExplainInput }) {
  const session = useContext(Context);
  if (!session) throw new Error("ExplanationSessionProvider is required");
  const valid = explainInputSchema.safeParse(input).success;
  const key = AI_RELEASE + JSON.stringify(input);
  const entry = session.entries.get(key);
  return (
    <ExplanationPanel
      input={input}
      pending={entry?.pending ?? false}
      records={entry?.records ?? []}
      error={valid ? (entry?.error ?? null) : aiContent.budget}
      disabled={!valid}
      onExplain={() => session.generate(key, input)}
    />
  );
}
