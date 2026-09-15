/* Multiplies every number in an array by the same factor, in place. */
void scaleArray(int *data, int n, int factor) {
    for (int i = 0; i < n; i++) {
        data[i] = data[i] * factor;
    }
}
