import type { Metadata } from "next";

import { ProgramReductionHome } from "./_components/program-reduction-home";

export const metadata: Metadata = {
  title: "Perses reduction trace visualiser",
  description:
    "Inspect accepted Perses reductions and unsuccessful candidates side by side.",
};

export default function ProgramReductionPage() {
  return <ProgramReductionHome />;
}
