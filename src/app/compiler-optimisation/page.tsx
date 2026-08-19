import type { Metadata } from "next";

import { CompilerOptimisationExplorer } from "./_components/compiler-optimisation-explorer";

export const metadata: Metadata = {
  title: "Compiler optimisation workspace",
  description: "Inspect compiler optimisation passes and their LLVM IR output.",
};

export default function CompilerOptimisationPage() {
  return <CompilerOptimisationExplorer />;
}
