/* Tail-recursive: the recursive call is the last thing the function does.
   One optimisation level turns this into a loop; the other leaves the
   recursion in place. */
int sumTo(int n, int acc) {
    if (n <= 0) {
        return acc;
    }
    return sumTo(n - 1, acc + n);
}
