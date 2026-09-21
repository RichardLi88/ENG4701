import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { irDiffContent } from "../content.ts";
import { selectIrGlossary } from "./ir-glossary.ts";

const tokensIn = (...irs) => selectIrGlossary(...irs).map((e) => e.token);

test("explains only the notation present in the IR on screen", () => {
  const tokens = tokensIn("define @f() {\n  ret i32 0\n}");

  assert.ok(tokens.includes("define"));
  assert.ok(tokens.includes("ret"));
  assert.ok(tokens.includes("@name"));
  assert.equal(tokens.includes("phi"), false, "phi is not in this IR");
  assert.equal(tokens.includes("alloca"), false, "alloca is not in this IR");
});

test("covers both sides of a comparison", () => {
  const tokens = tokensIn("  %1 = alloca i32", "  %2 = phi i32 [ 0, %a ]");

  assert.ok(tokens.includes("alloca"));
  assert.ok(tokens.includes("phi"));
});

test("returns nothing when there is no IR", () => {
  assert.deepEqual(selectIrGlossary(undefined, null, ""), []);
});

test("matches whole words only", () => {
  const tokens = tokensIn("  %padding_or_subtotal = xor i32 %0, 1");

  assert.equal(tokens.includes("add"), false);
  assert.equal(tokens.includes("sub"), false);
});

test("keeps the authored order so groups stay contiguous", () => {
  const authored = irDiffContent.legend.entries.map(([token]) => token);
  const tokens = tokensIn(
    readFileSync(
      new URL("../../../../study/logs/accumulate.O1.log", import.meta.url),
      "utf8",
    ),
  );

  assert.deepEqual(
    tokens,
    authored.filter((token) => tokens.includes(token)),
  );
});

test("every entry names a group that exists", () => {
  const groups = Object.keys(irDiffContent.legend.groups);

  for (const [token, group] of irDiffContent.legend.entries) {
    assert.ok(groups.includes(group), `${token} has unknown group ${group}`);
  }
});

test("a real trace exercises most of the glossary", () => {
  const log = readFileSync(
    new URL("../../../../study/logs/accumulate.O1.log", import.meta.url),
    "utf8",
  );
  const tokens = tokensIn(log);

  for (const expected of ["define", "br", "ret", "phi", "icmp", "alloca"]) {
    assert.ok(tokens.includes(expected), `${expected} should be explained`);
  }
});
