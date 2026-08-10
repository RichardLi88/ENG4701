import { programReductionContent } from "../content";
import { JsonFileUpload } from "./json-file-upload";

export function ProgramReductionHome() {
  return (
    <main className="px-6 py-12">
      <section className="mx-auto flex w-full max-w-3xl flex-col gap-8">
        <div className="space-y-3">
          <p className="text-sm font-semibold tracking-wide text-[var(--app-accent)] uppercase">
            {programReductionContent.eyebrow}
          </p>
          <h1 className="text-4xl font-bold">
            {programReductionContent.heading}
          </h1>
          <p className="max-w-2xl text-base text-[var(--app-text-secondary)]">
            {programReductionContent.description}
          </p>
        </div>

        <JsonFileUpload />
      </section>
    </main>
  );
}
