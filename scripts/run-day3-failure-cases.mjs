import assert from "node:assert/strict";

import { optimisationResultSchema } from "../src/app/compiler-optimisation/_lib/optimisation-schema.ts";
import { validateCompilerInput } from "../src/app/compiler-optimisation/_lib/compiler-workflow.ts";

const serviceUrl = process.env.LLVM_SERVICE_URL ?? "http://localhost:3001";

async function postRaw(endpoint, body) {
  return fetch(`${serviceUrl}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
  });
}

assert.deepEqual(validateCompilerInput("empty.c", " \n"), {
  ok: false,
  code: "emptySource",
});
assert.deepEqual(validateCompilerInput("wrong.txt", "int main() {}"), {
  ok: false,
  code: "unsupportedExtension",
});

const failureCases = [
  {
    name: "empty service payload",
    endpoint: "compile",
    body: JSON.stringify({ source: "", filename: "empty.c" }),
    status: 400,
  },
  {
    name: "C syntax error",
    endpoint: "compile",
    body: JSON.stringify({ source: "int main( {", filename: "broken.c" }),
    status: 500,
  },
  {
    name: "C++ syntax error",
    endpoint: "compile",
    body: JSON.stringify({
      source: "template <typename {",
      filename: "broken.cpp",
    }),
    status: 500,
  },
  {
    name: "unsupported structured filename",
    endpoint: "optimise-structured",
    body: JSON.stringify({
      ir: "define i32 @main() { ret i32 0 }",
      filename: "wrong.txt",
    }),
    status: 400,
  },
  {
    name: "invalid JSON",
    endpoint: "compile",
    body: "{not-json",
    status: 400,
    error: "invalid JSON body",
  },
];

for (const failureCase of failureCases) {
  const response = await postRaw(failureCase.endpoint, failureCase.body);
  const payload = await response.json();

  assert.equal(response.status, failureCase.status, failureCase.name);
  assert.equal(typeof payload.error, "string", failureCase.name);
  if (failureCase.error) {
    assert.equal(payload.error, failureCase.error, failureCase.name);
  }
  console.log(`${failureCase.name}: HTTP ${response.status}`);
}

const unsupportedVersion = optimisationResultSchema.safeParse({
  schemaVersion: "2.0.0",
  meta: { sourceFile: "input.c", optimisationLevel: "O1", totalPasses: 0 },
  functions: [],
  passes: [],
});
assert.equal(unsupportedVersion.success, false);
assert.ok(
  unsupportedVersion.error.issues.some(
    (issue) => issue.path.join(".") === "schemaVersion",
  ),
);
console.log("unsupported schema version: rejected at schemaVersion");
