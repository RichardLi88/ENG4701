import {
  EVIDENCE_MAX_CHARS,
  EVIDENCE_PACK_VERSION,
  type EvidencePack,
} from "./schema/evidence.ts";
import { createAiError, type AiError } from "./errors.ts";
import type { ExplainInput } from "./schema/evidence-input.ts";

export type BuildEvidenceResult =
  | Readonly<{ ok: true; data: EvidencePack }>
  | Readonly<{ ok: false; error: AiError }>;

const UNSPECIFIED_REDUCER = "unspecified reducer";

export function buildEvidencePack(input: ExplainInput): BuildEvidenceResult {
  const pack = toPack(input);
  const size = JSON.stringify(pack).length;

  if (size > EVIDENCE_MAX_CHARS) {
    return {
      ok: false,
      error: createAiError(
        "evidence-too-large",
        `Evidence is ${size} characters, over the ${EVIDENCE_MAX_CHARS} limit.`,
      ),
    };
  }

  return { ok: true, data: pack };
}

function toPack(input: ExplainInput): EvidencePack {
  if (input.domain === "compiler-optimisation") {
    const { pass } = input;
    return {
      packVersion: EVIDENCE_PACK_VERSION,
      domain: "compiler-optimisation",
      subject: { id: pass.id, label: pass.name, scope: pass.scope },
      transformation: pass.transformation,
      code: { before: pass.ir.before, after: pass.ir.after, patch: null },
      metrics: pass.metrics,
    };
  }

  const { candidate } = input;
  return {
    packVersion: EVIDENCE_PACK_VERSION,
    domain: "program-reduction",
    subject: {
      id: candidate.candidateId,
      label: candidate.transformationKind,
      scope: candidate.reducer ?? UNSPECIFIED_REDUCER,
    },
    transformation: {
      category: candidate.transformationKind,
      summary: candidate.description,
    },
    code: {
      before: candidate.before,
      after: candidate.after,
      patch: candidate.patch,
    },
    metrics: [
      {
        key: "tokens",
        before: candidate.tokensBefore,
        after: candidate.tokensAfter,
        delta: candidate.tokensAfter - candidate.tokensBefore,
        estimated: false,
      },
    ],
  };
}
