/* Counts positive values. The branch inside the loop is a candidate
   for being turned into branch-free arithmetic. */
int countPositive(int *data, int n) {
    int count = 0;
    for (int i = 0; i < n; i++) {
        if (data[i] > 0) {
            count++;
        }
    }
    return count;
}
