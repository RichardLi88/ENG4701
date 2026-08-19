function normaliseLineEndings(value) {
  return value.replace(/\r\n?/g, "\n");
}

function splitLines(value) {
  const normalised = normaliseLineEndings(value);

  if (normalised.length === 0) {
    return [];
  }

  const lines = [];
  let start = 0;

  for (let index = 0; index < normalised.length; index += 1) {
    if (normalised[index] !== "\n") {
      continue;
    }

    lines.push({
      content: normalised.slice(start, index),
      endsWithNewline: true,
    });
    start = index + 1;
  }

  if (start < normalised.length) {
    lines.push({
      content: normalised.slice(start),
      endsWithNewline: false,
    });
  }

  return lines;
}

function linesEqual(left, right) {
  return (
    left !== undefined &&
    right !== undefined &&
    left.content === right.content &&
    left.endsWithNewline === right.endsWithNewline
  );
}

function backtrackEdits(trace, before, after) {
  const reversed = [];
  let x = before.length;
  let y = after.length;

  for (let distance = trace.length - 1; distance >= 0; distance -= 1) {
    const furthestX = trace[distance];
    const diagonal = x - y;
    const moveDown =
      diagonal === -distance ||
      (diagonal !== distance &&
        (furthestX.get(diagonal - 1) ?? -1) <
          (furthestX.get(diagonal + 1) ?? -1));
    const previousDiagonal = moveDown ? diagonal + 1 : diagonal - 1;
    const previousX = furthestX.get(previousDiagonal) ?? 0;
    const previousY = previousX - previousDiagonal;

    while (x > previousX && y > previousY) {
      reversed.push({ kind: "unchanged", line: before[x - 1] });
      x -= 1;
      y -= 1;
    }

    if (distance === 0) {
      break;
    }

    if (x === previousX) {
      reversed.push({ kind: "added", line: after[y - 1] });
      y -= 1;
    } else {
      reversed.push({ kind: "removed", line: before[x - 1] });
      x -= 1;
    }
  }

  return reversed.reverse();
}

/** Compute a shortest line-level edit script with Myers' diff algorithm. */
function computeEdits(before, after) {
  const maximumDistance = before.length + after.length;
  const trace = [];
  const furthestX = new Map([[1, 0]]);

  for (let distance = 0; distance <= maximumDistance; distance += 1) {
    trace.push(new Map(furthestX));

    for (let diagonal = -distance; diagonal <= distance; diagonal += 2) {
      const moveDown =
        diagonal === -distance ||
        (diagonal !== distance &&
          (furthestX.get(diagonal - 1) ?? -1) <
            (furthestX.get(diagonal + 1) ?? -1));
      let x = moveDown
        ? (furthestX.get(diagonal + 1) ?? 0)
        : (furthestX.get(diagonal - 1) ?? 0) + 1;
      let y = x - diagonal;

      while (x < before.length && y < after.length) {
        if (!linesEqual(before[x], after[y])) {
          break;
        }
        x += 1;
        y += 1;
      }

      furthestX.set(diagonal, x);

      if (x >= before.length && y >= after.length) {
        return backtrackEdits(trace, before, after);
      }
    }
  }

  return [];
}

function numberEdits(edits) {
  let beforeLineNumber = 1;
  let afterLineNumber = 1;

  return edits.map(({ kind, line }) => {
    const numberedLine = {
      kind,
      content: line.content,
      beforeLineNumber: kind === "added" ? null : beforeLineNumber,
      afterLineNumber: kind === "removed" ? null : afterLineNumber,
      endsWithNewline: line.endsWithNewline,
    };

    if (kind !== "added") {
      beforeLineNumber += 1;
    }
    if (kind !== "removed") {
      afterLineNumber += 1;
    }

    return numberedLine;
  });
}

function createStructuredDiff(before, after) {
  return numberEdits(computeEdits(splitLines(before), splitLines(after)));
}

module.exports = { createStructuredDiff };
