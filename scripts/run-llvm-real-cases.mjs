import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { parseOptimisationResult } from "../src/app/compiler-optimisation/_lib/optimisation-adapter.ts";
import { optimisationResultSchema } from "../src/app/compiler-optimisation/_lib/optimisation-schema.ts";

const serviceUrl = process.env.LLVM_SERVICE_URL ?? "http://localhost:3001";
const fixtureDirectory = new URL(
  "../src/test-data/compiler-optimisation/",
  import.meta.url,
);
const requestTimeoutMs = 45_000;

const cases = [
  { sourceFile: "day3-basic.c", minimumFunctions: 2 },
  { sourceFile: "e2e-multi-function.c", minimumFunctions: 2 },
  { sourceFile: "day3-control-flow.c", minimumFunctions: 3 },
  {
    sourceFile: "day3-special-function.c",
    minimumFunctions: 3,
    expectedFunction: "special.function-$case",
    minimumPayloadLength: 250_000,
  },
  {
    sourceFile: "day3-operators.cpp",
    minimumFunctions: 2,
    expectedFunctionPattern: /^_ZN10arithmetic/,
  },
];

async function fetchWithTimeout(endpoint, init) {
  return fetch(`${serviceUrl}/${endpoint}`, {
    ...init,
    signal: AbortSignal.timeout(requestTimeoutMs),
  });
}

async function post(endpoint, body) {
  const response = await fetchWithTimeout(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(
      `${endpoint} failed with HTTP ${response.status}: ${await response.text()}`,
    );
  }

  return response.json();
}

function assertPayloadInvariants(payload, payloadText, testCase) {
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
  assert.ok(payload.passes.some((pass) => pass.metrics !== undefined));
  assert.ok(
    payload.passes
      .filter((pass) => pass.changed)
      .every((pass) => Array.isArray(pass.ir.diff)),
  );
  assert.ok(
    payload.passes.some(
      (pass) => pass.cfg !== undefined && pass.cfg.before.nodes.length > 0,
    ),
  );
  assert.ok(payload.passes.some((pass) => pass.transformation !== undefined));
  assert.ok(
    payload.passes.every((pass) =>
      pass.metrics === undefined
        ? true
        : Object.values(pass.metrics).every(
            (metric) => metric.estimated === true,
          ),
    ),
  );
  assert.ok(
    payload.passes.every(
      (pass) => pass.changed === (pass.ir.before !== pass.ir.after),
    ),
  );
  assert.ok(payloadText.length >= (testCase.minimumPayloadLength ?? 1));

  if (testCase.expectedFunction !== undefined) {
    assert.ok(
      payload.functions.some((fn) => fn.name === testCase.expectedFunction),
    );
  }

  if (testCase.expectedFunctionPattern !== undefined) {
    assert.ok(
      payload.functions.some((fn) =>
        testCase.expectedFunctionPattern.test(fn.name),
      ),
    );
  }
}

try {
  const healthResponse = await fetchWithTimeout("health", {});
  assert.equal(healthResponse.ok, true, "LLVM service health check failed");
} catch (error) {
  throw new Error(
    `LLVM service is not available at ${serviceUrl}. Start it with ./start-llvm.sh before running this test.`,
    { cause: error },
  );
}

for (const testCase of cases) {
  const source = await readFile(
    new URL(testCase.sourceFile, fixtureDirectory),
    "utf8",
  );
  const compilation = await post("compile", {
    source,
    filename: testCase.sourceFile,
  });
  assert.equal(typeof compilation.ir, "string");
  assert.ok(compilation.ir.length > 0);

  const rawPayload = await post("optimise-structured", {
    ir: compilation.ir,
    filename: testCase.sourceFile,
  });
  const payload = optimisationResultSchema.parse(rawPayload);
  const adaptedPayload = parseOptimisationResult(payload);
  const payloadText = JSON.stringify(payload);

  assert.equal(
    adaptedPayload.ok,
    true,
    adaptedPayload.ok ? undefined : adaptedPayload.error.message,
  );
  assertPayloadInvariants(payload, payloadText, testCase);

  const changedPasses = payload.passes.filter((pass) => pass.changed).length;
  console.log(
    `✓ ${testCase.sourceFile}: ${payload.functions.length} functions, ${payload.passes.length} Passes, ${changedPasses} changed`,
  );
}
