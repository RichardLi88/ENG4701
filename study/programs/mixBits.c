/* Tail-recursive like sumTo, but combining bits instead of summing, so the
   same structural question can be asked without reusing the same program.
   One optimisation level turns the recursion into a loop; the other does not. */
int mixBits(int n, int acc) {
    if (n <= 0) {
        return acc;
    }
    return mixBits(n - 1, (acc ^ n) + (acc >> 1));
}
