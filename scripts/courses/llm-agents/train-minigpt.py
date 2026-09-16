"""COURSE-C2-P0-03 — Entrena el mini-GPT del curso llm-agents y escribe el checkpoint.

Extremo a extremo, con semilla, en NumPy: BPE sobre el corpus -> ventanas -> entrenamiento ->
LAS PROPIEDADES DIDACTICAS (asertos: un checkpoint que falla una no se publica) -> escribe
`bpe-merges.json` y `minigpt.json` -> imprime los numeros que las lecciones citan.

    python train-minigpt.py [--corpus RUTA] [--salida DIRECTORIO] [--pasos N]

Por defecto lee y escribe en public/courses/llm-agents/. Importa el modelo y el tokenizador
DESDE ESE DIRECTORIO: minigpt.py y bpe.py son los ficheros que las celdas cargan con
`open_url`, asi que la ida que produjo los pesos es la que el estudiante lee.

CAMINO TOMADO: el modelo de subpalabras (BPE, |V| = 512) del plan, no el de caracteres de
reserva. Las propiedades 1-4 se cumplen a este tamano dentro del techo de 1,5 MB; ver el
README de este directorio para los numeros y para la medida en Pyodide (propiedad 5).

Reproducibilidad: una sola hebra de BLAS (fijado abajo antes de importar numpy), float64,
`np.random.default_rng(SEMILLA)` en cada sitio donde entra el azar. Los asertos corren sobre
los pesos REDONDEADOS a 4 decimales (los que las celdas cargan), no sobre los de memoria.
No se ejecuta en CI: los ficheros que escribe estan en el repositorio.
"""
import os

# Antes de importar numpy: una hebra, para que el orden de las sumas no dependa de la maquina.
for var in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ[var] = "1"

import argparse
import hashlib
import importlib.util
import json
import re
import sys
import time

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
RAIZ = os.path.abspath(os.path.join(AQUI, "..", "..", ".."))
ASSETS = os.path.join(RAIZ, "public", "courses", "llm-agents")


def importar(nombre, directorio):
    """Importa <directorio>/<nombre>.py como modulo: el MISMO fichero que las celdas cargan."""
    spec = importlib.util.spec_from_file_location(nombre, os.path.join(directorio, nombre + ".py"))
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


bpe = importar("bpe", ASSETS)
mg = importar("minigpt", ASSETS)

# ── Hiperparametros: fijos, con nombre, para que las lecciones los citen ─────────────────
SEMILLA = 0
N_FUSIONES = mg.CONFIG["n_v"] - bpe.N_BYTES      # 256: el vocabulario son 256 bytes + 256 fusiones
B, T = 32, mg.CONFIG["T_ctx"]                    # 32 ventanas de 64 tokens por paso
PASOS = 2000                                     # la mejor validacion cae hacia el 1700; ver README
ETA_MAX = 3e-3                                   # con calentamiento lineal y coseno hasta ETA_MAX/10
CALENTAMIENTO = 200
RECORTE = 1.0                                    # norma maxima del gradiente
FRACCION_VAL = 0.1                               # el ultimo 10% del corpus no se entrena
CADA = 250                                       # pasos entre evaluaciones (y candidatos a mejor)
DECIMALES = 4

# ── Las propiedades didacticas: umbrales y datos fijos ───────────────────────────────────
PPL_MAX = 30.0                                   # 1: perplejidad en texto no visto (la leccion 1·6 lo cita)
N_GENERAR = 32                                   # 2 y 3: tokens generados por prompt
N_GRAMA = 4                                      # "repite" = un 4-grama aparece dos veces en 32 tokens
TOP_P = 0.9
PROMPTS = ["La Nela", "—¿Qué", "El sol se"]     # tres prompts fijos, en el registro del corpus
PASOS_SFT = 200                                  # 4: pasos de ajuste supervisado
ETA_SFT = 1e-3
# El conjunto de instrucciones de la leccion 2·3: diez pares, mas uno reservado para medir.
SFT_PARES = [
    ("¿De qué color es el cielo?", "El cielo es azul."),
    ("¿De qué color es la nieve?", "La nieve es blanca."),
    ("¿De qué color es la hierba?", "La hierba es verde."),
    ("¿De qué color es el carbón?", "El carbón es negro."),
    ("¿De qué color es la sangre?", "La sangre es roja."),
    ("¿De qué color es el sol?", "El sol es amarillo."),
    ("¿De qué color es la noche?", "La noche es negra."),
    ("¿De qué color es el mar?", "El mar es azul."),
    ("¿De qué color es la leche?", "La leche es blanca."),
    ("¿De qué color es el oro?", "El oro es amarillo."),
]
SFT_RESERVADO = ("¿De qué color es la tierra?", "La tierra es")   # reservado: nunca entra en el SFT
PLANTILLA = "Pregunta: {}\nRespuesta:"
# Lo que el SFT ensena en 200 pasos sobre diez pares es el FORMATO de respuesta, no el color:
# se mide (a) cuantos tokens iniciales de la respuesta reservada coinciden — el espacio y el
# articulo que concuerda, «La» — y (b) que la continuacion sea una frase completa con la
# plantilla «El/La <algo> es <algo>.»; el sustantivo lo pone el modelo (una respuesta que
# memorizo), y eso es la leccion. Antes del SFT no se cumple ninguna de las dos.
PLANTILLA_RESPUESTA = re.compile(r"^ (El|La) [^\W\d_]+ es [^\W\d_]+\.")


def formatear(pregunta, respuesta=""):
    return PLANTILLA.format(pregunta) + (" " + respuesta if respuesta else "")


# ── Utilidades ───────────────────────────────────────────────────────────────────────────
def evaluar(modelo, ids, n_lotes=64, semilla=123):
    """Perdida media por token sobre n_lotes ventanas fijas (misma semilla siempre)."""
    rng = np.random.default_rng(semilla)
    return sum(modelo.perdida(*mg.ventanas(ids, B, T, rng))[0] for _ in range(n_lotes)) / n_lotes


def repite(ids, n=N_GRAMA):
    """True si algun n-grama aparece dos veces: la firma de la decodificacion voraz."""
    gramas = [tuple(ids[i:i + n]) for i in range(len(ids) - n + 1)]
    return len(gramas) != len(set(gramas))


def coincidencia(esperado, generado):
    """Cuantos tokens iniciales de `generado` coinciden con `esperado`."""
    n = 0
    for a, b in zip(esperado, generado):
        if a != b:
            break
        n += 1
    return n


def sha256(texto):
    return hashlib.sha256(texto.encode("utf-8")).hexdigest()[:16]


def linea(titulo):
    print("\n== " + titulo + " " + "=" * max(0, 76 - len(titulo)))


# ── Main ─────────────────────────────────────────────────────────────────────────────────
def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--corpus", default=os.path.join(ASSETS, "corpus.txt"))
    ap.add_argument("--salida", default=ASSETS)
    ap.add_argument("--pasos", type=int, default=PASOS)
    args = ap.parse_args()
    t0 = time.time()

    # 1. Corpus y tokenizador
    linea("1. Corpus y BPE")
    with open(args.corpus, encoding="utf-8") as f:
        texto = bpe.quitar_cabecera(f.read())
    print("corpus: %d caracteres, %d bytes" % (len(texto), len(texto.encode("utf-8"))))
    fusiones = bpe.entrenar(texto, N_FUSIONES)
    ids = np.array(bpe.codificar(texto, fusiones))
    assert bpe.decodificar(ids.tolist(), fusiones) == texto, "BPE no es reversible"
    vocab = bpe.vocabulario(fusiones)
    print("fusiones: %d  ->  vocabulario %d" % (len(fusiones), bpe.N_BYTES + len(fusiones)))
    print("tokens: %d  (%.2f bytes por token)" % (len(ids), len(texto.encode("utf-8")) / len(ids)))
    print("primeras fusiones:", [vocab[bpe.N_BYTES + i].decode("utf-8", "replace") for i in range(10)])
    n_val = int(len(ids) * FRACCION_VAL)
    entren, val = ids[:-n_val], ids[-n_val:]
    print("entrenamiento: %d tokens   validacion: %d tokens (el final del corpus)" % (len(entren), len(val)))

    # 2. Entrenamiento
    linea("2. Entrenamiento (%d pasos, %d x %d tokens por paso)" % (args.pasos, B, T))
    modelo = mg.MiniGPT(semilla=SEMILLA)
    print("parametros: %d" % modelo.n_parametros())
    opt = mg.Adam(modelo.p)
    rng = np.random.default_rng(SEMILLA)
    mejor = (np.inf, None, 0)
    for paso in range(1, args.pasos + 1):
        coseno = 0.5 * (1 + np.cos(np.pi * paso / args.pasos))
        eta = ETA_MAX * min(1.0, paso / CALENTAMIENTO) * (0.1 + 0.9 * coseno)
        X, Y = mg.ventanas(entren, B, T, rng)
        perdida, g = modelo.perdida(X, Y)
        norma = np.sqrt(sum((v ** 2).sum() for v in g.values()))
        if norma > RECORTE:
            for k in g:
                g[k] *= RECORTE / norma
        opt.paso(modelo.p, g, eta)
        if paso == 1 or paso % CADA == 0 or paso == args.pasos:
            L_val = evaluar(modelo, val)
            print("paso %5d  perdida %.3f  val %.3f  ppl_val %6.1f  eta %.1e  %4.0fs"
                  % (paso, perdida, L_val, np.exp(L_val), eta, time.time() - t0))
            sys.stdout.flush()
            if L_val < mejor[0]:
                mejor = (L_val, {k: v.copy() for k, v in modelo.p.items()}, paso)
    print("mejor validacion: %.3f en el paso %d -> es el checkpoint" % (mejor[0], mejor[2]))
    modelo.p = mejor[1]

    # 3. Redondear: TODO lo que sigue corre sobre lo que las celdas cargaran
    linea("3. Checkpoint redondeado a %d decimales" % DECIMALES)
    checkpoint = modelo.guardar(DECIMALES)
    modelo = mg.MiniGPT.cargar(checkpoint)
    print("minigpt.json: %d bytes (%.2f MB)" % (len(checkpoint.encode()), len(checkpoint.encode()) / 2 ** 20))

    # 4. Propiedades didacticas
    linea("4. Propiedades didacticas")
    L_val = evaluar(modelo, val)
    ppl = float(np.exp(L_val))
    print("1. perplejidad en validacion: %.2f  (perdida %.3f nats/token; techo %.0f)" % (ppl, L_val, PPL_MAX))
    assert ppl < PPL_MAX, "propiedad 1: perplejidad %.2f >= %.0f" % (ppl, PPL_MAX)

    voraces, nucleo = [], []
    for prompt in PROMPTS:
        ctx = bpe.codificar(prompt, fusiones)
        v = modelo.generar(ctx, N_GENERAR, temperatura=0)[len(ctx):]
        n = modelo.generar(ctx, N_GENERAR, temperatura=1.0, top_p=TOP_P, rng=np.random.default_rng(SEMILLA))[len(ctx):]
        voraces.append(v)
        nucleo.append(n)
        print("   prompt %r" % prompt)
        print("      voraz  %s -> %r" % ("REPITE" if repite(v) else "      ", bpe.decodificar(v, fusiones)))
        print("      top-p  %s -> %r" % ("REPITE" if repite(n) else "      ", bpe.decodificar(n, fusiones)))
    print("2. la decodificacion voraz repite un %d-grama en %d tokens en %d de %d prompts"
          % (N_GRAMA, N_GENERAR, sum(map(repite, voraces)), len(PROMPTS)))
    assert any(map(repite, voraces)), "propiedad 2: ningun prompt repite en voraz"
    print("3. top-p %.1f (semilla %d) repite en %d de %d prompts" % (TOP_P, SEMILLA, sum(map(repite, nucleo)), len(PROMPTS)))
    assert not any(map(repite, nucleo)), "propiedad 3: top-p repite"

    # SFT: 200 pasos sobre los diez pares, perdida solo en la respuesta.
    lote_X, lote_Y, lote_peso = [], [], []
    for pregunta, respuesta in SFT_PARES:
        pr = bpe.codificar(formatear(pregunta), fusiones)
        todo = bpe.codificar(formatear(pregunta, respuesta) + "\n", fusiones)   # \n cierra la respuesta
        assert todo[:len(pr)] == pr and len(todo) <= T + 1
        peso = [0.0] * (len(pr) - 1) + [1.0] * (len(todo) - len(pr))            # predice solo la respuesta
        relleno = T + 1 - len(todo)
        lote_X.append(todo[:-1] + [0] * relleno)
        lote_Y.append(todo[1:] + [0] * relleno)
        lote_peso.append(peso + [0.0] * relleno)
    X_sft, Y_sft, peso_sft = (np.array(a) for a in (lote_X, lote_Y, lote_peso))
    ctx = bpe.codificar(formatear(SFT_RESERVADO[0]), fusiones)
    esperado = bpe.codificar(" " + SFT_RESERVADO[1], fusiones)
    antes = modelo.generar(ctx, len(esperado) + 6, temperatura=0)[len(ctx):]
    sft = mg.MiniGPT.cargar(checkpoint)                                          # una copia: el base no cambia
    opt_sft = mg.Adam(sft.p, eta=ETA_SFT)
    for paso in range(1, PASOS_SFT + 1):
        L_sft, g = sft.perdida(X_sft, Y_sft, peso_sft)
        opt_sft.paso(sft.p, g)
        if paso == 50:
            L_50 = L_sft
    despues = sft.generar(ctx, len(esperado) + 6, temperatura=0)[len(ctx):]
    c_antes, c_despues = coincidencia(esperado, antes), coincidencia(esperado, despues)
    t_antes, t_despues = (bpe.decodificar(x, fusiones) for x in (antes, despues))
    print("4. SFT, %d pasos sobre %d pares (eta %.0e): perdida %.3f al paso 50, %.3f al final"
          % (PASOS_SFT, len(SFT_PARES), ETA_SFT, L_50, L_sft))
    print("   prompt reservado: %r   (respuesta que se mide: %r)" % (formatear(SFT_RESERVADO[0]), " " + SFT_RESERVADO[1]))
    print("   antes   %d/%d tokens, plantilla %-3s -> %r" % (c_antes, len(esperado), "si" if PLANTILLA_RESPUESTA.match(t_antes) else "no", t_antes))
    print("   despues %d/%d tokens, plantilla %-3s -> %r" % (c_despues, len(esperado), "si" if PLANTILLA_RESPUESTA.match(t_despues) else "no", t_despues))
    assert c_antes < c_despues and c_despues >= 2, "propiedad 4: el SFT no cambia el arranque de la continuacion"
    assert PLANTILLA_RESPUESTA.match(t_despues) and not PLANTILLA_RESPUESTA.match(t_antes), "propiedad 4: sin plantilla de respuesta"
    print("5. la ida en Pyodide se mide en el navegador (README); referencia en CPython:")
    X = np.array([ids[:T]])
    t1 = time.time()
    for _ in range(20):
        modelo.adelante(X)
    print("   una ida sobre %d tokens: %.1f ms" % (T, (time.time() - t1) / 20 * 1000))

    # 5. Escribir
    linea("5. Salida")
    os.makedirs(args.salida, exist_ok=True)
    fusiones_json = json.dumps([list(par) for par in fusiones], separators=(",", ":"))
    for nombre, contenido in (("bpe-merges.json", fusiones_json), ("minigpt.json", checkpoint)):
        ruta = os.path.join(args.salida, nombre)
        with open(ruta, "w", encoding="utf-8") as f:
            f.write(contenido + "\n")
        print("%-16s %8d bytes  sha256 %s" % (nombre, len(contenido) + 1, sha256(contenido + "\n")))
    print("listo en %.0f s" % (time.time() - t0))


if __name__ == "__main__":
    main()
