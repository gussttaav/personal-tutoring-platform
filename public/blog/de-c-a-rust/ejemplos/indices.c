/* Suma v[idx[i]] para 16 millones de índices al azar sobre una tabla (4096 enteros, que
   caben en la caché, o los que diga el primer argumento), y la suma seguida de un vector
   de 16 millones. Mediana de 21 repeticiones, en milisegundos. */
#define _POSIX_C_SOURCE 200809L
#include <stdint.h>
#include <stdio.h>
#include <stdlib.h>
#include <time.h>

#define N (1u << 24)
#define REPS 21

static double ms(void) {
    struct timespec t;
    clock_gettime(CLOCK_MONOTONIC, &t);
    return t.tv_sec * 1e3 + t.tv_nsec / 1e6;
}

static int cmp(const void *a, const void *b) {
    double x = *(const double *)a, y = *(const double *)b;
    return (x > y) - (x < y);
}

__attribute__((noinline)) uint64_t salteada(const uint32_t *tabla, const uint32_t *idx, size_t n) {
    uint64_t s = 0;
    for (size_t i = 0; i < n; i++) s += tabla[idx[i]];
    return s;
}

__attribute__((noinline)) uint64_t seguida(const uint32_t *v, size_t n) {
    uint64_t s = 0;
    for (size_t i = 0; i < n; i++) s += v[i];
    return s;
}

int main(int argc, char **argv) {
    size_t tam = argc > 1 ? strtoul(argv[1], NULL, 10) : 4096;
    uint32_t *tabla = malloc(tam * sizeof *tabla);
    uint32_t *idx = malloc(N * sizeof *idx);
    uint32_t *v = malloc(N * sizeof *v);
    for (size_t i = 0; i < tam; i++) tabla[i] = i;
    uint64_t x = 42;
    for (uint32_t i = 0; i < N; i++) {  /* xorshift: los mismos índices que indices.rs */
        x ^= x << 13; x ^= x >> 7; x ^= x << 17;
        idx[i] = (uint32_t)(x % tam);
        v[i] = i;
    }

    double t[REPS];
    uint64_t s1 = 0, s2 = 0;
    for (int r = 0; r < REPS; r++) { double a = ms(); s1 = salteada(tabla, idx, N); t[r] = ms() - a; }
    qsort(t, REPS, sizeof *t, cmp);
    printf("salteada: %6.1f ms\n", t[REPS / 2]);
    for (int r = 0; r < REPS; r++) { double a = ms(); s2 = seguida(v, N); t[r] = ms() - a; }
    qsort(t, REPS, sizeof *t, cmp);
    printf("seguida:  %6.1f ms\n", t[REPS / 2]);
    printf("(sumas: %llu %llu)\n", (unsigned long long)s1, (unsigned long long)s2);
}
