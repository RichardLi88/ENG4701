/* Tail-recursive sum of 1..n: the recursive call is the last thing the
   function does, and the running total is carried in acc.
   The two optimisation levels treat this very differently. */
int sumTo(int n, int acc) {
    if (n <= 0) {
        return acc;
    }
    return sumTo(n - 1, acc + n);
}
