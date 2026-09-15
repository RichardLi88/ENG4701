/* The loop does work, but nothing ever reads scratch:
   the function always returns 7 whatever n is. */
int deadLoop(int n) {
    int scratch = 0;
    for (int i = 0; i < n; i++) {
        scratch += i * 3;
    }
    return 7;
}
