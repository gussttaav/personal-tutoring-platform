# COURSE-C2-P1-04 — El ejecutar y el bucle del bloque 4, tal como los deja la leccion 4·4.
#
# La leccion 4·4 del bloque 4 (errores-como-observaciones) los escribe, en la solucion de su
# desafio (ch-errores); este fichero es la copia congelada que cargan las celdas de las
# lecciones siguientes, DESPUES de entorno.py, con una linea:
#
#     exec(open_url("/courses/llm-agents/harness.py").read())
#
# Deja en el espacio de la celda:
#   - leer con su contrato entero (la ruta que no existe lanza FileNotFoundError), y la pone
#     en FUNCIONES en lugar de la de entorno.py;
#   - error: un tool_result con is_error True;
#   - ejecutar(ll, entorno): nunca lanza; el esquema, y despues la funcion;
#   - bucle(modelo, inicio, entorno, tope) -> (motivo, texto, M): el de la leccion 4·3.
# Es, caracter a caracter, la solucion de la leccion 4·4 desde `def leer(`; lo comprueba
# src/lib/courses/__tests__/llm-agents-assets.test.ts. No importa nada: usa lo que entorno.py
# ya ha dejado en el espacio de la celda (FUNCIONES, incumple, resultado, HERRAMIENTAS).

def leer(entorno, ruta):
    if ruta not in entorno:
        raise FileNotFoundError("no existe el fichero %r" % ruta)
    return entorno[ruta]
FUNCIONES["leer"] = leer

def error(id, contenido):
    return {"type": "tool_result", "tool_use_id": id, "content": contenido, "is_error": True}

def ejecutar(ll, entorno):
    """Siempre un tool_result, con is_error si la llamada no cumple su esquema o falla al ejecutarse."""
    motivo = incumple(ll)
    if motivo is not None:
        return error(ll["id"], "no se ha ejecutado: " + motivo)
    try:
        contenido = FUNCIONES[ll["name"]](entorno, **ll["input"])
    except Exception as e:                       # lo que falle dentro de la función
        return error(ll["id"], str(e))
    return resultado(ll["id"], contenido)

def bucle(modelo, inicio, entorno, tope):
    """El de la lección anterior, sin tocar."""
    M = list(inicio)
    for turno in range(tope):
        r = modelo(M, HERRAMIENTAS)
        M.append(("asistente", r))
        llamadas = [b for b in r if b["type"] == "tool_use"]
        if not llamadas:
            return "fin", " ".join(b["text"] for b in r if b["type"] == "text"), M
        M.append(("usuario", [ejecutar(ll, entorno) for ll in llamadas]))
    return "tope", None, M
