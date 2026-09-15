/* Multiplies every element of an array in place. Independent iterations,
   so the optimiser may widen the loop to work on several at once. */
void scaleArray(int *data, int n, int factor) {
    for (int i = 0; i < n; i++) {
        data[i] = data[i] * factor;
    }
}
