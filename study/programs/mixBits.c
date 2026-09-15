/* Also tail-recursive, but combining bits rather than summing, so there is
   no closed form for the result. Matched to sumTo.c in shape and in the
   optimisation that applies, but it does not end up in the same place. */
int mixBits(int n, int acc) {
    if (n <= 0) {
        return acc;
    }
    return mixBits(n - 1, (acc ^ n) + (acc >> 1));
}
