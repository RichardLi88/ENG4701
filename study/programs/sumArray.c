/* Sums an array the optimiser cannot fold away, because the values
   are only known at run time. A candidate for vectorisation. */
int sumArray(int *data, int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += data[i];
    }
    return total;
}
