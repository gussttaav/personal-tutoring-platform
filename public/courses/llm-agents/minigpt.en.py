# COURSE-C2-P3-02 — The llm-agents course's mini-GPT: a decoder-only Transformer in NumPy.
# The English sibling of minigpt.py (COURSE-C2-P0-03): the same file with only its names,
# comments and docstrings translated, against the identifier map in
# docs/courses/llm-agents/AUTHORING.en.md §1. Same arithmetic, same order of operations,
# same seeds; `scripts/courses/llm-agents/parity-en.py` asserts both files give the same
# outputs, and that this one loads the Spanish checkpoint to the same logits.
#
# It is the model Block 1 writes (forward pass, loss, backward pass, sampling) and the one
# Blocks 1 to 3 run on. One file, two consumers: `train-minigpt.py --idioma en` imports it
# to produce `minigpt.en.json`, and the cells load it with
# `exec(open_url("/courses/llm-agents/minigpt.en.py").read())`. That way the forward pass
# the student reads is, line for line, the one that produced the weights they load.
#
# Conventions from the first course (dl-nlp, lesson 41): `softmax` subtracts the maximum,
# causal attention masks with -inf, the batch comes first in every shape, and the
# functions are named as they are there (`forward`, `backward`, `ffn`, `layer_norm`).
# Decisions fixed here: pre-LN (the norm before each sublayer, like GPT-2), learnt
# positions, ReLU in the FFN (as in the first course), tied input and output
# embeddings, no biases in the attention projections.
# NumPy only: nothing Pyodide 0.29.3 (Python 3.13, numpy 2.2.5) does not ship.
import json
import numpy as np

CONFIG = {"n_v": 512, "T_ctx": 64, "d_model": 64, "h": 4, "d_ff": 256, "n_layers": 2}


def softmax(Z):
    """Softmax over the last axis, subtracting the maximum so it cannot overflow."""
    P = np.exp(Z - Z.max(axis=-1, keepdims=True))
    return P / P.sum(axis=-1, keepdims=True)


def layer_norm(X, g, b, eps=1e-5):
    """Normalises each vector (last axis) and rescales it with g and b. Returns (Y, cache)."""
    mu = X.mean(axis=-1, keepdims=True)
    sd = np.sqrt(X.var(axis=-1, keepdims=True) + eps)
    Xn = (X - mu) / sd
    return g * Xn + b, (Xn, sd, g)


def layer_norm_backward(dY, cache):
    """The backward pass of layer_norm: (dX, dg, db)."""
    Xn, sd, g = cache
    axes = tuple(range(dY.ndim - 1))                 # all but the last: batch and position
    dXn = dY * g
    dX = (dXn - dXn.mean(axis=-1, keepdims=True)
          - Xn * (dXn * Xn).mean(axis=-1, keepdims=True)) / sd
    return dX, (dY * Xn).sum(axis=axes), dY.sum(axis=axes)


def windows(ids, B, T, rng):
    """B random windows of T+1 tokens: X = the first T, Y = the same shifted by one."""
    starts = rng.integers(0, len(ids) - T - 1, size=B)
    W = np.stack([ids[i:i + T + 1] for i in starts])
    return W[:, :-1], W[:, 1:]


class MiniGPT:
    def __init__(self, cfg=CONFIG, seed=0):
        self.cfg = c = dict(cfg)
        rng = np.random.default_rng(seed)
        d, d_ff, L = c["d_model"], c["d_ff"], c["n_layers"]
        normal = lambda *shape: rng.normal(size=shape) * 0.02
        # One flat dictionary: the weights of layer l carry the prefix "l."
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

    def n_parameters(self):
        return sum(v.size for v in self.p.values())

    # ── forward ──────────────────────────────────────────────────────────────────
    def attention(self, H, l):
        """Causal multi-head self-attention of layer l over H (B, T, d). Returns (output, cache)."""
        p, B, T, d = self.p, *H.shape
        h = self.cfg["h"]
        d_k = d // h
        Hn, cn = layer_norm(H, p[f"{l}.ln1_g"], p[f"{l}.ln1_b"])
        Q, K, V = [M.reshape(B, T, h, d_k).transpose(0, 2, 1, 3)       # (B, h, T, d_k)
                   for M in np.split(Hn @ p[f"{l}.Wqkv"], 3, axis=-1)]
        S = Q @ K.transpose(0, 1, 3, 2) / np.sqrt(d_k)                  # (B, h, T, T)
        S = np.where(np.tril(np.ones((T, T), dtype=bool)), S, -np.inf)  # causal: only the past
        A = softmax(S)
        O = (A @ V).transpose(0, 2, 1, 3).reshape(B, T, d)              # the heads, concatenated
        return O @ p[f"{l}.Wo"], (cn, Hn, Q, K, V, A, O)

    def ffn(self, H, l):
        """The position-wise perceptron of layer l. Returns (output, cache)."""
        p = self.p
        Hn, cn = layer_norm(H, p[f"{l}.ln2_g"], p[f"{l}.ln2_b"])
        U = Hn @ p[f"{l}.W1"] + p[f"{l}.b1"]
        R = np.maximum(0.0, U)
        return R @ p[f"{l}.W2"] + p[f"{l}.b2"], (cn, Hn, U, R)

    def forward(self, X):
        """Logits (B, T, n_v) for X (B, T) of ids, and the cache the backward pass needs."""
        p, (B, T) = self.p, X.shape
        H = p["E"][X] + p["P"][:T]                                      # token + position
        cache = []
        for l in range(self.cfg["n_layers"]):
            A, ca = self.attention(H, l)
            H = H + A                                                   # residual
            F, cf = self.ffn(H, l)
            H = H + F
            cache.append((ca, cf))
        Hn, cn = layer_norm(H, p["lnf_g"], p["lnf_b"])
        return Hn @ p["E"].T, (X, cache, cn, Hn)                        # output tied to E

    # ── backward ─────────────────────────────────────────────────────────────────
    def attention_backward(self, dY, l, cache, g):
        p, (B, T, d) = self.p, dY.shape
        h = self.cfg["h"]
        d_k = d // h
        cn, Hn, Q, K, V, A, O = cache
        g[f"{l}.Wo"] = O.reshape(-1, d).T @ dY.reshape(-1, d)
        dO = (dY @ p[f"{l}.Wo"].T).reshape(B, T, h, d_k).transpose(0, 2, 1, 3)
        dA = dO @ V.transpose(0, 1, 3, 2)
        dV = A.transpose(0, 1, 3, 2) @ dO
        dS = A * (dA - (dA * A).sum(axis=-1, keepdims=True)) / np.sqrt(d_k)   # softmax, backwards
        dQ, dK = dS @ K, dS.transpose(0, 1, 3, 2) @ Q
        dQKV = np.concatenate([M.transpose(0, 2, 1, 3).reshape(B, T, d) for M in (dQ, dK, dV)], axis=-1)
        g[f"{l}.Wqkv"] = Hn.reshape(-1, d).T @ dQKV.reshape(-1, 3 * d)
        dH, g[f"{l}.ln1_g"], g[f"{l}.ln1_b"] = layer_norm_backward(dQKV @ p[f"{l}.Wqkv"].T, cn)
        return dH

    def ffn_backward(self, dY, l, cache, g):
        p, d, d_ff = self.p, self.cfg["d_model"], self.cfg["d_ff"]
        cn, Hn, U, R = cache
        g[f"{l}.W2"] = R.reshape(-1, d_ff).T @ dY.reshape(-1, d)
        g[f"{l}.b2"] = dY.sum(axis=(0, 1))
        dU = (dY @ p[f"{l}.W2"].T) * (U > 0)                            # the derivative of ReLU
        g[f"{l}.W1"] = Hn.reshape(-1, d).T @ dU.reshape(-1, d_ff)
        g[f"{l}.b1"] = dU.sum(axis=(0, 1))
        dH, g[f"{l}.ln2_g"], g[f"{l}.ln2_b"] = layer_norm_backward(dU @ p[f"{l}.W1"].T, cn)
        return dH

    def loss(self, X, Y, weight=None):
        """Mean cross-entropy per token between the logits of X and the labels Y (B, T).

        `weight` (B, T) weighs each position: 0 leaves it out of the loss (SFT: only the
        answer). Returns (loss, gradients) with the same keys as self.p.
        """
        Z, (X, cache, cn, Hn) = self.forward(X)
        B, T, n_v = Z.shape
        if weight is None:
            weight = np.ones((B, T))
        weight = weight / weight.sum()
        logP = Z - Z.max(axis=-1, keepdims=True)
        logP = logP - np.log(np.exp(logP).sum(axis=-1, keepdims=True))   # stable log-softmax
        b, t = np.indices((B, T))
        loss = -(logP[b, t, Y] * weight).sum()
        dZ = np.exp(logP)                                               # softmax - one-hot, weighted
        dZ[b, t, Y] -= 1.0
        dZ *= weight[..., None]
        g = {"E": dZ.reshape(-1, n_v).T @ Hn.reshape(-1, self.cfg["d_model"])}
        dH, g["lnf_g"], g["lnf_b"] = layer_norm_backward(dZ @ self.p["E"], cn)
        for l in reversed(range(self.cfg["n_layers"])):
            ca, cf = cache[l]
            dH = dH + self.ffn_backward(dH, l, cf, g)
            dH = dH + self.attention_backward(dH, l, ca, g)
        np.add.at(g["E"], X, dH)                                        # the other side of the tie
        g["P"] = np.zeros_like(self.p["P"])
        g["P"][:T] = dH.sum(axis=0)
        return loss, g

    # ── sampling ─────────────────────────────────────────────────────────────────
    def generate(self, prompt, n, temperature=1.0, top_k=None, top_p=None, rng=None):
        """Continues `prompt` (a list of ids) with n tokens and returns the whole list.

        temperature=0 is greedy decoding; top_k and top_p trim the distribution before
        sampling. `rng` is an np.random.Generator (fix the seed outside).
        """
        ids = list(prompt)
        for _ in range(n):
            z = self.forward(np.array([ids[-self.cfg["T_ctx"]:]]))[0][0, -1]
            ids.append(sample(z, temperature, top_k, top_p, rng))
        return ids

    # ── save and load ────────────────────────────────────────────────────────────
    def save(self, decimals=4):
        """The model as JSON text: the configuration and the rounded weights."""
        weights = {k: (np.round(v, decimals) + 0.0).tolist() for k, v in self.p.items()}
        return json.dumps({"config": self.cfg, "weights": weights}, separators=(",", ":"))

    @classmethod
    def load(cls, text):
        """The inverse of save: a MiniGPT from the JSON (a string)."""
        d = json.loads(text)
        m = cls.__new__(cls)
        m.cfg = d["config"]
        m.p = {k: np.array(v, dtype=float) for k, v in d["weights"].items()}
        return m


def sample(z, temperature=1.0, top_k=None, top_p=None, rng=None):
    """One id from a vector of logits z (n_v,)."""
    if temperature == 0:
        return int(np.argmax(z))                                        # greedy
    p = softmax(z / temperature)
    if top_k is not None:
        p = np.where(p >= np.sort(p)[-top_k], p, 0.0)                   # only the k most likely
    if top_p is not None:
        order = np.argsort(-p)
        cumulative = np.cumsum(p[order])
        p[order[cumulative - p[order] >= top_p]] = 0.0                  # outside the nucleus
    return int(rng.choice(len(p), p=p / p.sum()))


class Adam:
    """Adam over a dictionary of weights. One object per training run."""

    def __init__(self, p, eta=1e-3, beta1=0.9, beta2=0.999, eps=1e-8):
        self.eta, self.beta1, self.beta2, self.eps, self.t = eta, beta1, beta2, eps, 0
        self.m = {k: np.zeros_like(v) for k, v in p.items()}
        self.v = {k: np.zeros_like(v) for k, v in p.items()}

    def step(self, p, g, eta=None):
        self.t += 1
        eta = self.eta if eta is None else eta
        for k in p:
            self.m[k] = self.beta1 * self.m[k] + (1 - self.beta1) * g[k]
            self.v[k] = self.beta2 * self.v[k] + (1 - self.beta2) * g[k] ** 2
            m_hat = self.m[k] / (1 - self.beta1 ** self.t)
            v_hat = self.v[k] / (1 - self.beta2 ** self.t)
            p[k] -= eta * m_hat / (np.sqrt(v_hat) + self.eps)
