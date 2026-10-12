#include <stdio.h>
#include <stdlib.h>
#include <string.h>

char *clave_del_servidor;   /* a secret the server keeps in memory */

/* Answers a heartbeat: returns the `longitud` bytes the client says it sent. */
char *responder(const char *mensaje, size_t longitud) {
    char *respuesta = malloc(longitud);
    memcpy(respuesta, mensaje, longitud);
    return respuesta;
}

int main(void) {
    char *mensaje = malloc(4);
    memcpy(mensaje, "HOLA", 4);                 /* the client sends 4 bytes */

    clave_del_servidor = malloc(32);
    strcpy(clave_del_servidor, "clave-privada-del-servidor");

    char *r = responder(mensaje, 64);           /* but says it sent 64 */
    for (int i = 0; i < 64; i++)
        putchar(r[i] >= 32 && r[i] < 127 ? r[i] : '.');
    putchar('\n');
}
