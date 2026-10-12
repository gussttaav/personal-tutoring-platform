#include <limits.h>
#include <stdckdint.h>
#include <stdio.h>
#include <stdlib.h>

/* C23: ckd_add hace la suma y dice si se ha desbordado. */
int cabe(int x, int y) {
    int suma;
    return !ckd_add(&suma, x, y);
}

int main(int argc, char **argv) {
    int y = argc > 1 ? atoi(argv[1]) : 1;
    printf("cabe(INT_MAX, %d) = %d\n", y, cabe(INT_MAX, y));
}
