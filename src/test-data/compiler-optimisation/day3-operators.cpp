namespace arithmetic {
struct Number {
  int value;
};

Number operator+(Number left, Number right) {
  return Number{left.value + right.value};
}

template <int Factor>
int scale(Number number) {
  return number.value * Factor;
}
}  // namespace arithmetic

int main() {
  const arithmetic::Number total =
      arithmetic::Number{4} + arithmetic::Number{5};
  return arithmetic::scale<3>(total);
}
