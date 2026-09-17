# Frozen research explanation feature

This feature explains one selected LLVM pass or reduction step on demand. It is
a research instrument, not an automated factuality evaluator. The application
uses `gpt-5.6-luna`, medium reasoning and trace + knowledge + grounding (D).
The existing four-condition RQ experiment and its archives are separate.

## Run

1. Set `OPENAI_API_KEY` in the application's ignored `.env.local` or deployment
   environment. No key is exposed to the browser. Without a key the visualiser
   still works and the explanation request reports a configuration error.
2. Rebuild the LLVM service with `dockerfile.llvm`: its structured endpoint now
   includes the actual `opt --version` in `meta.toolVersion`.
3. Start the existing services and `npm run dev`. Load a source file or a v2
   reduction trace, select a step, then choose **Explain this step**.
4. Use **Export research record** to retain the evidence, knowledge, exact
   prompt/request, raw response, settings, hashes, output, numeric checks and
   previous attempts. Exports contain source code and are user-controlled files.

## Frozen scope and evidence boundaries

- Release: `research-explanations-v1`. No model picker or strategy picker.
- LLVM 14.0.x uses LLVM 14.0.0 documentation as family-level background;
  patch-specific implementation behaviour is not asserted. Missing or other
  versions block generation instead of silently changing condition D.
- Specific entries: SROA, InstCombine, SimplifyCFG, DCE, ADCE, Mem2Reg, GVN,
  SCCP, Inline, LoopUnroll, LICM, Verifier and EarlyCSE. Other pass names receive
  explicitly scoped general LLVM pass/analysis background, not an invented
  pass-specific mechanism. Changed, unchanged and analysis steps are supported.
- Perses input is the project's strict `2.0.0` trace contract. Knowledge contains
  general reduction background from the ICSE 2018 paper plus the project trace
  contract. It does **not** claim version-specific Perses implementation facts.
  All existing transformation labels and candidate statuses remain evidence.
- Optional reduction metadata: `toolVersion` and `testDescription`; existing
  `testScript` is retained. A script path does not establish its tested property.
  Missing properties/versions are explicitly uncertain. Accepted steps preserve
  their associated candidate outcome and exit code when those are available;
  otherwise no successful test is inferred.
- Accepted steps and non-retained candidates are distinct, including rejected,
  invalid, cached, cancelled and untested attempts. Patch-only attempts never
  become invented complete after snapshots. System steps need not be tests.
- Trace files are user-supplied evidence, not independently authenticated facts.
  The input validator checks shape, size and core internal consistency.
- Static metric delta matching and reference-ID existence checks are mechanical
  checks only. They do not verify prose, causal explanations, citation entailment,
  completeness, semantic equivalence or runtime improvements. No confidence badge.
- Four output sections: general purpose, observed changes, conclusions and
  limitations. Each statement points to supplied evidence/reference IDs.

## Operational limits

No database, online retrieval, multi-turn chat or new dependencies are needed.
Responses API calls use structured JSON, `store: false`, no tools, an 8,000-token
output budget and a 180-second timeout. One application attempt is made per
click; no silent retries or content-based regeneration. A failed record is
exportable; an explicit retry produces a new record. A timeout does not prove
that the upstream request was cancelled or unbilled.

Each loaded trace has a browser-memory cache (32 step entries). Switching steps
keeps results associated with the complete evidence and release, including during
in-flight calls. Reloading or loading another trace clears this cache; export
before leaving. Completed responses cannot be regenerated from the same entry.

The server has a small process-local ceiling of 12 starts/minute and two concurrent
calls. It is suitable for this controlled research deployment, not a distributed
public service quota. The app sends no model response bodies to server logs.
Evidence is rejected above 100,000 characters per code field or 160,000 total;
there is no silent truncation of research inputs.

## Verification and research use

`npm run typecheck`, `npm run lint`, `npm test`, and `npm run test:ai` cover the
feature. The AI tests use mocked provider responses and synthetic reduction
fixtures; they establish software behaviour, not factual accuracy.

With the LLVM service and key configured,
`node --experimental-strip-types scripts/verify-ai.mjs --live` makes three paid
Luna requests for real GCD changed/unchanged SROA and an analysis pass. Each run
writes a new directory under ignored `tests/artifacts/ai/`. It never overwrites
historical RQ outputs. Inspect the explanations manually; passing schema and
metric checks does not constitute S/C/U annotation.

Synthetic Perses fixtures are labelled as engineering data. Actual Perses
research outcomes still require real traces and human review. Do not report
engineering smoke results as experimental accuracy.

After acceptance, freeze this release. Any necessary fix that changes prompts,
knowledge, evidence construction, model settings or output meaning must bump
`AI_RELEASE`; preserve earlier exported records. Existing experiments must not
be silently relabelled as evaluations of this product prompt.

## Attribution

The feature builds on Steven Kaing's `004113e` AI architecture, evidence-input
projection and optional workspace rendering hooks. The provider, evidence
contract, domain grounding, reference catalogue, trace provenance, export/cache
behaviour and verification were adapted for this research integration. This is
not a wholesale merge of the older AI branch over the current visualiser.

## Acceptance record — 17 September 2026

- Typecheck, lint and production build passed; 190 unit tests and 57 component
  tests passed. No added package dependencies or database migrations.
- Live LLVM 14.0.0 capture and Luna structured generation passed for GCD changed
  SROA, unchanged SROA and a module analysis/verifier step. Emitted metric deltas
  matched the supplied metrics. This is not a complete factuality score.
- Browser requests and record downloads worked for LLVM and for synthetic
  accepted/rejected reduction fixtures. Returning to an accepted step restored
  its cached result; automated tests also cover selection during an in-flight
  request. Light/dark and 390-pixel layouts were inspected without horizontal
  overflow in the explanation panel.
- Client bundles were checked for accidental inclusion of the configured API
  credential. The pre-existing lockfile changes and RQ archives were preserved.
- Manual smoke inspection identified and corrected domain terminology leakage
  in the shared prompt and an ambiguous snapshot/patch evidence label. Raw
  development outputs remain local; they are not formal RQ measurements.
- No real Perses research dataset was used in this acceptance run. The fixture
  explicitly identifies itself as synthetic. Source/reference presence checks
  do not establish that generated prose is completely correct.
