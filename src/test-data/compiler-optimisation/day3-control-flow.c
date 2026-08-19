int greatest_common_divisor(int left, int right) {
  while (right != 0) {
    const int remainder = left % right;
    left = right;
    right = remainder;
  }

  return left;
}

int classify(int value) {
  if (value < 0) {
    return -1;
  }

  if (value == 0) {
    return 0;
  }

  return 1;
}

int main(void) {
  return greatest_common_divisor(84, 30) + classify(3);
}
