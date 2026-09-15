/* A `static` helper whose only caller is in the same translation unit. The
 * service strips clang's `noinline` attribute before `opt` runs, so the
 * requested pipeline is able to inline this call. */
static int scale(int value) { return value * 3; }

int compute(int input) { return scale(input) + 1; }

int main(void) { return compute(7); }
