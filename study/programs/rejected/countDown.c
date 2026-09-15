/* Also tail-recursive, multiplying instead of adding, so the same
   structural question can be asked without reusing the same program. */
int countDown(int n, int product) {
    if (n <= 1) {
        return product;
    }
    return countDown(n - 1, product * n);
}
