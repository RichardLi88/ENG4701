/* Most of the work here is never observed: only the last assignment
   to result reaches the return statement. */
int pick(int flag) {
    int result = 0;
    int unused = 1234;
    result = 11;
    unused = unused * 2;
    result = 22;
    result = 33;
    return result;
}
