/* Every input is known at compile time, so the whole computation
   can be folded to a single constant. */
int compute(void) {
    int a = 6;
    int b = 7;
    int c = a * b;
    int d = c + 100;
    return d - 42;
}
