import { readFile, writeFile } from "node:fs/promises";

import { optimisationResultSchema } from "../src/app/compiler-optimisation/_lib/optimisation-schema.ts";

const serviceUrl = process.env.LLVM_SERVICE_URL ?? "http://localhost:3001";
const sourceFile = "e2e-multi-function.c";
const sourceUrl = new URL(
  `../src/test-data/compiler-optimisation/${sourceFile}`,
  import.meta.url,
);
const outputUrl = new URL(
  "../src/test-data/compiler-optimisation/day2-real-backend.json",
  import.meta.url,
);

async function post(endpoint, body) {
  const response = await fetch(`${serviceUrl}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`${endpoint} failed with HTTP ${response.status}`);
  }

  return response.json();
}

const source = await readFile(sourceUrl, "utf8");
const compilation = await post("compile", { source, filename: sourceFile });
const rawPayload = await post("optimise-structured", {
  ir: compilation.ir,
  filename: sourceFile,
});
const payload = optimisationResultSchema.parse(rawPayload);

await writeFile(outputUrl, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
console.log(
  `Saved ${payload.functions.length} functions and ${payload.passes.length} passes to ${outputUrl.pathname}`,
);
