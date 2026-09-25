export const aiMessages = {
  version:
    "No matching LLVM knowledge: this frozen catalogue supports LLVM 14.0.x. Regenerate the trace with tool-version metadata; no model request was sent.",
  schema:
    "No matching reduction trace knowledge. Expected trace schema 2.0.0; no model request was sent.",
  missingKey: "AI is not configured. Set OPENAI_API_KEY on the server.",
  busy: "The research service is busy or its request limit was reached. Please try again shortly.",
  timeout:
    "The model request timed out. Its completion and billing are uncertain; retry only if needed.",
  unavailable:
    "The model request failed. Check the server configuration or try again later.",
  invalid:
    "The response was incomplete, refused, or did not match the explanation format. Export the record to inspect it.",
  citations:
    "The response contained an unknown evidence reference. Export the record to inspect it.",
  model:
    "The provider returned a different model. The response was not accepted.",
} as const;
