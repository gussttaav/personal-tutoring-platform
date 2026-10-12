#include <limits.h>
#include <stdio.h>
#include <stdlib.h>

/* Can y (positive) be added to x without going past the maximum of an int? */
int cabe(int x, int y) {
    return x + y > x;
}

int main(int argc, char **argv) {
    int y = argc > 1 ? atoi(argv[1]) : 1;
    printf("cabe(INT_MAX, %d) = %d\n", y, cabe(INT_MAX, y));
}
