/**
 * Supported `opt` pipeline levels, exposed to the user as `default<LEVEL>`.
 * This is the single source of truth for the TypeScript side (tRPC input enum
 * and the UI dropdown). The LLVM service keeps its own independent allowlist at
 * the shell boundary - keep the two in sync.
 */
export const OPTIMISATION_LEVELS = [
  "O0",
  "O1",
  "O2",
  "O3",
  "Os",
  "Oz",
] as const;

export type OptimisationLevel = (typeof OPTIMISATION_LEVELS)[number];

export const DEFAULT_OPTIMISATION_LEVEL: OptimisationLevel = "O1";
