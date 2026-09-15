/* The loop runs, but nothing it computes is ever read: the function
   always returns the same constant regardless of n. */
int deadLoop(int n) {
    int scratch = 0;
    for (int i = 0; i < n; i++) {
        scratch += i * 3;
    }
    return 7;
}
