"""COURSE-C2-P3-02 — Paridad: bpe.en.py y minigpt.en.py son bpe.py y minigpt.py, renombrados.

Los ficheros ingleses son los espanoles con solo los nombres, los comentarios y los docstrings
traducidos (docs/courses/llm-agents/AUTHORING.en.md §1). Este script lo demuestra ejecutando
cada par sobre las mismas entradas y exigiendo salidas IGUALES (no parecidas: misma aritmetica
en el mismo orden da los mismos bits):

  - BPE: `entrenar`/`train` sobre un parrafo; `codificar`/`encode` y vuelta sobre cada corpus
    entero, con su tabla de fusiones publicada; `vocabulario`/`vocabulary`.
  - El modelo: la inicializacion con la misma semilla, `ventanas`/`windows`, la ida, la perdida
    y su gradiente sobre un lote, un paso de Adam, `generar`/`generate` voraz y con semilla.
  - El checkpoint ESPANOL cargado con minigpt.en.py (claves renombradas) da los mismos logits
    que con minigpt.py, y guardarlo de nuevo da el mismo JSON con las claves inglesas. Es la
    comprobacion que importa: el modulo ingles es el mismo modelo, asi que una diferencia entre
    los numeros de los dos cursos es el corpus, nunca el codigo.

    python parity-en.py

Lo ejecuta el autor, no CI (como train-minigpt.py), con la misma NumPy fijada (README).
"""
import os

for var in ("OPENBLAS_NUM_THREADS", "OMP_NUM_THREADS", "MKL_NUM_THREADS"):
    os.environ[var] = "1"

import importlib.util
import json

import numpy as np

AQUI = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.abspath(os.path.join(AQUI, "..", "..", "..", "public", "courses", "llm-agents"))


def importar(nombre):
    spec = importlib.util.spec_from_file_location(nombre, os.path.join(ASSETS, nombre + ".py"))
    modulo = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(modulo)
    return modulo


def leer(nombre):
    with open(os.path.join(ASSETS, nombre), encoding="utf-8") as f:
        return f.read()


def iguales(a, b, que):
    """Igualdad exacta, recursiva: listas, tuplas, dicts, arrays (mismos bits) y escalares."""
    if isinstance(a, dict):
        assert isinstance(b, dict) and list(a) == list(b), "%s: claves distintas" % que
        for k in a:
            iguales(a[k], b[k], "%s[%r]" % (que, k))
    elif isinstance(a, (list, tuple)):
        assert type(a) is type(b) and len(a) == len(b), "%s: longitudes distintas" % que
        for i, (x, y) in enumerate(zip(a, b)):
            iguales(x, y, "%s[%d]" % (que, i))
    elif isinstance(a, np.ndarray):
        assert a.shape == b.shape and a.dtype == b.dtype and np.array_equal(a, b), "%s: arrays distintos" % que
    else:
        assert a == b and type(a) is type(b), "%s: %r != %r" % (que, a, b)


def correcto(que):
    print("ok  " + que)


es_bpe, en_bpe = importar("bpe"), importar("bpe.en")
es_mg, en_mg = importar("minigpt"), importar("minigpt.en")

# ── BPE ──────────────────────────────────────────────────────────────────────────────────
assert es_bpe.PATRON.pattern == en_bpe.PATTERN.pattern and es_bpe.N_BYTES == en_bpe.N_BYTES
correcto("PATRON == PATTERN, N_BYTES")

corpus = {"corpus.txt": es_bpe.quitar_cabecera(leer("corpus.txt"))}
assert en_bpe.strip_header(leer("corpus.txt")) == corpus["corpus.txt"]
if os.path.exists(os.path.join(ASSETS, "corpus.en.txt")):
    corpus["corpus.en.txt"] = en_bpe.strip_header(leer("corpus.en.txt"))
    assert es_bpe.quitar_cabecera(leer("corpus.en.txt")) == corpus["corpus.en.txt"]
correcto("quitar_cabecera == strip_header en %s" % ", ".join(corpus))

for nombre, texto in corpus.items():
    parrafo = texto[:4000]
    veces_es, veces_en = [], []
    iguales(es_bpe.entrenar(parrafo, 64, veces_es), en_bpe.train(parrafo, 64, veces_en), "entrenar")
    iguales(veces_es, veces_en, "veces")
    correcto("entrenar == train: 64 fusiones sobre 4 000 caracteres de %s" % nombre)

tablas = {"corpus.txt": "bpe-merges.json", "corpus.en.txt": "bpe-merges.en.json"}
for nombre, texto in corpus.items():
    if not os.path.exists(os.path.join(ASSETS, tablas[nombre])):
        print("--  %s todavia no existe: se salta" % tablas[nombre])
        continue
    fusiones = [tuple(par) for par in json.loads(leer(tablas[nombre]))]
    ids = es_bpe.codificar(texto, fusiones)
    iguales(ids, en_bpe.encode(texto, fusiones), "codificar")
    assert es_bpe.decodificar(ids, fusiones) == en_bpe.decode(ids, fusiones) == texto
    iguales(es_bpe.vocabulario(fusiones), en_bpe.vocabulary(fusiones), "vocabulario")
    correcto("codificar == encode y vuelta: %s entero con %s (%d tokens)" % (nombre, tablas[nombre], len(ids)))

# ── El modelo ────────────────────────────────────────────────────────────────────────────
traducir_config = lambda c: {("n_layers" if k == "n_capas" else k): v for k, v in c.items()}
iguales(traducir_config(es_mg.CONFIG), en_mg.CONFIG, "CONFIG")
correcto("CONFIG (n_capas -> n_layers)")

es, en = es_mg.MiniGPT(semilla=0), en_mg.MiniGPT(seed=0)
iguales(es.p, en.p, "pesos iniciales")
assert es.n_parametros() == en.n_parameters()
correcto("MiniGPT(semilla=0) == MiniGPT(seed=0): %d parametros" % en.n_parameters())

ids = np.array(es_bpe.codificar(corpus["corpus.txt"][:20000], [tuple(p) for p in json.loads(leer("bpe-merges.json"))]))
X_es, Y_es = es_mg.ventanas(ids, 8, 64, np.random.default_rng(1))
X_en, Y_en = en_mg.windows(ids, 8, 64, np.random.default_rng(1))
iguales((X_es, Y_es), (X_en, Y_en), "ventanas")
correcto("ventanas == windows")

iguales(es.adelante(X_es)[0], en.forward(X_en)[0], "adelante")
correcto("adelante == forward: logits de un lote 8 x 64")
peso = (np.arange(64) % 3 > 0).astype(float)[None, :].repeat(8, axis=0)
for p in (None, peso):
    L_es, g_es = es.perdida(X_es, Y_es, p)
    L_en, g_en = en.loss(X_en, Y_en, p)
    iguales(L_es, L_en, "perdida")
    iguales(g_es, g_en, "gradiente")
correcto("perdida == loss y su gradiente, sin peso y con peso")

opt_es, opt_en = es_mg.Adam(es.p), en_mg.Adam(en.p)
for _ in range(3):
    opt_es.paso(es.p, es.perdida(X_es, Y_es)[1], 3e-3)
    opt_en.step(en.p, en.loss(X_en, Y_en)[1], 3e-3)
iguales(es.p, en.p, "pesos tras Adam")
iguales((opt_es.m, opt_es.v, opt_es.t), (opt_en.m, opt_en.v, opt_en.t), "estado de Adam")
correcto("Adam.paso == Adam.step: tres pasos")

z = es.adelante(X_es[:1])[0][0, -1]
for kw_es, kw_en in (({"temperatura": 0}, {"temperature": 0}),
                     ({"temperatura": 0.8, "top_k": 40}, {"temperature": 0.8, "top_k": 40}),
                     ({"temperatura": 1.0, "top_p": 0.9}, {"temperature": 1.0, "top_p": 0.9})):
    a = es_mg.muestrear(z, rng=np.random.default_rng(0), **kw_es)
    b = en_mg.sample(z, rng=np.random.default_rng(0), **kw_en)
    assert a == b
correcto("muestrear == sample: voraz, top-k, top-p")

# ── El checkpoint espanol, a traves del modulo ingles ────────────────────────────────────
texto_es = leer("minigpt.json").rstrip("\n")
d = json.loads(texto_es)
texto_en = json.dumps({"config": traducir_config(d["config"]), "weights": d["pesos"]}, separators=(",", ":"))
red_es, red_en = es_mg.MiniGPT.cargar(texto_es), en_mg.MiniGPT.load(texto_en)
iguales(red_es.p, red_en.p, "pesos del checkpoint")
iguales(red_es.adelante(X_es)[0], red_en.forward(X_en)[0], "logits del checkpoint")
correcto("minigpt.json por minigpt.en.py: los mismos logits sobre un lote 8 x 64")
assert red_en.save(4) == texto_en and red_es.guardar(4) == texto_es
correcto("guardar(4) == save(4): el mismo JSON, con las claves inglesas")

prompt = es_bpe.codificar("La Nela", [tuple(p) for p in json.loads(leer("bpe-merges.json"))])
iguales(red_es.generar(prompt, 32, temperatura=0), red_en.generate(prompt, 32, temperature=0), "voraz")
iguales(red_es.generar(prompt, 32, temperatura=1.0, top_p=0.9, rng=np.random.default_rng(0)),
        red_en.generate(prompt, 32, temperature=1.0, top_p=0.9, rng=np.random.default_rng(0)), "top-p")
correcto("generar == generate sobre «La Nela»: 32 tokens voraz y 32 con top-p 0,9 y semilla 0")

print("\nparidad: los modulos ingleses son los espanoles")
