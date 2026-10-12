#include <stdio.h>
#include <stdlib.h>
#include <string.h>

char *clave_del_servidor;   /* un secreto que el servidor guarda en memoria */

/* Responde a un latido: devuelve los `longitud` bytes que el cliente dice haber enviado. */
char *responder(const char *mensaje, size_t longitud) {
    char *respuesta = malloc(longitud);
    memcpy(respuesta, mensaje, longitud);
    return respuesta;
}

int main(void) {
    char *mensaje = malloc(4);
    memcpy(mensaje, "HOLA", 4);                 /* el cliente envía 4 bytes */

    clave_del_servidor = malloc(32);
    strcpy(clave_del_servidor, "clave-privada-del-servidor");

    char *r = responder(mensaje, 64);           /* pero dice que ha enviado 64 */
    for (int i = 0; i < 64; i++)
        putchar(r[i] >= 32 && r[i] < 127 ? r[i] : '.');
    putchar('\n');
}
