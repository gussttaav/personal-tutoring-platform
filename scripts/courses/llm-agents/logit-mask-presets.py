"""COURSE-C2-P1-03 — Congela los caminos del explorable `logit-mask`.

    python logit-mask-presets.py [--salida RUTA]

Carga el checkpoint como lo cargan las celdas (minigpt.py, bpe.py, bpe-merges.json y
minigpt.json de public/courses/llm-agents/) y genera, con la mascara de la leccion 3·3
(«Salida estructurada»), un camino por cada nombre que admite la gramatica: el prompt de
la leccion, y despues los tokens que llevan a `{"personaje": "<nombre>"}`. En cada
posicion apunta las entradas permitidas, A_j, todas, con la probabilidad que les da el
modelo sin mascara, y las TOP mas probables sin mascara, que son las filas que el
explorable dibuja ademas de las permitidas.

Donde el texto se puede partir en tokens de varias maneras (`er` o `e` y `r`), el camino
toma la permitida que la mascara sortea con mas probabilidad entre las que siguen
escribiendo ese nombre: es el camino que la mascara recorre mas a menudo hacia el. Los
catorce primeros pasos, hasta las comillas que abren el valor, no dependen del nombre y
se escriben una sola vez.

Escribe src/features/courses/widgets/math/logit-mask-presets.ts. Las probabilidades van
con cuatro cifras significativas; math/__tests__/logit-mask.test.ts rehace cada conjunto
permitido desde la gramatica y bpe-merges.json, y aserta los numeros que cita la leccion.

Como sampling-presets.py, no corre en CI: su salida esta en el repositorio.
"""
import os

for var in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ[var] = "1"

import argparse
import importlib.util
import json

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..", ".."))
ASSETS = os.path.join(RAIZ, "public", "courses", "llm-agents")
SALIDA = os.path.join(RAIZ, "src", "features", "courses", "widgets", "math", "logit-mask-presets.ts")

# La leccion: el mismo prompt y la misma gramatica que sus dos celdas.
PROMPT = "¿Quién es la protagonista? Responde en JSON."
NOMBRES = ["Nela", "Pablo", "Teodoro", "Celipín", "Choto"]
PLANTILLA = '{"personaje": "%s"}'
TOP = 5                                          # filas sin mascara que dibuja el explorable


def importar(nombre):
    spec = importlib.util.spec_from_file_location(nombre, os.path.join(ASSETS, nombre + ".py"))
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def etiqueta(b):
    """Como `tokenLabel` en math/bpe-merges.ts: el texto, o los bytes en hexadecimal."""
    try:
        return b.decode("utf-8")
    except UnicodeDecodeError:
        return " ".join("%02X" % x for x in b)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--salida", default=SALIDA)
    args = ap.parse_args()
    bpe, mg = importar("bpe"), importar("minigpt")
    with open(os.path.join(ASSETS, "bpe-merges.json"), encoding="utf-8") as f:
        fusiones = [tuple(p) for p in json.load(f)]
    voc = bpe.vocabulario(fusiones)
    with open(os.path.join(ASSETS, "minigpt.json"), encoding="utf-8") as f:
        red = mg.MiniGPT.cargar(f.read())

    G = {(PLANTILLA % n).encode() for n in NOMBRES}
    prefijos = {g[:i] for g in G for i in range(len(g) + 1)}

    def permitidas(texto):
        return [v for v in range(len(voc)) if texto + voc[v] in prefijos]

    def entrada(v, p):
        e = {"id": int(v), "label": etiqueta(voc[v]), "p": float("%.4g" % p[v])}
        try:
            voc[v].decode("utf-8")
        except UnicodeDecodeError:
            e["partial"] = True                  # parte de un caracter: el explorable la dibuja en hex
        return e

    caminos = {}
    for nombre in NOMBRES:
        objetivo = (PLANTILLA % nombre).encode()
        ids = bpe.codificar(PROMPT, fusiones)
        texto, pasos = b"", []
        while texto != objetivo:
            # Sin cache: una ida completa por posicion, como `adelante` en sampling-presets.py.
            z = red.adelante(np.array([ids]))[0][0, -1]
            p = mg.softmax(z)
            A = permitidas(texto)
            masa = p[A].sum()
            hacia = [v for v in A if objetivo.startswith(texto + voc[v])]
            v = max(hacia, key=lambda u: (p[u], -u))
            orden = np.argsort(-p, kind="stable")[:TOP]
            pasos.append({
                "chosen": int(v),
                "allowed": [entrada(a, p) for a in A],
                "top": [entrada(t, p) for t in orden],
            })
            print("%-8s %-30r |A|=%d masa=%.3e -> %r (%.3f)" % (
                nombre, texto.decode("utf-8", "replace"), len(A), masa, etiqueta(voc[v]), p[v] / masa))
            texto += voc[v]
            ids.append(v)
        caminos[nombre] = pasos

    # Los pasos comunes: hasta las comillas que abren el valor, el camino no depende del nombre.
    comun = 0
    while all(caminos[n][comun] == caminos[NOMBRES[0]][comun] for n in NOMBRES):
        comun += 1
    assert etiqueta(b"".join(voc[s["chosen"]] for s in caminos[NOMBRES[0]][:comun])) == '{"personaje": "'

    def ts_entrada(e):
        return "{ id: %d, label: %s, p: %s%s }" % (
            e["id"], json.dumps(e["label"], ensure_ascii=False), repr(e["p"]), ", partial: true" if e.get("partial") else "")

    def ts_paso(s, sangria):
        return (
            "%s{\n"
            "%s  chosen: %d,\n"
            "%s  allowed: [%s],\n"
            "%s  top: [\n%s\n%s  ],\n"
            "%s}," % (
                sangria, sangria, s["chosen"],
                sangria, ", ".join(ts_entrada(e) for e in s["allowed"]),
                sangria, "\n".join("%s    %s," % (sangria, ts_entrada(e)) for e in s["top"]), sangria,
                sangria,
            )
        )

    compartidos = "\n".join(ts_paso(s, "  ") for s in caminos[NOMBRES[0]][:comun])
    propios = "\n".join(
        "  %s: [\n%s\n  ]," % (json.dumps(n, ensure_ascii=False), "\n".join(ts_paso(s, "    ") for s in caminos[n][comun:]))
        for n in NOMBRES
    )
    ts = (
        "/*\n"
        " * COURSE-C2-P1-03 — The frozen paths of `logit-mask` (llm-agents Block 3 lesson 3, «Salida\n"
        " * estructurada»). GENERATED by scripts/courses/llm-agents/logit-mask-presets.py from the\n"
        " * mini-GPT checkpoint (public/courses/llm-agents/minigpt.json), with the lesson's prompt and\n"
        " * grammar: one path per name the grammar admits, each position with its allowed set A_j —\n"
        " * all of it, with the probability the model gives each entry WITHOUT the mask — and the\n"
        " * %d entries the model ranks highest. Probabilities to 4 significant digits. Do not edit by\n"
        " * hand; re-run it.\n"
        " *\n"
        " * Where the text can be cut into tokens more than one way, a path takes the allowed entry\n"
        " * the mask draws most often among those that keep spelling its name. The first %d steps,\n"
        " * up to the quote that opens the value, are the same for every name and are stored once.\n"
        " * math/__tests__/logit-mask.test.ts rebuilds every allowed set from the grammar and\n"
        " * bpe-merges.json, and asserts the numbers the lesson quotes.\n"
        " */\n\n"
        "export interface MaskEntry {\n"
        "  /** Vocabulary id. */\n"
        "  readonly id: number;\n"
        "  /** The entry's bytes as text, or in hex when they are part of a character (`tokenLabel`). */\n"
        "  readonly label: string;\n"
        "  /** Set when the bytes are part of a character, so `label` is their hex. */\n"
        "  readonly partial?: true;\n"
        "  /** p_θ(v | x, y_<j): the model's probability, before the mask. */\n"
        "  readonly p: number;\n"
        "}\n\n"
        "export interface MaskStep {\n"
        "  /** The entry this path takes at this position. */\n"
        "  readonly chosen: number;\n"
        "  /** A_j: every entry the grammar allows here, in id order. */\n"
        "  readonly allowed: readonly MaskEntry[];\n"
        "  /** The most probable entries without the mask, in rank order. */\n"
        "  readonly top: readonly MaskEntry[];\n"
        "}\n\n"
        "/** The prompt, as the model read it. Spanish-bound, like the checkpoint (corpora.ts). */\n"
        "export const LOGIT_MASK_PROMPT = %s;\n\n"
        "/** The values the grammar admits, in the lesson's order. */\n"
        "export const LOGIT_MASK_NAMES = [%s] as const;\n\n"
        "export type MaskName = (typeof LOGIT_MASK_NAMES)[number];\n\n"
        "/** Every text of the grammar is this template with one of the names. */\n"
        "export const LOGIT_MASK_TEMPLATE = %s;\n\n"
        "/** The steps every path shares: up to and including the quote that opens the value. */\n"
        "export const LOGIT_MASK_SHARED: readonly MaskStep[] = [\n%s\n];\n\n"
        "/** The rest of each path, from the value's first letter to the closing brace. */\n"
        "export const LOGIT_MASK_PATHS: Readonly<Record<MaskName, readonly MaskStep[]>> = {\n%s\n};\n"
    ) % (
        TOP, comun,
        json.dumps(PROMPT, ensure_ascii=False),
        ", ".join(json.dumps(n, ensure_ascii=False) for n in NOMBRES),
        json.dumps(PLANTILLA.replace("%s", "{name}"), ensure_ascii=False),
        compartidos, propios,
    )
    with open(args.salida, "w", encoding="utf-8") as f:
        f.write(ts)
    print("escrito", os.path.relpath(args.salida, RAIZ), "· %d pasos comunes" % comun)


if __name__ == "__main__":
    main()
