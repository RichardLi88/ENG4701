import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import { TRPCError } from "@trpc/server";

import { callLlvmService } from "./llvm-service-client.ts";

async function withServer(handler, run) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");

  try {
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise((resolve, reject) =>
      server.close((error) =>
        error === undefined ? resolve() : reject(error),
      ),
    );
  }
}

async function assertTrpcError(action, expectedCode) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof TRPCError);
    assert.equal(error.code, expectedCode);
    return true;
  });
}

test("returns a JSON object from a successful LLVM response", async () => {
  await withServer(
    (_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end('{"ir":"define i32 @main() { ret i32 0 }"}');
    },
    async (serviceUrl) => {
      const result = await callLlvmService({
        serviceUrl,
        endpoint: "compile",
        body: { source: "int main(void) { return 0; }" },
        timeoutMs: 1_000,
      });

      assert.deepEqual(result, { ir: "define i32 @main() { ret i32 0 }" });
    },
  );
});

test("rejects invalid JSON from a successful LLVM response", async () => {
  await withServer(
    (_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("not-json");
    },
    async (serviceUrl) => {
      await assertTrpcError(
        () =>
          callLlvmService({
            serviceUrl,
            endpoint: "compile",
            body: { source: "int main(void) { return 0; }" },
            timeoutMs: 1_000,
          }),
        "INTERNAL_SERVER_ERROR",
      );
    },
  );
});

test("maps compile and optimisation HTTP failures to stable codes", async () => {
  await withServer(
    (_request, response) => {
      response.writeHead(500, { "Content-Type": "application/json" });
      response.end('{"error":"backend detail"}');
    },
    async (serviceUrl) => {
      await assertTrpcError(
        () =>
          callLlvmService({
            serviceUrl,
            endpoint: "compile",
            body: { source: "broken" },
            timeoutMs: 1_000,
          }),
        "BAD_REQUEST",
      );
      await assertTrpcError(
        () =>
          callLlvmService({
            serviceUrl,
            endpoint: "optimise-structured",
            body: { ir: "broken", filename: "broken.c" },
            timeoutMs: 1_000,
          }),
        "INTERNAL_SERVER_ERROR",
      );
    },
  );
});

test("classifies an unavailable LLVM service", async () => {
  const server = createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const unavailableUrl = `http://127.0.0.1:${address.port}`;
  await new Promise((resolve, reject) =>
    server.close((error) => (error === undefined ? resolve() : reject(error))),
  );

  await assertTrpcError(
    () =>
      callLlvmService({
        serviceUrl: unavailableUrl,
        endpoint: "compile",
        body: { source: "int main(void) { return 0; }" },
        timeoutMs: 1_000,
      }),
    "SERVICE_UNAVAILABLE",
  );
});

test("classifies an LLVM optimisation request timeout", async () => {
  await withServer(
    (_request, response) => {
      setTimeout(() => response.end('{"ir":"late"}'), 100);
    },
    async (serviceUrl) => {
      await assertTrpcError(
        () =>
          callLlvmService({
            serviceUrl,
            endpoint: "optimise-structured",
            body: {
              ir: "define i32 @main() { ret i32 0 }",
              filename: "input.c",
            },
            timeoutMs: 10,
          }),
        "TIMEOUT",
      );
    },
  );
});
