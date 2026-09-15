/* Sums 0..n-1 with an explicit loop.
   The optimiser recognises the closed form and removes the loop. */
int accumulate(int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += i;
    }
    return total;
}
