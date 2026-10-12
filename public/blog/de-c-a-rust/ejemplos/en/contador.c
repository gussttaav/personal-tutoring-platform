#include <pthread.h>
#include <stdio.h>

long contador = 0;

void *sumar(void *arg) {
    (void)arg;
    for (int i = 0; i < 1000000; i++) contador++;
    return NULL;
}

int main(void) {
    pthread_t hilos[4];
    for (int i = 0; i < 4; i++) pthread_create(&hilos[i], NULL, sumar, NULL);
    for (int i = 0; i < 4; i++) pthread_join(hilos[i], NULL);
    printf("contador = %ld\n", contador);
}
