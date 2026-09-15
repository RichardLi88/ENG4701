/**
 * A run of adjacent Diff rows. Collapsed runs are long stretches that changed
 * nothing, which otherwise force a reader to scan dozens of identical lines to
 * find the few that moved.
 */
export type DiffSegment<T> = Readonly<{
  kind: "visible" | "collapsed";
  items: ReadonlyArray<T>;
}>;

export type FoldUnchangedOptions = Readonly<{
  /** Unchanged rows kept either side of a change, to preserve context. */
  context?: number;
  /** Shorter runs stay visible; folding them would save nothing. */
  minimumRunToFold?: number;
}>;

const DEFAULT_CONTEXT = 3;
const DEFAULT_MINIMUM_RUN = 8;

export function foldUnchangedRuns<T>(
  items: ReadonlyArray<T>,
  isUnchanged: (item: T) => boolean,
  options: FoldUnchangedOptions = {},
): ReadonlyArray<DiffSegment<T>> {
  const context = options.context ?? DEFAULT_CONTEXT;
  const minimumRun = options.minimumRunToFold ?? DEFAULT_MINIMUM_RUN;

  if (items.length === 0) return [];

  const changedIndices = items
    .map((item, index) => (isUnchanged(item) ? -1 : index))
    .filter((index) => index >= 0);

  // Nothing changed: never fold the whole thing away, leaving an empty view.
  if (changedIndices.length === 0) {
    return [{ kind: "visible", items }];
  }

  const keep = new Array<boolean>(items.length).fill(false);

  for (const index of changedIndices) {
    const from = Math.max(0, index - context);
    const to = Math.min(items.length - 1, index + context);

    for (let position = from; position <= to; position += 1) {
      keep[position] = true;
    }
  }

  const segments: Array<DiffSegment<T>> = [];
  let runStart = 0;

  function pushRun(endExclusive: number) {
    if (endExclusive <= runStart) return;

    const run = items.slice(runStart, endExclusive);
    const collapsed = !keep[runStart] && run.length >= minimumRun;
    const previous = segments[segments.length - 1];

    // Keep the output canonical: a run too short to fold merges into the
    // visible segment beside it rather than splitting it in two.
    if (!collapsed && previous?.kind === "visible") {
      segments[segments.length - 1] = {
        kind: "visible",
        items: [...previous.items, ...run],
      };
      return;
    }

    segments.push({ kind: collapsed ? "collapsed" : "visible", items: run });
  }

  for (let index = 1; index <= items.length; index += 1) {
    if (index === items.length || keep[index] !== keep[runStart]) {
      pushRun(index);
      runStart = index;
    }
  }

  return segments;
}
