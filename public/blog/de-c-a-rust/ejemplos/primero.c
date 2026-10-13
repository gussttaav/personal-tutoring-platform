#include <stdio.h>
#include <stdlib.h>

typedef struct { int *datos; size_t len, cap; } Vector;

/* Añade x al final; si no cabe, pide un bloque el doble de grande. */
void push(Vector *v, int x) {
    if (v->len == v->cap) {
        v->cap = v->cap ? 2 * v->cap : 4;
        v->datos = realloc(v->datos, v->cap * sizeof *v->datos);
    }
    v->datos[v->len++] = x;
}

int main(void) {
    Vector v = {0};
    for (int i = 1; i <= 4; i++) push(&v, i);

    int *primero = &v.datos[0];
    push(&v, 5);
    printf("primero = %d\n", *primero);
}
