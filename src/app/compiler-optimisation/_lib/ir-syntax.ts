/**
 * Splits a line of LLVM IR into what describes the program and what does not.
 *
 * A reader who cannot read IR spends most of their attention on tokens that say
 * nothing about the program: module boilerplate, attribute groups, type
 * annotations and optimiser flags. Marking those as muted lets the view dim
 * them so the remaining text reads closer to pseudocode. Nothing is removed or
 * rewritten - every character of the original line is returned exactly once, in
 * order - because this text is evidence.
 */
export type IrSpan = Readonly<{ text: string; muted: boolean }>;

/** Lines that are entirely module or metadata bookkeeping. */
const BOILERPLATE_LINE =
  /^\s*(?:;\s*ModuleID|source_filename\s*=|target\s+(?:datalayout|triple)\s*=|;\s*Function\s+Attrs:|attributes\s+#\d+\s*=|![A-Za-z0-9_.]*\s*=|![A-Za-z0-9_.]+\s*=\s*!)/;

/**
 * Noise inside an otherwise meaningful line. Ordered so that longer, more
 * specific patterns match before the shorter ones they contain.
 */
const NOISE_TOKEN = new RegExp(
  [
    // trailing provenance comment on a block label, e.g. "; preds = %1"
    /;\s*preds\s*=.*$/.source,
    // metadata attachments, e.g. "!tbaa !5" or "!llvm.loop !6"
    /![A-Za-z0-9_.]+(?:\s+![A-Za-z0-9_.]+)?/.source,
    // attribute group reference, e.g. "#0"
    /#\d+/.source,
    // alignment and vector/array type syntax
    /\balign\s+\d+/.source,
    /<\s*\d+\s+x\s+[^>]+>/.source,
    /\[\s*\d+\s+x\s+[^\]]+\]/.source,
    // primitive types, including pointer suffixes
    /\b(?:void|half|float|double|fp128|x86_fp80|ppc_fp128|i\d+)\*{0,4}(?![\w.])/
      .source,
    // linkage, parameter and optimiser flags that do not change what is computed
    /\b(?:dso_local|local_unnamed_addr|unnamed_addr|noundef|nsw|nuw|exact|inbounds|zeroext|signext|nonnull|dereferenceable\(\d+\)|immarg|willreturn|nocapture|readnone|readonly|writeonly|speculatable|mustprogress|nofree|norecurse|nosync|nounwind|uwtable|internal|private|constant|label)(?![\w.])/
      .source,
  ].join("|"),
  "g",
);

export function splitIrLine(line: string): ReadonlyArray<IrSpan> {
  if (line.length === 0) return [];
  if (BOILERPLATE_LINE.test(line)) return [{ text: line, muted: true }];

  const spans: Array<IrSpan> = [];
  let cursor = 0;

  NOISE_TOKEN.lastIndex = 0;
  for (
    let match = NOISE_TOKEN.exec(line);
    match !== null;
    match = NOISE_TOKEN.exec(line)
  ) {
    if (match.index > cursor) {
      spans.push({ text: line.slice(cursor, match.index), muted: false });
    }
    spans.push({ text: match[0], muted: true });
    cursor = match.index + match[0].length;
  }

  if (cursor < line.length) {
    spans.push({ text: line.slice(cursor), muted: false });
  }

  return spans;
}
