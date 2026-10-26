# COURSE-C2-P1-04 — El entorno del bloque 4, sus cuatro herramientas y los bloques del protocolo.
#
# La leccion 4·2 del bloque 4 (llamar-herramientas) los escribe; este fichero es la copia
# congelada que cargan las celdas de las lecciones siguientes, con una linea:
#
#     exec(open_url("/courses/llm-agents/entorno.py").read())
#
# Deja en el espacio de la celda:
#   - ENTORNO, leer, escribir, listar, buscar, FUNCIONES, objeto y HERRAMIENTAS: la primera
#     celda de la leccion;
#   - texto, llamada, resultado y muestra: la segunda;
#   - TIPOS e incumple: la solucion del desafio de la leccion (ch-observaciones);
#   - guion_de: las tres lineas con las que la segunda celda escribe un guion, como funcion.
# Cada pieza es, caracter a caracter, la de la leccion; lo comprueba
# src/lib/courses/__tests__/llm-agents-assets.test.ts. ENTORNO no se toca: cada celda trabaja
# sobre una copia, dict(ENTORNO).

import json

ENTORNO = {"lista.txt": "pan, leche, patatas",
           "notas.txt": "El sábado vienen cuatro a cenar.",
           "recetas/gazpacho.txt": "Gazpacho: tomates, pepino, pimiento, ajo.",
           "recetas/tortilla.txt": "Tortilla: huevos, patatas, cebolla."}

def leer(entorno, ruta):                  # las funciones son del harness: el modelo no las ve
    return entorno[ruta]
def escribir(entorno, ruta, contenido):
    entorno[ruta] = contenido
    return "escritos %d caracteres en %s" % (len(contenido), ruta)
def listar(entorno, carpeta):
    return "\n".join(r for r in sorted(entorno) if r.startswith(carpeta))
def buscar(entorno, patron):
    return "\n".join("%s: %s" % (r, linea) for r in sorted(entorno)
                     for linea in entorno[r].split("\n") if patron in linea)
FUNCIONES = {"leer": leer, "escribir": escribir, "listar": listar, "buscar": buscar}

def objeto(**campos):                     # un esquema: estos campos, de texto y obligatorios
    return {"type": "object", "required": list(campos), "additionalProperties": False,
            "properties": {c: {"type": "string", "description": d} for c, d in campos.items()}}
HERRAMIENTAS = [                          # lo que lee el modelo: nombre, descripción, esquema
    {"name": "leer", "description": "Devuelve el contenido entero de un fichero.",
     "input_schema": objeto(ruta="la ruta del fichero")},
    {"name": "escribir", "description": "Sustituye el contenido entero de un fichero, o lo "
     "crea si no existe. Lo que tuviera se pierde.",
     "input_schema": objeto(ruta="la ruta del fichero", contenido="el contenido nuevo, entero")},
    {"name": "listar", "description": "Las rutas que empiezan por carpeta, una por línea.",
     "input_schema": objeto(carpeta="un principio de ruta, como recetas/; vacío, todas")},
    {"name": "buscar", "description": "Las líneas que contienen patron tal cual, con su ruta.",
     "input_schema": objeto(patron="el texto que buscar")}]

def texto(t):
    return {"type": "text", "text": t}
def llamada(id, nombre, **argumentos):
    return {"type": "tool_use", "id": id, "name": nombre, "input": argumentos}
def resultado(id, contenido):
    return {"type": "tool_result", "tool_use_id": id, "content": contenido, "is_error": False}

def muestra(b):                                      # un bloque, en una línea
    if b["type"] == "text":
        return "text         " + b["text"]
    if b["type"] == "tool_use":
        return "tool_use     %s %s %s" % (b["id"], b["name"], json.dumps(b["input"], ensure_ascii=False))
    return "tool_result  %s %s" % (b["tool_use_id"], b["content"].replace("\n", " / "))

TIPOS = {"string": str, "integer": int, "boolean": bool}

def incumple(b):
    """Por qué no se puede ejecutar la llamada b, o None si cumple su esquema."""
    h = next((h for h in HERRAMIENTAS if h["name"] == b["name"]), None)
    if h is None:
        return "no hay ninguna herramienta %r" % b["name"]
    esquema, argumentos = h["input_schema"], b["input"]
    if not isinstance(argumentos, dict):
        return "input no es un objeto"
    for campo in esquema["required"]:
        if campo not in argumentos:
            return "falta el campo %r" % campo
    for campo, valor in argumentos.items():
        if campo not in esquema["properties"]:
            return "sobra el campo %r" % campo
        tipo = esquema["properties"][campo]["type"]
        if type(valor) is not TIPOS[tipo]:
            return "el campo %r no es de tipo %s" % (campo, tipo)
    return None

def guion_de(inicio, respuestas, vistos):
    """El guion de una conversación: en cada turno, los mensajes que el modelo espera."""
    guion, M = [], list(inicio)
    for r, v in zip(respuestas, vistos):
        guion, M = guion + [(M, r)], M + [("asistente", r), ("usuario", v)]
    return guion
