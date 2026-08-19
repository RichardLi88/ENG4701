int compiler_case_with_a_deliberately_long_name_for_ir_boundary_testing(
    int first, int second, int third, int fourth, int fifth, int sixth,
    int seventh, int eighth, int ninth, int tenth, int eleventh, int twelfth,
    int thirteenth, int fourteenth, int fifteenth, int sixteenth) {
  return first + second + third + fourth + fifth + sixth + seventh + eighth +
         ninth + tenth + eleventh + twelfth + thirteenth + fourteenth +
         fifteenth + sixteenth;
}

int special_function(int value) __asm__("special.function-$case");

int special_function(int value) {
  return compiler_case_with_a_deliberately_long_name_for_ir_boundary_testing(
      value, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16);
}

int main(void) {
  return special_function(1);
}
