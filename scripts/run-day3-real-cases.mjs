import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";

import { parseOptimisationResult } from "../src/app/compiler-optimisation/_lib/optimisation-adapter.ts";
import { optimisationResultSchema } from "../src/app/compiler-optimisation/_lib/optimisation-schema.ts";

const serviceUrl = process.env.LLVM_SERVICE_URL ?? "http://localhost:3001";
const fixtureDirectory = new URL(
  "../src/test-data/compiler-optimisation/",
  import.meta.url,
);
const outputUrl = new URL("day3-special-name-backend.json", fixtureDirectory);

const cases = [
  { sourceFile: "day3-basic.c", minimumFunctions: 2 },
  { sourceFile: "e2e-multi-function.c", minimumFunctions: 2 },
  { sourceFile: "day3-control-flow.c", minimumFunctions: 3 },
  {
    sourceFile: "day3-special-function.c",
    minimumFunctions: 3,
    expectedFunction: "special.function-$case",
    minimumPayloadLength: 250_000,
    saveFixture: true,
  },
  {
    sourceFile: "day3-operators.cpp",
    minimumFunctions: 2,
    expectedFunctionPattern: /^_ZN10arithmetic/,
  },
];

async function post(endpoint, body) {
  const response = await fetch(`${serviceUrl}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(
      `${endpoint} failed with HTTP ${response.status}: ${errorBody}`,
    );
  }

  return response.json();
}

function assertPayloadInvariants(payload, fixtureText, testCase) {
  assert.equal(payload.meta.sourceFile, testCase.sourceFile);
  assert.equal(payload.meta.totalPasses, payload.passes.length);
  assert.ok(payload.functions.length >= testCase.minimumFunctions);
  assert.equal(
    new Set(payload.functions.map((fn) => fn.id)).size,
    payload.functions.length,
  );
  assert.equal(
    new Set(payload.passes.map((pass) => pass.id)).size,
    payload.passes.length,
  );
  assert.deepEqual(
    payload.passes.map((pass) => pass.order),
    payload.passes.map((_, index) => index),
  );
  assert.ok(payload.passes.some((pass) => pass.changed));
  assert.ok(payload.passes.some((pass) => !pass.changed));
  assert.ok(
    payload.passes.every(
      (pass) => pass.changed === (pass.ir.before !== pass.ir.after),
    ),
  );
  assert.ok(fixtureText.length >= (testCase.minimumPayloadLength ?? 1));

  if (testCase.expectedFunction) {
    assert.ok(
      payload.functions.some((fn) => fn.name === testCase.expectedFunction),
    );
  }

  if (testCase.expectedFunctionPattern) {
    assert.ok(
      payload.functions.some((fn) =>
        testCase.expectedFunctionPattern.test(fn.name),
      ),
    );
  }
}

const healthResponse = await fetch(`${serviceUrl}/health`);
assert.equal(healthResponse.ok, true, "LLVM service health check failed");

for (const testCase of cases) {
  const sourceUrl = new URL(testCase.sourceFile, fixtureDirectory);
  const source = await readFile(sourceUrl, "utf8");
  const compilation = await post("compile", {
    source,
    filename: testCase.sourceFile,
  });
  const rawPayload = await post("optimise-structured", {
    ir: compilation.ir,
    filename: testCase.sourceFile,
  });
  const payload = optimisationResultSchema.parse(rawPayload);
  const adaptedPayload = parseOptimisationResult(payload);
  const fixtureText = `${JSON.stringify(payload, null, 2)}\n`;

  assert.equal(
    adaptedPayload.ok,
    true,
    adaptedPayload.ok ? undefined : adaptedPayload.error.message,
  );
  assertPayloadInvariants(payload, fixtureText, testCase);

  if (testCase.saveFixture) {
    await writeFile(outputUrl, fixtureText, "utf8");
  }

  const changedPasses = payload.passes.filter((pass) => pass.changed).length;
  console.log(
    `${testCase.sourceFile}: ${payload.functions.length} functions, ${payload.passes.length} passes (${changedPasses} changed), ${fixtureText.length} payload characters`,
  );
}

console.log(`Saved sanitised boundary fixture to ${outputUrl.pathname}`);
