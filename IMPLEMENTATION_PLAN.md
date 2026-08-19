# Perses Reduction Visualizer Implementation Plan

## 1. Goal and acceptance criteria

Build a local, static web application in the separate visualizer repository that opens a Perses JSONL trace and shows every attempted candidate as a source-code diff against the exact baseline revision from which it was created. Do not add the visualizer implementation to the Perses repository.

The first release is complete when a user can:

- drag and drop, or select, a `.jsonl` trace without uploading it anywhere;
- browse candidates in trace order and filter them by passed, failed, cache-rejected, cancelled, and committed state;
- distinguish a property-test pass from a candidate that Perses actually committed;
- view the baseline and candidate as a unified line diff for each affected file;
- switch to a token view that highlights removed and added Perses token lexemes;
- move between committed revisions and see the candidate that produced each revision;
- load a partially malformed trace and receive useful line-numbered diagnostics while valid records remain available;
- handle large traces without reading the entire file into a single string or rendering every candidate simultaneously.

The visualizer must not execute trace content, contact a backend, or send source code over the network.

## 2. JSONL contract

Treat the JSONL producer as a versioned external interface. Put its TypeScript representation and validation in `src/trace/`; UI components must consume the normalized model rather than raw JSON objects.

Every non-blank line is one JSON object with these common fields:

```ts
interface TraceEventBase {
  schemaVersion: 1;
  sequence: number;
  timestampMillis: number;
  type: string;
}

interface SourceSnapshot {
  files: Array<{ path: string; content: string }>;
  tokens: Array<{ index: number; text: string }>;
  tokenCount: number;
}

interface EditMetadata {
  kind:
    | "NODE_DELETION"
    | "DESCENDANT_HOISTING"
    | "ANY_NODE_REPLACEMENT"
    | "LATRA_GENERAL";
  description: string;
  actions: Array<
    | { kind: "DELETE"; description: string; targetNodeId: number }
    | {
        kind: "REPLACE";
        description: string;
        targetNodeId: number;
        replacementNodeId: number;
      }
  >;
}
```

Support the following version-1 events:

- `run_started`: `initialRevision: 0` plus the initial `SourceSnapshot`.
- `candidate_tested`: `candidateId`, `baseRevision`, `result: "pass" | "fail"`, `exitCode`, `elapsedMillis`, `edit`, plus the candidate `SourceSnapshot`.
- `candidate_cache_hit`: `candidateId`, `baseRevision`, `result: "fail"`, `edit`, plus the candidate `SourceSnapshot`. A Perses query-cache hit represents a previously known uninteresting candidate.
- `candidate_cancelled`: `candidateId`, `baseRevision`, `cancelDurationMillis`, `edit`, plus the candidate `SourceSnapshot`.
- `candidate_committed`: `candidateId`, `baseRevision`, `newRevision`, `beforeTokenCount`, `afterTokenCount`, `edit`, plus the committed `SourceSnapshot`. The candidate may have no preceding test event when Perses applies an internal or heuristic edit.
- `error`: `exceptionClass`, nullable `message`, and `stackTrace`. Display it as a run diagnostic while continuing to parse later records.
- `run_finished`: `finalRevision`, `finalTokenCount`, `testExecutionCount`, and `externalCacheHitCount`.

Use `candidateId` only for identity and `baseRevision`/`newRevision` only for state reconstruction. Never infer a commit from a passing result or matching token count.
Perses emits candidate IDs as opaque strings, zero-based sequences, contiguous revisions, and token indices matching array positions. A file `path` is the name emitted by Perses and is not guaranteed to retain an original nested directory.

Parser compatibility rules:

- Reject unsupported `schemaVersion` values with a file-level error; do not silently reinterpret them.
- Ignore unknown event types with a warning so newer optional events do not break the version-1 viewer.
- Require one `run_started` before candidate events. If multiple `run_started` records occur, split the file into separately selectable runs.
- Validate unique `sequence` values and display events in ascending sequence order.
- Validate unique candidate IDs within a run, except that a commit is expected to reference an existing candidate ID.
- Allow commits without a previous candidate event and synthesize a candidate entry labelled `internal commit` from the commit snapshot.
- Preserve source strings exactly, including blank lines, Unicode, and final-newline state.
- Treat `files` as an ordered array, but index normalized snapshots by `path`; reject duplicate paths within one snapshot.

Keep the Perses producer, contract types, fixture, and this section synchronized. Do not scatter compatibility conditionals through components.

## 3. Application structure and implementation

Initialize the separate repository as a standalone React + TypeScript application using Vite. Use npm and commit `package-lock.json` for reproducible installs. Add Vitest, React Testing Library, ESLint, and Prettier. Use the `diff` package for line-level comparisons; implement token-sequence comparison through the same package's array diff API or a small tested Myers/LCS adapter if the installed API cannot compare arrays.

Organize the code by responsibility:

```text
src/
  trace/       JSONL streaming, runtime validation, normalized run model
  diff/        line and token diff calculation
  components/  file loader, candidate list, filters, diff and diagnostics views
  fixtures/    small checked-in version-1 trace
  App.tsx
README.md
```

### Trace loading and normalization

- Read `File.stream()` incrementally with `TextDecoderStream`, retaining only an incomplete trailing line between chunks. Do not use `File.text()`.
- Parse and validate each complete line independently. Record diagnostics as `{ severity, lineNumber, message }` and continue after record-level JSON or validation failures.
- Build one normalized `ReductionRun` at a time containing:
  - ordered candidate summaries;
  - candidates indexed by ID;
  - revision snapshots indexed by revision number;
  - commit relationships indexed by candidate and revision;
  - run statistics and diagnostics.
- Keep full source snapshots in the model, but compute diffs lazily only for the selected candidate. Cache computed diffs by `(baseRevision, candidateId, filePath, mode)`.
- Process parsing in batches and yield to the browser between batches so progress can update and the page remains responsive. Show parsed bytes, event count, and diagnostic count while loading.
- Provide a cancel button backed by `AbortController`; cancelling discards the incomplete run and returns to the file picker.

### Candidate and revision semantics

- A candidate's test status and commit status are independent fields:
  - `pass + committed` means the property held and Perses selected it;
  - `pass + not committed` means it was interesting but was not selected;
  - `fail`, `cache-rejected`, and `cancelled` are never displayed as committed unless the input trace explicitly contains a conflicting commit, in which case show an error diagnostic;
  - `internal commit` is committed without a recorded test result.
- Resolve a candidate baseline strictly from `baseRevision`. Missing baselines disable its diff and produce a diagnostic rather than falling back to the previous event.
- On `candidate_committed`, store the included snapshot as `newRevision` and verify its token count against `afterTokenCount`.
- Do not assume revision numbers or candidate IDs are contiguous.

### Diff calculation

- Compare the baseline file map with the candidate file map. A missing candidate file is a full-file deletion; a new path is a full-file addition.
- Generate a unified line model preserving newline delimiters and final-newline differences. Use zero context folding only after correctness is established; the default view shows three unchanged context lines around changes with an option to expand hidden regions.
- Render removed lines in red, added lines in green, and unchanged context neutrally. Include old/new line numbers and accessible non-colour markers (`-`, `+`, and status labels).
- The token view compares the emitted baseline and candidate `tokens` arrays by `text`, preserving duplicate lexemes and their order. Render deleted tokens red and inserted tokens green; provide whitespace-visible rendering for spaces, tabs, and newlines if such lexemes appear.
- Label token positions by their sequence indices in the relevant snapshot. Do not project token indices onto source lines unless the producer later supplies reliable rendered line/column mappings.
- Compute a per-candidate summary: changed files, removed/added lines, and removed/added tokens.

### User interface

Use a three-region layout:

1. A top bar with file name, run selector, parse status, total candidates, commits, and a button to open another trace.
2. A left candidate panel with search and status filters. Each row shows sequence, candidate ID, test status, commit badge, token-count change, elapsed time when available, and edit kind.
3. A main detail panel with candidate metadata, file tabs, `Lines`/`Tokens` view toggle, diff content, and previous/next candidate controls.

Default selection and filtering behavior:

- Select the first candidate after a trace loads.
- Show all statuses initially.
- Search candidate ID, edit kind, action description, and file path.
- Preserve the current selection when filters still contain it; otherwise select the first visible result.
- Add keyboard navigation: `j`/`k` for next/previous candidate and `[`/`]` for previous/next changed file, except while focus is in an input.

Provide explicit empty/error states for no candidates, no changed files, unsupported schema, missing baseline, and a file containing no valid JSONL records. Put warnings and recoverable parser errors in a collapsible diagnostics drawer.

Use plain CSS or CSS modules; do not introduce a component framework. Keep source lines selectable and horizontally scrollable, and use semantic buttons, labels, focus states, and sufficient contrast.

### Documentation and repository integration

- Document setup and commands in the visualizer repository's `README.md`: `npm install`, `npm run dev`, `npm test`, `npm run lint`, and `npm run build`.
- Document that `dist/` is generated and must not be committed.
- Include a production usage example that generates a trace with Perses and opens it through the visualizer's file picker.
- Keep the visualizer repository independent of Perses and Bazel. Its CI should invoke npm directly and must not modify or depend on the Perses source tree.

## 4. Testing and verification

Add a compact fixture containing an initial revision and at least these cases: failed deletion, passing but uncommitted deletion, passing and committed deletion, cache hit, cancellation, internal commit, multiple files, blank lines, repeated token lexemes, and a final newline change.

Unit tests:

- streaming JSONL parser handles chunk boundaries inside JSON strings, LF/CRLF, a final line without newline, blank lines, Unicode, and malformed records;
- schema validation rejects missing required fields, duplicate file paths, unsupported versions, and invalid status values;
- normalization links test and commit events by candidate ID, creates revisions correctly, separates multiple runs, and reports missing references;
- line diff handles additions, deletions, replacements, complete-file changes, blank lines, and final-newline differences;
- token diff correctly handles repeated lexemes and reports stable before/after indices;
- filters and search return the expected candidate set.

Component tests:

- file selection shows loading progress and then selects the first candidate;
- passed and committed badges are rendered independently;
- selecting a candidate uses its declared base revision rather than the preceding candidate;
- switching files and line/token modes changes the rendered diff;
- malformed records appear in diagnostics without hiding valid candidates;
- keyboard navigation does not trigger while typing in search.

Run before handoff:

```bash
npm install
npm run lint
npm test -- --run
npm run build
```

Manually verify the production build with the checked-in fixture and at least one real Perses trace. Confirm that no network requests occur in browser developer tools and that a large trace remains interactive during parsing and candidate navigation.

## 5. Delivery order

Implement in these independently verifiable increments:

1. Scaffold Vite/React/TypeScript, scripts, linting, tests, and the fixture.
2. Implement versioned event types, runtime validation, streaming JSONL parsing, diagnostics, and normalized revision/candidate state.
3. Implement and unit-test line and token diff models.
4. Build the file loader, candidate filters/list, metadata panel, file tabs, and diff views.
5. Add loading cancellation, batching, lazy diff caching, keyboard/accessibility behavior, and large-trace checks.
6. Add documentation and CI commands in the visualizer repository; run all verification commands and record any remaining limitations.

## 6. Assumptions and non-goals

- The JSONL producer emits complete candidate and commit snapshots and stable candidate/revision identifiers according to the version-1 contract above.
- Changes to Perses or its JSONL producer are outside the visualizer repository's implementation scope. Report contract mismatches rather than patching Perses from the visualizer project.
- The browser has enough memory to retain trace snapshots; streaming prevents a large temporary input string but does not make retained source snapshots free. Deduplication or IndexedDB storage is deferred until real traces demonstrate a need.
- Version 1 is a read-only, single-user, local visualizer. It will not run Perses, edit source, replay reductions, compare multiple trace files, or provide a hosted backend.
- Syntax highlighting is deferred. Correct diff reconstruction, exact source preservation, trace diagnostics, and responsiveness take priority.
- Token view shows sequence-level changes. Mapping tokens onto rendered source coordinates is deferred until the producer supplies positions relative to each emitted snapshot.
- The app supports current evergreen desktop browsers with `File.stream()`, `TextDecoderStream`, and ES modules.
