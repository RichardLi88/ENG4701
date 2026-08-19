# Compiler optimisation fixtures

- `minimal.json`: one function and one changed transformation, containing only required fields.
- `multi-function.json`: module, function, loop and unknown scopes across two functions; covers analysis, changed/unchanged transformations, the `unknown` compatibility value, and optional metrics, CFG, transformation and dependency data.
- `unchanged-pass.json`: an unchanged transformation whose before and after IR are identical.
- `partial-data.json`: a valid payload with every optional function and Pass block omitted.
- `empty-passes.json`: one function with no associated Passes.
- `empty-functions.json`: no functions and no Passes.
- `long-content.json`: deliberately long names, signature, source path and IR lines for overflow testing.
- `many-passes.ts`: generated 60-Pass function with mixed types, scopes and change states for timeline scrolling and navigation testing.
- `real-backend.json`: sanitised LLVM 14 output captured through the real
  `/compile` and `/optimise` service endpoints. It preserves complete IR for
  four representative raw Pass events; raw log positions remain embedded in
  stable IDs. Metrics and other optional blocks are omitted because the
  backend did not provide them.
- `day2-real-backend.json`: complete Day 2 regression payload captured from
  `e2e-multi-function.c` through the local LLVM 14 `/compile` and
  `/optimise-structured` endpoints. It contains the full paired pass stream
  after temporary paths are sanitised.
- `day3-special-name-backend.json`: complete Day 3 boundary payload captured
  from `day3-special-function.c`. It covers a quoted LLVM function symbol, a
  long function signature, a response larger than 400,000 characters, and
  both changed and unchanged Passes without temporary paths or UUIDs.
- `day3-basic.c`, `day3-control-flow.c`, `day3-special-function.c`, and
  `day3-operators.cpp`: stable real-service success cases used by
  `npm run test:day3-real-cases` together with `e2e-multi-function.c`.
- `invalid.json`: intentionally invalid because `schemaVersion` is missing and `passes[0].order` is a string.

The optional values in `multi-function.json` describe only the explicit hand-written IR in that fixture. Other fixtures omit unavailable optional data instead of supplying placeholders.

Run `npm run test:optimisation-schema`, `npm run test:optimisation-adapter`, and
`npm run test:real-backend-payload` from the repository root to validate the
fixtures, protocol boundary cases and UI View Model conversion. With the local
LLVM service running, use `npm run test:day3-real-cases` to repeat the five
real compilation and optimisation cases. Use
`npm run test:day3-failure-cases` for the live empty input, C/C++ syntax,
filename, malformed JSON, and unsupported Schema version boundaries; the
HTTP client timeout and unavailable-service cases are covered by
`npm run test:llvm-service-client`.
