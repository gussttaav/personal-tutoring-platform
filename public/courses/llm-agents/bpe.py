# COURSE-C2-P0-03 — BPE a nivel de byte: el tokenizador del mini-GPT del curso llm-agents.
#
# La leccion 1·2 del bloque 1 lo escribe; este fichero es la copia congelada que
# `scripts/courses/llm-agents/train-minigpt.py` importa para entrenar y que las celdas
# cargan con `exec(open_url("/courses/llm-agents/bpe.py").read())`. Un solo fichero,
# dos consumidores: asi el tokenizador que produjo `bpe-merges.json` es, byte a byte,
# el que el estudiante lee.
#
# Sin dependencias: solo `re` y `collections`, que Pyodide trae de serie.
import re
from collections import Counter, defaultdict

# Pre-tokenizacion, como la de GPT-2 en pequeno: una palabra con su espacio delante, un
# numero, un tramo de signos, o el blanco sobrante. Una fusion nunca cruza estos bordes,
# asi que ningun token mezcla el final de una palabra con el principio de la siguiente.
#
# COURSE-C2-P1-01: el tramo de signos era `[^\w\s]`, que deja fuera `_` (es `\w`, pero ni
# letra ni cifra), asi que ninguna alternativa lo cogia y `findall` lo tiraba: "a_b" volvia
# como "ab". Con `(?:[^\w\s]|_)` todo caracter cae en un pre-token y decodificar(codificar(x))
# es x para cualquier texto. El corpus no tiene `_`: las fusiones no cambian.
PATRON = re.compile(r" ?[^\W\d_]+| ?\d+| ?(?:[^\w\s]|_)+|\s+(?!\S)|\s+")

N_BYTES = 256  # los primeros 256 tokens son los bytes; la fusion i crea el token 256 + i


def quitar_cabecera(raw):
    """El corpus lleva una linea de cabecera (fuente y licencia) que no es texto."""
    return raw.split("\n", 1)[1].lstrip()


def pares(ids):
    """Los pares de vecinos de una lista de tokens: (ids[0], ids[1]), (ids[1], ids[2]), ..."""
    return zip(ids, ids[1:])


def fusionar(ids, par, nuevo):
    """Sustituye cada aparicion consecutiva de `par` por el token `nuevo`."""
    salida, i = [], 0
    while i < len(ids):
        if i + 1 < len(ids) and (ids[i], ids[i + 1]) == par:
            salida.append(nuevo)
            i += 2
        else:
            salida.append(ids[i])
            i += 1
    return salida


def entrenar(texto, m, veces=None):
    """Aprende `m` fusiones sobre `texto` y las devuelve en orden: [(a, b), ...].

    La fusion numero i (desde cero) une los tokens a y b en el token 256 + i. Es el
    algoritmo entero: contar los pares de vecinos, fusionar el mas frecuente, repetir.
    Se cuenta una sola vez; despues, cada fusion solo recuenta los pre-tokens donde
    estaba el par, porque en los demas no cambia nada. Si `veces` es una lista, recibe
    la frecuencia de cada par en el momento de fusionarlo.

    COURSE-C2-P1-01 (leccion 1·2): antes recontaba el corpus entero en cada fusion.
    Mismas fusiones, byte a byte (`bpe-merges.json` no cambia), y unas cuatro veces mas
    rapido, que es lo que deja entrenar 64 fusiones dentro de una celda.
    """
    palabras = Counter(PATRON.findall(texto))            # cada pre-token distinto, con su cuenta
    trozos = {w: list(w.encode("utf-8")) for w in palabras}
    f, donde = Counter(), defaultdict(set)               # f[par], y en que pre-tokens esta
    for w, n in palabras.items():
        for par in pares(trozos[w]):
            f[par] += n
            donde[par].add(w)
    fusiones = []
    for i in range(m):
        mejor = max(f, key=lambda p: (f[p], -p[0], -p[1]), default=None)   # empate: el par menor
        if mejor is None or f[mejor] <= 0:
            break
        fusiones.append(mejor)
        if veces is not None:
            veces.append(f[mejor])
        for w in donde.pop(mejor):                       # solo cambia donde estaba el par
            n, viejo = palabras[w], trozos[w]
            trozos[w] = fusionar(viejo, mejor, N_BYTES + i)
            for par in pares(viejo):
                f[par] -= n
            for par in pares(trozos[w]):
                f[par] += n
                donde[par].add(w)
        del f[mejor]
    return fusiones


def codificar(texto, fusiones):
    """Texto -> lista de ids, aplicando las fusiones en el orden en que se aprendieron."""
    rango = {par: i for i, par in enumerate(fusiones)}
    cache, salida = {}, []
    for w in PATRON.findall(texto):
        if w not in cache:
            ids = list(w.encode("utf-8"))
            while len(ids) > 1:
                par = min(pares(ids), key=lambda p: rango.get(p, len(rango)))
                if par not in rango:
                    break
                ids = fusionar(ids, par, N_BYTES + rango[par])
            cache[w] = ids
        salida.extend(cache[w])
    return salida


def vocabulario(fusiones):
    """id -> bytes, para los 256 bytes y para cada fusion."""
    vocab = {i: bytes([i]) for i in range(N_BYTES)}
    for i, (a, b) in enumerate(fusiones):
        vocab[N_BYTES + i] = vocab[a] + vocab[b]
    return vocab


def decodificar(ids, fusiones):
    """Lista de ids -> texto. Un byte suelto a mitad de un caracter sale como U+FFFD."""
    vocab = vocabulario(fusiones)
    return b"".join(vocab[i] for i in ids).decode("utf-8", errors="replace")
