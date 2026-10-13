#include <limits.h>
#include <stdio.h>
#include <stdlib.h>

/* ¿Se puede sumar y (positivo) a x sin pasarse del máximo de un int? */
int cabe(int x, int y) {
    return x + y > x;
}

int main(int argc, char **argv) {
    int y = argc > 1 ? atoi(argv[1]) : 1;
    printf("cabe(INT_MAX, %d) = %d\n", y, cabe(INT_MAX, y));
}
