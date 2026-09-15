/* Adds up 0, 1, 2, ... n-1 one step at a time. */
int accumulate(int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += i;
    }
    return total;
}
