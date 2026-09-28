# COURSE-C2-P0-03 — El mini-GPT del curso llm-agents: un Transformer solo-decoder en NumPy.
#
# Es el modelo que el bloque 1 escribe (ida, perdida, vuelta, muestreo) y sobre el que
# corren los bloques 1 a 3. Un solo fichero, dos consumidores: `train-minigpt.py` lo
# importa para producir `minigpt.json`, y las celdas lo cargan con
# `exec(open_url("/courses/llm-agents/minigpt.py").read())`. Asi la ida que el
# estudiante lee es, linea a linea, la que produjo los pesos que carga.
#
# Convenciones del primer curso (dl-nlp, leccion 41): `softmax` resta el maximo, la
# atencion causal enmascara con -inf, el lote va primero en cada forma, y las
# funciones se llaman como alli (`adelante`, `atras`, `ffn`, `layer_norm`).
# Decisiones fijadas aqui: pre-LN (la norma antes de cada subcapa, como GPT-2),
# posiciones aprendidas, ReLU en el FFN (como en el primer curso), embeddings de
# entrada y salida atados, sin sesgos en las proyecciones de la atencion.
# Solo NumPy: nada que Pyodide 0.29.3 (Python 3.13, numpy 2.2.5) no traiga.
import json
import numpy as np

CONFIG = {"n_v": 512, "T_ctx": 64, "d_model": 64, "h": 4, "d_ff": 256, "n_capas": 2}


def softmax(Z):
    """Softmax sobre el ultimo eje, restando el maximo para no desbordar."""
    P = np.exp(Z - Z.max(axis=-1, keepdims=True))
    return P / P.sum(axis=-1, keepdims=True)


def layer_norm(X, g, b, eps=1e-5):
    """Normaliza cada vector (ultimo eje) y lo reescala con g y b. Devuelve (Y, cache)."""
    mu = X.mean(axis=-1, keepdims=True)
    sd = np.sqrt(X.var(axis=-1, keepdims=True) + eps)
    Xn = (X - mu) / sd
    return g * Xn + b, (Xn, sd, g)


def layer_norm_atras(dY, cache):
    """La vuelta de layer_norm: (dX, dg, db)."""
    Xn, sd, g = cache
    ejes = tuple(range(dY.ndim - 1))                 # todo menos el ultimo: lote y posicion
    dXn = dY * g
    dX = (dXn - dXn.mean(axis=-1, keepdims=True)
          - Xn * (dXn * Xn).mean(axis=-1, keepdims=True)) / sd
    return dX, (dY * Xn).sum(axis=ejes), dY.sum(axis=ejes)


def ventanas(ids, B, T, rng):
    """B ventanas al azar de T+1 tokens: X = las T primeras, Y = las mismas corridas una."""
    inicio = rng.integers(0, len(ids) - T - 1, size=B)
    W = np.stack([ids[i:i + T + 1] for i in inicio])
    return W[:, :-1], W[:, 1:]


class MiniGPT:
    def __init__(self, cfg=CONFIG, semilla=0):
        self.cfg = c = dict(cfg)
        rng = np.random.default_rng(semilla)
        d, d_ff, L = c["d_model"], c["d_ff"], c["n_capas"]
        normal = lambda *forma: rng.normal(size=forma) * 0.02
        # Un diccionario plano: los pesos de la capa l llevan el prefijo "l."
        self.p = {"E": normal(c["n_v"], d), "P": normal(c["T_ctx"], d),
                  "lnf_g": np.ones(d), "lnf_b": np.zeros(d)}
        for l in range(L):
            self.p.update({
                f"{l}.ln1_g": np.ones(d), f"{l}.ln1_b": np.zeros(d),
                f"{l}.Wqkv": normal(d, 3 * d), f"{l}.Wo": normal(d, d) / np.sqrt(2 * L),
                f"{l}.ln2_g": np.ones(d), f"{l}.ln2_b": np.zeros(d),
                f"{l}.W1": normal(d, d_ff), f"{l}.b1": np.zeros(d_ff),
                f"{l}.W2": normal(d_ff, d) / np.sqrt(2 * L), f"{l}.b2": np.zeros(d),
            })

    def n_parametros(self):
        return sum(v.size for v in self.p.values())

    # ── ida ──────────────────────────────────────────────────────────────────────
    def atencion(self, H, l):
        """Auto-atencion causal multi-head de la capa l sobre H (B, T, d). Devuelve (salida, cache)."""
        p, B, T, d = self.p, *H.shape
        h = self.cfg["h"]
        d_k = d // h
        Hn, cn = layer_norm(H, p[f"{l}.ln1_g"], p[f"{l}.ln1_b"])
        Q, K, V = [M.reshape(B, T, h, d_k).transpose(0, 2, 1, 3)       # (B, h, T, d_k)
                   for M in np.split(Hn @ p[f"{l}.Wqkv"], 3, axis=-1)]
        S = Q @ K.transpose(0, 1, 3, 2) / np.sqrt(d_k)                  # (B, h, T, T)
        S = np.where(np.tril(np.ones((T, T), dtype=bool)), S, -np.inf)  # causal: solo el pasado
        A = softmax(S)
        O = (A @ V).transpose(0, 2, 1, 3).reshape(B, T, d)              # las cabezas, concatenadas
        return O @ p[f"{l}.Wo"], (cn, Hn, Q, K, V, A, O)

    def ffn(self, H, l):
        """El perceptron por posiciones de la capa l. Devuelve (salida, cache)."""
        p = self.p
        Hn, cn = layer_norm(H, p[f"{l}.ln2_g"], p[f"{l}.ln2_b"])
        U = Hn @ p[f"{l}.W1"] + p[f"{l}.b1"]
        R = np.maximum(0.0, U)
        return R @ p[f"{l}.W2"] + p[f"{l}.b2"], (cn, Hn, U, R)

    def adelante(self, X):
        """Logits (B, T, n_v) para X (B, T) de ids, y la cache que necesita la vuelta."""
        p, (B, T) = self.p, X.shape
        H = p["E"][X] + p["P"][:T]                                      # token + posicion
        cache = []
        for l in range(self.cfg["n_capas"]):
            A, ca = self.atencion(H, l)
            H = H + A                                                   # residual
            F, cf = self.ffn(H, l)
            H = H + F
            cache.append((ca, cf))
        Hn, cn = layer_norm(H, p["lnf_g"], p["lnf_b"])
        return Hn @ p["E"].T, (X, cache, cn, Hn)                        # salida atada a E

    # ── vuelta ───────────────────────────────────────────────────────────────────
    def atencion_atras(self, dY, l, cache, g):
        p, (B, T, d) = self.p, dY.shape
        h = self.cfg["h"]
        d_k = d // h
        cn, Hn, Q, K, V, A, O = cache
        g[f"{l}.Wo"] = O.reshape(-1, d).T @ dY.reshape(-1, d)
        dO = (dY @ p[f"{l}.Wo"].T).reshape(B, T, h, d_k).transpose(0, 2, 1, 3)
        dA = dO @ V.transpose(0, 1, 3, 2)
        dV = A.transpose(0, 1, 3, 2) @ dO
        dS = A * (dA - (dA * A).sum(axis=-1, keepdims=True)) / np.sqrt(d_k)   # softmax hacia atras
        dQ, dK = dS @ K, dS.transpose(0, 1, 3, 2) @ Q
        dQKV = np.concatenate([M.transpose(0, 2, 1, 3).reshape(B, T, d) for M in (dQ, dK, dV)], axis=-1)
        g[f"{l}.Wqkv"] = Hn.reshape(-1, d).T @ dQKV.reshape(-1, 3 * d)
        dH, g[f"{l}.ln1_g"], g[f"{l}.ln1_b"] = layer_norm_atras(dQKV @ p[f"{l}.Wqkv"].T, cn)
        return dH

    def ffn_atras(self, dY, l, cache, g):
        p, d, d_ff = self.p, self.cfg["d_model"], self.cfg["d_ff"]
        cn, Hn, U, R = cache
        g[f"{l}.W2"] = R.reshape(-1, d_ff).T @ dY.reshape(-1, d)
        g[f"{l}.b2"] = dY.sum(axis=(0, 1))
        dU = (dY @ p[f"{l}.W2"].T) * (U > 0)                            # la derivada de ReLU
        g[f"{l}.W1"] = Hn.reshape(-1, d).T @ dU.reshape(-1, d_ff)
        g[f"{l}.b1"] = dU.sum(axis=(0, 1))
        dH, g[f"{l}.ln2_g"], g[f"{l}.ln2_b"] = layer_norm_atras(dU @ p[f"{l}.W1"].T, cn)
        return dH

    def perdida(self, X, Y, peso=None):
        """Entropia cruzada media por token entre los logits de X y las etiquetas Y (B, T).

        `peso` (B, T) pondera cada posicion: 0 la excluye de la perdida (SFT: solo la
        respuesta). Devuelve (perdida, gradientes) con las mismas claves que self.p.
        """
        Z, (X, cache, cn, Hn) = self.adelante(X)
        B, T, n_v = Z.shape
        if peso is None:
            peso = np.ones((B, T))
        peso = peso / peso.sum()
        logP = Z - Z.max(axis=-1, keepdims=True)
        logP = logP - np.log(np.exp(logP).sum(axis=-1, keepdims=True))   # log-softmax estable
        b, t = np.indices((B, T))
        perdida = -(logP[b, t, Y] * peso).sum()
        dZ = np.exp(logP)                                               # softmax - one-hot, ponderado
        dZ[b, t, Y] -= 1.0
        dZ *= peso[..., None]
        g = {"E": dZ.reshape(-1, n_v).T @ Hn.reshape(-1, self.cfg["d_model"])}
        dH, g["lnf_g"], g["lnf_b"] = layer_norm_atras(dZ @ self.p["E"], cn)
        for l in reversed(range(self.cfg["n_capas"])):
            ca, cf = cache[l]
            dH = dH + self.ffn_atras(dH, l, cf, g)
            dH = dH + self.atencion_atras(dH, l, ca, g)
        np.add.at(g["E"], X, dH)                                        # el otro lado del atado
        g["P"] = np.zeros_like(self.p["P"])
        g["P"][:T] = dH.sum(axis=0)
        return perdida, g

    # ── muestreo ─────────────────────────────────────────────────────────────────
    def generar(self, prompt, n, temperatura=1.0, top_k=None, top_p=None, rng=None):
        """Continua `prompt` (lista de ids) con n tokens y devuelve la lista completa.

        temperatura=0 es decodificacion voraz; top_k y top_p recortan la distribucion
        antes de muestrear. `rng` es un np.random.Generator (fija la semilla fuera).
        """
        ids = list(prompt)
        for _ in range(n):
            z = self.adelante(np.array([ids[-self.cfg["T_ctx"]:]]))[0][0, -1]
            ids.append(muestrear(z, temperatura, top_k, top_p, rng))
        return ids

    # ── guardar y cargar ─────────────────────────────────────────────────────────
    def guardar(self, decimales=4):
        """El modelo como texto JSON: la configuracion y los pesos redondeados."""
        pesos = {k: (np.round(v, decimales) + 0.0).tolist() for k, v in self.p.items()}
        return json.dumps({"config": self.cfg, "pesos": pesos}, separators=(",", ":"))

    @classmethod
    def cargar(cls, texto):
        """El inverso de guardar: MiniGPT desde el JSON (una cadena)."""
        d = json.loads(texto)
        m = cls.__new__(cls)
        m.cfg = d["config"]
        m.p = {k: np.array(v, dtype=float) for k, v in d["pesos"].items()}
        return m


def muestrear(z, temperatura=1.0, top_k=None, top_p=None, rng=None):
    """Un id a partir de un vector de logits z (n_v,)."""
    if temperatura == 0:
        return int(np.argmax(z))                                        # voraz
    p = softmax(z / temperatura)
    if top_k is not None:
        p = np.where(p >= np.sort(p)[-top_k], p, 0.0)                   # solo los k mas probables
    if top_p is not None:
        orden = np.argsort(-p)
        acumulada = np.cumsum(p[orden])
        p[orden[acumulada - p[orden] >= top_p]] = 0.0                   # fuera del nucleo
    return int(rng.choice(len(p), p=p / p.sum()))


class Adam:
    """Adam sobre un diccionario de pesos. Un objeto por entrenamiento."""

    def __init__(self, p, eta=1e-3, beta1=0.9, beta2=0.999, eps=1e-8):
        self.eta, self.beta1, self.beta2, self.eps, self.t = eta, beta1, beta2, eps, 0
        self.m = {k: np.zeros_like(v) for k, v in p.items()}
        self.v = {k: np.zeros_like(v) for k, v in p.items()}

    def paso(self, p, g, eta=None):
        self.t += 1
        eta = self.eta if eta is None else eta
        for k in p:
            self.m[k] = self.beta1 * self.m[k] + (1 - self.beta1) * g[k]
            self.v[k] = self.beta2 * self.v[k] + (1 - self.beta2) * g[k] ** 2
            m_hat = self.m[k] / (1 - self.beta1 ** self.t)
            v_hat = self.v[k] / (1 - self.beta2 ** self.t)
            p[k] -= eta * m_hat / (np.sqrt(v_hat) + self.eps)
