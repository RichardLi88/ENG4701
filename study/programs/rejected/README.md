# Rejected candidates

Kept so the selection is reproducible rather than asserted.

- `countPositive.c`, `nestedSum.c`, `countDown.c` — all three diverge usefully between O1
  and O2, but every one vectorises at O2 and so triggers the metrics failure recorded as
  D1 in `study/study-materials.md`. The application cannot load them at O2, which makes
  them unusable for the tool condition. `nestedSum.c` fails at O1 as well, on 86 dumps.

Re-check with `python3 scripts/verify-trace.py check study/programs/rejected/<file> --level O2`.
