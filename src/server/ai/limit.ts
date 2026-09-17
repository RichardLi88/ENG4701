// Small single-process research service; not a distributed production limiter.
export function createRequestGate(
  limit = 12,
  concurrency = 2,
  windowMs = 60_000,
) {
  let starts: number[] = [];
  let active = 0;
  return (now = Date.now()): (() => void) | null => {
    starts = starts.filter((start) => now - start < windowMs);
    if (starts.length >= limit || active >= concurrency) return null;
    starts.push(now);
    active++;
    let released = false;
    return () => {
      if (!released) {
        active--;
        released = true;
      }
    };
  };
}
export const acquireRequest = createRequestGate();
