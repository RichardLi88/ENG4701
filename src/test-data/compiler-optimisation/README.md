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
- `invalid.json`: intentionally invalid because `schemaVersion` is missing and `passes[0].order` is a string.

The optional values in `multi-function.json` describe only the explicit hand-written IR in that fixture. Other fixtures omit unavailable optional data instead of supplying placeholders.

Run `npm run test:optimisation-schema` and `npm run test:optimisation-adapter`
from the repository root to validate the fixtures, protocol boundary cases and
UI View Model conversion.
