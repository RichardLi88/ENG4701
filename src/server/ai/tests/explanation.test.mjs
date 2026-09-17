import assert from "node:assert/strict";
import test from "node:test";
import { generateExplanation, prepareRecord, sha256 } from "../client.ts";
import { explainInputSchema } from "../schema.ts";
import { createRequestGate } from "../limit.ts";
import { llvm, reduction, output, providerBody } from "./fixtures.mjs";

test("D sends the fixed Luna request and exports exact evidence, prompt and response", async () => {
  let sent;
  const record = await generateExplanation(llvm, {
    apiKey: "secret-test",
    fetcher: async (url, options) => {
      assert.equal(url, "https://api.openai.com/v1/responses");
      sent = JSON.parse(options.body);
      return new Response(JSON.stringify(providerBody()));
    },
  });
  assert.equal(sent.model, "gpt-5.6-luna");
  assert.equal(sent.reasoning.effort, "medium");
  assert.equal(sent.text.format.type, "json_schema");
  assert.equal(sent.temperature, undefined);
  assert.equal(sent.store, false);
  assert.deepEqual(sent.tools, []);
  assert.equal(record.status, "completed");
  assert.equal(record.strategy, "D");
  assert.equal(record.checks[0].status, "match");
  assert.equal(record.promptHash, sha256(JSON.stringify(record.prompt)));
  assert.equal(record.evidenceHash, sha256(JSON.stringify(record.evidence)));
  assert.equal(record.knowledgeHash, sha256(JSON.stringify(record.knowledge)));
  assert.ok(!JSON.stringify(record).includes("secret-test"));
});
test("unmatched version blocks without a request and never labels a fallback D", async () => {
  for (const version of [null, "18.1.0", "14.1.0"]) {
    const record = await generateExplanation(
      { ...llvm, toolVersion: version },
      {
        apiKey: "key",
        fetcher: () => {
          throw Error("must not call");
        },
      },
    );
    assert.equal(record.status, "blocked");
    assert.equal(record.strategy, "unavailable");
    assert.equal(record.request, null);
  }
});
test("unknown pass gets explicitly scoped general background, not an invented mechanism", () => {
  const record = prepareRecord({
    ...llvm,
    subject: { ...llvm.subject, name: "UnlistedPass" },
  });
  assert.equal(record.knowledge.length, 1);
  assert.match(record.knowledge[0].scope, /No pass-specific/);
});
test("unchanged and analysis identity survives prompt construction", () => {
  for (const type of ["transform", "analysis"]) {
    const record = prepareRecord({
      ...llvm,
      after: llvm.before,
      metrics: [],
      llvm: { ...llvm.llvm, changed: false, type },
    });
    assert.match(record.evidence[4].text, /"changed":false/);
    assert.ok(record.evidence[4].text.includes(type));
  }
});
test("all candidate outcomes and accepted steps retain test and acceptance boundaries", () => {
  for (const status of [
    "INTERESTING",
    "REJECTED",
    "INVALID",
    "CACHE_HIT",
    "CANCELLED",
    "NOT_TESTED",
  ]) {
    const record = prepareRecord({
      ...reduction,
      reduction: { ...reduction.reduction, status },
    });
    assert.match(record.evidence[2].label, /not retained/);
    assert.ok(record.evidence[4].text.includes(status));
    assert.match(record.evidence[4].text, /"testDescription":null/);
  }
  const accepted = prepareRecord({
    ...reduction,
    reduction: {
      ...reduction.reduction,
      status: "INTERESTING",
      accepted: true,
      exitCode: 0,
    },
  });
  assert.equal(accepted.evidence[2].label, "After snapshot");
  const patch = prepareRecord({ ...reduction, after: null, patch: "-line" });
  assert.equal(patch.evidence[2].text, "-line");
});
test("inconsistent evidence is rejected before generation", () => {
  const inputs = [
    { ...llvm, after: llvm.before },
    { ...llvm, llvm: { ...llvm.llvm, type: "analysis" } },
    { ...llvm, metrics: [{ ...llvm.metrics[0], delta: -1 }] },
    { ...llvm, metrics: [...llvm.metrics, ...llvm.metrics] },
    { ...reduction, reduction: { ...reduction.reduction, accepted: true } },
    { ...llvm, before: "x".repeat(100001) },
  ];
  inputs.forEach((input) =>
    assert.equal(explainInputSchema.safeParse(input).success, false),
  );
});
test("rejects incomplete, refusal, wrong model, malformed schema and unknown citations; retains raw response", async () => {
  const bodies = [
    providerBody(output, { status: "incomplete" }),
    providerBody(output, {
      output: [{ type: "message", content: [{ type: "refusal" }] }],
    }),
    providerBody(output, { model: "another-model" }),
    providerBody({ bad: true }),
    providerBody({
      ...output,
      conclusions: [{ text: "unsupported reference", evidenceIds: ["E99"] }],
    }),
  ];
  for (const body of bodies) {
    const record = await generateExplanation(llvm, {
      apiKey: "key",
      fetcher: async () => new Response(JSON.stringify(body)),
    });
    assert.equal(record.status, "failed");
    assert.equal(record.output, null);
    assert.ok(record.rawResponse);
  }
});
test("flags mismatching or absent metrics without claiming semantic verification", async () => {
  const record = await generateExplanation(llvm, {
    apiKey: "key",
    fetcher: async () =>
      new Response(
        JSON.stringify(
          providerBody({
            ...output,
            metricClaims: [
              { metric: "instructions", claimedDelta: -3 },
              { metric: "runtime", claimedDelta: -1 },
            ],
          }),
        ),
      ),
  });
  assert.deepEqual(
    record.checks.map((c) => c.status),
    ["mismatch", "unsupported"],
  );
});
test("one attempt, safe errors, missing credentials and timeouts", async () => {
  assert.match((await generateExplanation(llvm)).message, /OPENAI_API_KEY/);
  let calls = 0;
  const result = await generateExplanation(llvm, {
    apiKey: "secret",
    fetcher: async () => {
      calls++;
      return new Response("secret", { status: 429 });
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.status, "failed");
  assert.equal(result.rawResponse, "[REDACTED]");
  const timeout = await generateExplanation(llvm, {
    apiKey: "key",
    fetcher: async () => {
      throw new DOMException("timeout", "TimeoutError");
    },
  });
  assert.match(timeout.message, /timed out/);
});
test("process request gate limits concurrency and count; release is idempotent", () => {
  const gate = createRequestGate(2, 1, 100);
  const first = gate(0);
  assert.ok(first);
  assert.equal(gate(1), null);
  first();
  first();
  const second = gate(2);
  assert.ok(second);
  second();
  assert.equal(gate(3), null);
  assert.ok(gate(101));
});
