#include <stdio.h>
#include <string.h>

typedef struct { const char *nombre; int nota; } Alumno;

/* Returns the student with that name, or NULL if there isn't one. */
Alumno *buscar(Alumno *clase, size_t n, const char *nombre) {
    for (size_t i = 0; i < n; i++)
        if (strcmp(clase[i].nombre, nombre) == 0) return &clase[i];
    return NULL;
}

int main(void) {
    Alumno clase[] = {{"Ana", 9}, {"Luis", 6}, {"Sara", 8}};
    printf("Sara: %d\n", buscar(clase, 3, "Sara")->nota);
    printf("Marta: %d\n", buscar(clase, 3, "Marta")->nota);
}
