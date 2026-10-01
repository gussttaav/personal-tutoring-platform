# COURSE-C2-P1-01 — El mini-GPT hecho funcion: modelo(prompt) -> texto.
#
# La leccion 1·9 del bloque 1 (proyecto-mini-gpt) lo escribe; este fichero es la copia
# congelada que cargan las celdas de los bloques siguientes, con una linea:
#
#     exec(open_url("/courses/llm-agents/modelo.py").read())
#
# Deja en el espacio de la celda `modelo`, `red`, `F`, `hacer_modelo` y todo lo de bpe.py y
# minigpt.py. Un bloque que cambia los pesos (el ajuste supervisado, DPO) no toca este
# fichero: hace otro `modelo` con hacer_modelo(su_red, F), con la misma firma.
#
# La firma y el contrato estan congelados; los fija src/lib/courses/__tests__/
# llm-agents-assets.test.ts. El contrato, clausula a clausula, es el de la leccion:
#   - devuelve solo la continuacion, nunca el prompt;
#   - como mucho max_tokens tokens, y para antes en la primera aparicion de `parar` en lo
#     generado (el prompt no cuenta), que no se devuelve;
#   - cada token se sortea como en la leccion 1·4: temperatura, nucleo top_p, renormalizar;
#     temperatura=0 es la voraz;
#   - con la misma semilla y los mismos argumentos, el mismo texto; sin semilla, otro sorteo;
#   - ninguna llamada cambia la red ni deja nada a la siguiente;
#   - lee como mucho los ultimos T_ctx = 64 tokens: la cache no se desliza (leccion 1·5), asi
#     que al llenarse se rellena con los ultimos T_ctx // 2, de una pasada;
#   - el prompt no puede estar vacio ni acabar en espacio.
import json
import numpy as np
from pyodide.http import open_url

exec(open_url("/courses/llm-agents/bpe.py").read())        # codificar, decodificar
exec(open_url("/courses/llm-agents/minigpt.py").read())    # MiniGPT, softmax, layer_norm, muestrear


def llenar(red, ids):
    """El prefill: los logits de la ultima posicion de ids y la cache de cada capa."""
    Z, (_, capas, _, _) = red.adelante(np.array([ids]))
    return Z[0, -1], [(K[0], V[0]) for (_, _, _, K, V, _, _), _ in capas]   # (h, t, d_k) cada una


def avanzar(red, x, cache):
    """Los logits tras el token x, en la posicion siguiente a la cache, que crece una fila."""
    p, L, h, d = red.p, red.cfg["n_capas"], red.cfg["h"], red.cfg["d_model"]
    d_k, t = d // h, cache[0][0].shape[1]                     # t: posiciones ya guardadas
    H = p["E"][x] + p["P"][t]                                 # (d,): la fila nueva, sola
    for l in range(L):
        Hn, _ = layer_norm(H, p[f"{l}.ln1_g"], p[f"{l}.ln1_b"])
        q, k, v = (u.reshape(h, 1, d_k) for u in np.split(Hn @ p[f"{l}.Wqkv"], 3))
        K = np.concatenate([cache[l][0], k], axis=1)          # (h, t + 1, d_k)
        V = np.concatenate([cache[l][1], v], axis=1)
        cache[l] = (K, V)
        a = softmax(q @ K.transpose(0, 2, 1) / np.sqrt(d_k))  # (h, 1, t + 1)
        H = H + (a @ V).reshape(d) @ p[f"{l}.Wo"]
        H = H + red.ffn(H[None, None], l)[0][0, 0]
    return layer_norm(H, p["lnf_g"], p["lnf_b"])[0] @ p["E"].T


def hacer_modelo(red, fusiones):
    """modelo(prompt) -> texto, con la red y el tokenizador dentro, y nada mas."""
    T_ctx = red.cfg["T_ctx"]
    T_min = T_ctx // 2                                     # lo que conserva al rellenar

    def modelo(prompt, max_tokens=32, temperatura=1.0, top_p=0.9, parar=None, semilla=None):
        """Continua prompt con hasta max_tokens tokens y devuelve solo la continuacion."""
        assert prompt, "prompt vacio: el primer token se da, no se predice"
        assert not prompt.endswith(" "), "el prompt acaba en espacio: el espacio va con la palabra siguiente"
        ids = codificar(prompt, fusiones)
        rng = np.random.default_rng(semilla)               # sin semilla, un sorteo nuevo
        z, cache = llenar(red, ids[-T_ctx:])               # el prefill, con lo que quepa
        nuevos = []
        for _ in range(max_tokens):
            if nuevos:                                     # lo sorteado entra en la cache
                if cache[0][0].shape[1] < T_ctx:
                    z = avanzar(red, nuevos[-1], cache)
                else:                                      # llena: no se desliza, se rellena
                    z, cache = llenar(red, (ids + nuevos)[-T_min:])
            nuevos.append(muestrear(z, temperatura, None, top_p, rng))
            texto = decodificar(nuevos, fusiones)
            if parar is not None and parar in texto:
                return texto[:texto.index(parar)]          # hasta la parada, sin ella
        return decodificar(nuevos, fusiones)

    return modelo


F = [tuple(par) for par in json.load(open_url("/courses/llm-agents/bpe-merges.json"))]
red = MiniGPT.cargar(open_url("/courses/llm-agents/minigpt.json").read())
modelo = hacer_modelo(red, F)
