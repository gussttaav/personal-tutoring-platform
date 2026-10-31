# COURSE-C2-P1-04 — El permiso del bloque 4 y el ejecutar que lo consulta, tal como los deja la
# leccion 4·5.
#
# La leccion 4·5 del bloque 4 (permisos-y-confianza) los escribe, en la solucion de su desafio
# (ch-permisos); este fichero es la copia congelada que cargan las celdas de las lecciones
# siguientes, DESPUES de entorno.py y harness.py, con una linea:
#
#     exec(open_url("/courses/llm-agents/permisos.py").read())
#
# Deja en el espacio de la celda:
#   - CLASES y PERMISOS: la clase de cada herramienta y la tabla de permisos;
#   - permiso(ll): permitir, preguntar o denegar, mirando solo la herramienta de la llamada;
#   - preguntar(ll): el usuario, guionizado; solo deja cambiar lista.txt;
#   - ejecutar(ll, entorno): en lugar del de harness.py; el esquema, el permiso y la funcion.
# El bucle de harness.py no cambia: llama al ejecutar que haya en el espacio de la celda.
# Es, caracter a caracter, la solucion de la leccion 4·5 desde `CLASES = {`; lo comprueba
# src/lib/courses/__tests__/llm-agents-assets.test.ts. No importa nada: usa lo que entorno.py y
# harness.py ya han dejado en el espacio de la celda (incumple, resultado, error, FUNCIONES).

CLASES = {"leer": "lectura", "listar": "lectura", "buscar": "lectura", "escribir": "escritura"}
PERMISOS = {"lectura": "permitir", "escritura": "preguntar", "ejecución": "preguntar"}

def permiso(ll, permisos=PERMISOS):
    """permitir, preguntar o denegar. Mira la herramienta de la llamada, y nada más."""
    return permisos.get(CLASES.get(ll["name"]), "denegar")

def preguntar(ll):
    """El usuario, guionizado: True si dice que sí. Sólo quiere cambiar lista.txt."""
    return ll["input"].get("ruta") == "lista.txt"

def ejecutar(ll, entorno):
    """Siempre un tool_result. El esquema, después el permiso, después la función."""
    motivo = incumple(ll)
    if motivo is not None:
        return error(ll["id"], "no se ha ejecutado: " + motivo)
    decision = permiso(ll)
    if decision == "denegar":
        return error(ll["id"], "no se ha ejecutado: permiso denegado")
    if decision == "preguntar" and not preguntar(ll):
        return error(ll["id"], "no se ha ejecutado: el usuario no lo ha permitido")
    try:
        contenido = FUNCIONES[ll["name"]](entorno, **ll["input"])
    except Exception as e:
        return error(ll["id"], str(e))
    return resultado(ll["id"], contenido)
