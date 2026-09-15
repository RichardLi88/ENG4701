/* A doubly nested loop over a fixed inner bound. The inner loop has a
   small constant trip count, so it can be unrolled or collapsed. */
int nestedSum(int *data, int rows) {
    int total = 0;
    for (int r = 0; r < rows; r++) {
        for (int c = 0; c < 4; c++) {
            total += data[r * 4 + c];
        }
    }
    return total;
}
