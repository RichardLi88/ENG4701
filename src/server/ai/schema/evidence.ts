export const EVIDENCE_PACK_VERSION = "1" as const;

export type EvidenceDomain = "compiler-optimisation" | "program-reduction";

export type EvidenceMetric = Readonly<{
  key: string;
  before: number;
  after: number;
  delta: number;
  estimated: boolean;
}>;

export type EvidenceTransformation = Readonly<{
  category: string;
  summary: string;
}>;

export type EvidencePack = Readonly<{
  packVersion: string;
  domain: EvidenceDomain;
  subject: Readonly<{ id: string; label: string; scope: string }>;
  transformation: EvidenceTransformation | null;
  code: Readonly<{
    before: string;
    after: string | null;
    patch: string | null;
  }>;
  metrics: ReadonlyArray<EvidenceMetric>;
}>;

export const EVIDENCE_MAX_CHARS = 24_000;
