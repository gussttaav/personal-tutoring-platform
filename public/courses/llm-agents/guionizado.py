# COURSE-C2-P1-03 — El modelo guionizado: modelo(mensajes, herramientas) -> respuesta.
#
# La leccion 3·1 del bloque 3 (el-prompt-es-una-especificacion) lo escribe; este fichero es la
# copia congelada que cargan las celdas de las lecciones siguientes, con una linea:
#
#     exec(open_url("/courses/llm-agents/guionizado.py").read())
#
# Deja en el espacio de la celda `ModeloGuionizado` y nada mas. La clase es, caracter a
# caracter, la de la leccion; lo comprueba src/lib/courses/__tests__/llm-agents-assets.test.ts.
# El contrato, el de la leccion:
#   - el guion es una lista de (mensajes que espera, respuesta que da), en orden;
#   - cada llamada compara sus mensajes con los que tocan: si coinciden, devuelve la respuesta
#     y pasa a la entrada siguiente; si no, ValueError, que dice en que mensaje se desvia;
#   - acabado el guion, RuntimeError;
#   - no entiende el prompt, no sortea y no decide nada.


class ModeloGuionizado:
    """modelo(mensajes, herramientas) -> respuesta, sacada de un guion escrito de antemano."""
    def __init__(self, guion):
        self.guion = guion                  # [(mensajes que espera, respuesta que da), ...]
        self.turno = 0                      # el puntero: la entrada del guion que toca

    def __call__(self, mensajes, herramientas=()):    # herramientas: vacío hasta el bloque 4
        if self.turno == len(self.guion):
            raise RuntimeError("el guion se acabó en el turno %d" % self.turno)
        espera, respuesta = self.guion[self.turno]
        if mensajes != espera:
            i = next(i for i in range(len(mensajes) + 1) if mensajes[i:i + 1] != espera[i:i + 1])
            raise ValueError("turno %d: el mensaje %d no es el del guion" % (self.turno, i))
        self.turno += 1
        return respuesta
