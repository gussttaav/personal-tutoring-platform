#include <stdio.h>
#include <stdlib.h>
#include <string.h>

typedef struct { int *datos; size_t len, cap; } Vector;

/* Appends x; if it doesn't fit, asks for a block twice as big. */
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
    char *nombre = strdup("serie");          /* another allocation, right behind the vector */

    int *primero = &v.datos[0];
    push(&v, 5);
    printf("%s: primero = %d\n", nombre, *primero);
}
