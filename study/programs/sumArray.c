/* Adds up the numbers in an array. The values are only known when the
   program runs, so the total cannot be worked out in advance. */
int sumArray(int *data, int n) {
    int total = 0;
    for (int i = 0; i < n; i++) {
        total += data[i];
    }
    return total;
}
