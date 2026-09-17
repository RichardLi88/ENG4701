// Opt-in engineering smoke; never overwrites or resumes historical RQ runs.
import assert from "node:assert/strict";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { generateExplanation } from "../src/server/ai/client.ts";
import { parseOptimisationResult } from "../src/app/compiler-optimisation/_lib/optimisation-adapter.ts";
import { toExplainInput } from "../src/app/compiler-optimisation/_lib/ai-explain-input.ts";

assert.deepEqual(
  process.argv.slice(2),
  ["--live"],
  "Use --live to explicitly permit three paid Luna requests.",
);
const env = {
  ...parseEnv(await readFile(new URL("../.env", import.meta.url), "utf8")),
  ...parseEnv(
    await readFile(new URL("../.env.local", import.meta.url), "utf8"),
  ),
  ...process.env,
};
assert.ok(env.OPENAI_API_KEY, "Configure OPENAI_API_KEY in .env.local");
const directory = new URL(
  `../tests/artifacts/ai/${Date.now()}/`,
  import.meta.url,
);
await mkdir(directory, { recursive: true });
const source = await readFile(
  new URL(
    "../src/test-data/compiler-optimisation/day3-control-flow.c",
    import.meta.url,
  ),
  "utf8",
);
async function post(path, body) {
  const response = await fetch(
    `${env.LLVM_SERVICE_URL ?? "http://localhost:3001"}/${path}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  assert.ok(response.ok, `LLVM ${path}: ${response.status}`);
  return response.json();
}
const compiled = await post("compile", {
  source,
  filename: "day3-control-flow.c",
});
const payload = await post("optimise-structured", {
  ir: compiled.ir,
  filename: "day3-control-flow.c",
  level: "O1",
});
await writeFile(
  new URL("trace.json", directory),
  JSON.stringify(payload, null, 2),
);
const parsed = parseOptimisationResult(payload);
assert.ok(parsed.ok, parsed.error?.message);
const model = parsed.data;
assert.match(model.toolVersion, /^14\.0\./);
const gcd = (pass) =>
  pass.scope.level === "function" &&
  pass.scope.functionName === "greatest_common_divisor";
const selected = [
  model.passes.find(
    (p) => gcd(p) && p.name.toLowerCase().includes("sroa") && p.changed,
  ),
  model.passes.find(
    (p) => gcd(p) && p.name.toLowerCase().includes("sroa") && !p.changed,
  ),
  model.passes.find((p) => p.type === "analysis"),
];
for (const [index, pass] of selected.entries()) {
  assert.ok(pass, `Missing representative case ${index}`);
  const record = await generateExplanation(toExplainInput(pass, model), {
    apiKey: env.OPENAI_API_KEY,
  });
  await writeFile(
    new URL(`case-${index + 1}.json`, directory),
    JSON.stringify(record, null, 2),
    { flag: "wx" },
  );
  console.log(
    JSON.stringify({
      case: index + 1,
      pass: pass.name,
      type: pass.type,
      changed: pass.changed,
      status: record.status,
      message: record.message,
      model: record.returnedModel,
      latencyMs: record.usage.latencyMs,
      checks: record.checks.map((c) => c.status),
    }),
  );
  assert.equal(record.status, "completed");
}
console.log(`Engineering records (not RQ scores): ${directory.pathname}`);
