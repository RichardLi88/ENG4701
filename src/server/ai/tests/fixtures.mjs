export const llvm = {
  domain: "compiler-optimisation",
  traceVersion: "1.1.0",
  toolVersion: "14.0.0",
  sourceFile: "gcd.c",
  subject: { id: "p1", name: "SROAPass", scope: "function gcd" },
  before: "before",
  after: "after",
  patch: null,
  metrics: [
    { key: "instructions", before: 20, after: 8, delta: -12, estimated: false },
  ],
  llvm: {
    type: "transform",
    changed: true,
    optimisationLevel: "O1",
    analysisActivity: { computed: [], preservation: "not-all" },
  },
  reduction: null,
};
export const reduction = {
  ...llvm,
  domain: "program-reduction",
  traceVersion: "2.0.0",
  toolVersion: null,
  subject: { id: "candidate:1", name: "DELETE", scope: "s0" },
  llvm: null,
  metrics: [
    { key: "tokens", before: 20, after: 8, delta: -12, estimated: false },
  ],
  reduction: {
    status: "REJECTED",
    accepted: false,
    exitCode: 1,
    testScript: "test.sh",
    testDescription: null,
    description: "Attempted deletion",
    reducer: "test reducer",
  },
};
const statement = (text, evidenceIds) => ({ text, evidenceIds });
export const output = {
  generalPurpose: [statement("SROA promotes eligible allocations.", ["K2"])],
  observedChanges: [statement("Instruction count falls by 12.", ["E3"])],
  conclusions: [statement("The input changed.", ["E1", "E2"])],
  limitations: [statement("Runtime was not measured.", ["E3"])],
  metricClaims: [{ metric: "instructions", claimedDelta: -12 }],
};
export function providerBody(explanation = output, overrides = {}) {
  return {
    id: "response-test",
    status: "completed",
    model: "gpt-5.6-luna",
    output: [
      {
        type: "message",
        content: [{ type: "output_text", text: JSON.stringify(explanation) }],
      },
    ],
    usage: { input_tokens: 100, output_tokens: 50 },
    ...overrides,
  };
}
