/* Folds the numbers n, n-1, ... 1 into a single running value.
   The function calls itself, and the call is the last thing it does. */
int combine(int n, int acc) {
    if (n <= 0) {
        return acc;
    }
    return combine(n - 1, acc * 31 + n);
}
