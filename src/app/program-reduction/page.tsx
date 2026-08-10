import { JsonFileUpload } from "./_components/json-file-upload";
import { programReductionContent } from "./content";

export default function ProgramReductionPage() {
  return (
    <main className="min-h-screen bg-slate-100 px-6 py-12 text-slate-950">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-wide text-violet-700 uppercase">
            {programReductionContent.eyebrow}
          </p>
          <h1 className="text-4xl font-bold">
            {programReductionContent.heading}
          </h1>
          <p className="max-w-2xl text-base text-slate-700">
            {programReductionContent.description}
          </p>
        </div>

        <JsonFileUpload />
      </section>
    </main>
  );
}
