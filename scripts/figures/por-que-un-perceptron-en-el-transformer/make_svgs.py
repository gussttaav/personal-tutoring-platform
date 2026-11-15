"""BLOG-26 — Figures for the blog post `por-que-un-perceptron-en-el-transformer`.
Run from this directory: python3 make_svgs.py ../../../public/blog/por-que-un-perceptron-en-el-transformer
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies. Same style helpers as
scripts/figures/ia-y-problema-de-la-parada/make_svgs.py.

No measurements: two diagrams and one curve computed from a formula.
  - `dos-mitades` (the post's cover): what each sublayer reads. Attention writes into row t a
    mix of every row; the position-wise perceptron takes each row alone, widens it to d_ff
    and brings it back to d_model, with the same W1 and W2 for every row.
  - `memoria-clave-valor`: one attention head and the perceptron written as the same
    "keys, weights, values" sum. Attention: T keys taken from the text, softmax weights.
    Perceptron: d_ff keys stored in W1 (its columns), ReLU coefficients (many exactly 0),
    values stored in W2 (its rows).
  - `reparto-de-flops`: the perceptron's share of one layer's forward FLOPs for the token at
    position T (a full-attention layer, no GQA, d_ff = 4 d_model, multiply-add = 2 FLOPs):
      projections Q, K, V, O: 4 x 2 d^2 = 8 d^2;  scores q.k and the weighted sum: 2 x 2 T d = 4 T d;
      perceptron: 2 x 2 d d_ff = 16 d^2.
    share = 16 d^2 / (24 d^2 + 4 T d) = 4 d / (6 d + T): 2/3 for short texts, 1/2 at T = 2 d.
    Curves for d = 768, 4 096 and 12 288 (BERT-base / GPT-2 small, a 7B-class model, GPT-3).

Every figure's aria-label is the `alt` of its <img> in content/blog/{es,en}/por-que-un-perceptron-en-el-transformer.mdx,
word for word: change one, change the other."""
import math
import os
import sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; LINE = "#3b3b3e"
WARN = "#e8a24c"; BAD = "#ffb4ab"; SURF = "#131315"
FONT = "ui-sans-serif, system-ui, sans-serif"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .bx {{ fill: none; stroke: {MUTED}; stroke-width: 1; }}
  .bx.m {{ stroke: {ACC}; fill: rgba(78,222,163,0.08); }}
  .bx.w {{ stroke: {WARN}; fill: rgba(232,162,76,0.10); }}
  .bx.g {{ stroke: {LINE}; }}
  .bx.z {{ stroke: {LINE}; stroke-dasharray: 2 2; }}
  .lb {{ font-size: 12px; font-weight: 600; text-anchor: middle; }}
  .sb {{ font-size: 10.5px; fill: {MUTED}; text-anchor: middle; }}
  .tx {{ font-size: 11px; }}
  .hd {{ font-size: 10px; fill: {MUTED}; letter-spacing: 0.1em; }}
  .m {{ fill: {ACC}; }}
  .w {{ fill: {WARN}; }}
  .ln {{ fill: none; stroke: {MUTED}; stroke-width: 1.2; }}
  .ln.m {{ stroke: {ACC}; stroke-width: 2; }}
  .ln.w {{ stroke: {WARN}; stroke-width: 2; }}
  .ln.t {{ stroke: {TXT}; stroke-width: 2; }}
  .ln.g {{ stroke: {GRID}; stroke-width: 1; }}
  .ln.d {{ stroke: {MUTED}; stroke-dasharray: 4 3; }}
  .ar {{ fill: none; stroke: {MUTED}; stroke-width: 1.2; marker-end: url(#a); }}
  .ar.m {{ stroke: {ACC}; marker-end: url(#am); }}
  .ar.w {{ stroke: {WARN}; marker-end: url(#aw); }}
</style>"""

DEFS = "<defs>" + "".join(
    f'<marker id="{i}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
    f'<path d="M0,0.5 L7.5,4 L0,7.5 z" fill="{c}"/></marker>'
    for i, c in (("a", MUTED), ("am", ACC), ("aw", WARN))) + "</defs>"


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def svg(w, h, aria, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img"\n'
            ' aria-label="%s">\n%s\n%s\n%s\n</svg>\n'
            % (w, h, w, h, esc(aria).replace('"', "&quot;"), STYLE, DEFS, "\n".join(body)))


def box(x, y, w, h, cls="", rx=4):
    return '<rect class="bx %s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%d"/>' % (cls, x, y, w, h, rx)


def text(x, y, s, cls="tx", anchor=None):
    a = ' style="text-anchor:%s"' % anchor if anchor else ""
    return '<text class="%s" x="%.1f" y="%.1f"%s>%s</text>' % (cls, x, y, a, esc(s))


def lines(x, y, rows, cls="tx", anchor=None, step=14):
    return "\n".join(text(x, y + i * step, r, cls, anchor) for i, r in enumerate(rows))


def path(pts, cls="ln"):
    d = "M" + " L".join("%.1f,%.1f" % p for p in pts)
    return '<path class="%s" d="%s"/>' % (cls, d)


def curve(p0, p1, p2, cls="ar"):
    return '<path class="%s" d="M%.1f,%.1f Q%.1f,%.1f %.1f,%.1f"/>' % (cls, *p0, *p1, *p2)


def write(name, es_svg, en_svg):
    for suffix, content in ((".svg", es_svg), (".en.svg", en_svg)):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(content)


# ─── 1. dos-mitades ───────────────────────────────────────────────────────────────────────────

ARIA_DOS = {
    True: "Dos paneles, cada uno con las mismas cinco filas de la matriz de entrada, una por posición del "
          "texto, apiladas de arriba abajo. A la izquierda, la atención: flechas que salen de las cinco filas "
          "convergen en la fila 3, que recibe una media ponderada de todas; es lo único del bloque que mueve "
          "información de una posición a otra. A la derecha, el perceptrón por posiciones: cada fila, sola, se "
          "ensancha de d_model a d_ff coordenadas, pasa por la ReLU y vuelve a d_model, sin flechas entre filas "
          "y con las mismas dos matrices, W1 y W2, para todas.",
    False: "Two panels, each with the same five rows of the input matrix, one per position of the text, stacked "
           "from top to bottom. On the left, attention: arrows leaving all five rows converge on row 3, which "
           "receives a weighted average of all of them; it is the only part of the block that moves "
           "information from one position to another. On the right, the position-wise perceptron: each row, "
           "on its own, widens from d_model to d_ff coordinates, goes through the ReLU and comes back to "
           "d_model, with no arrows between rows and the same two matrices, W1 and W2, for all of them.",
}


def fig_dos(es):
    L = {True: dict(ha="ATENCIÓN: MEZCLA FILAS", hf="PERCEPTRÓN: TRANSFORMA CADA FILA",
                    na=["la fila 3 recibe una media", "ponderada de las cinco"],
                    nf=["cada fila sola, con los", "mismos W1 y W2 para todas"],
                    row="fila"),
         False: dict(ha="ATTENTION: MIXES ROWS", hf="PERCEPTRON: TRANSFORMS EACH ROW",
                     na=["row 3 receives a weighted", "average of all five"],
                     nf=["each row alone, with the", "same W1 and W2 for all"],
                     row="row")}[es]
    b = []
    ys = [62 + i * 34 for i in range(5)]
    rh = 22
    # left: attention
    b.append(text(190, 30, L["ha"], "hd m", "middle"))
    for i, y in enumerate(ys):
        b.append(box(40, y, 90, rh, "g"))
        b.append(text(85, y + 15, "%s %d" % (L["row"], i + 1), "sb"))
        cls = "m" if i == 2 else "g"
        b.append(box(250, y, 90, rh, cls))
        b.append(text(295, y + 15, "%s %d" % (L["row"], i + 1), "sb" if i != 2 else "lb m"))
    tgt = (248, ys[2] + rh / 2)
    for i, y in enumerate(ys):
        src = (132, y + rh / 2)
        mid = ((src[0] + tgt[0]) / 2, (src[1] + tgt[1]) / 2 + (0 if i == 2 else 0))
        b.append(curve(src, mid, tgt, "ar m" if i == 2 else "ar"))
    b.append(lines(190, 248, L["na"], "sb", "middle"))
    # divider
    b.append(path([(380, 24), (380, 266)], "ln g"))
    # right: perceptron
    b.append(text(575, 30, L["hf"], "hd w", "middle"))
    for i, y in enumerate(ys):
        b.append(box(420, y, 70, rh, "g"))
        b.append(text(455, y + 15, "d_model", "sb"))
        b.append(path([(492, y + rh / 2), (520, y + rh / 2)], "ar w"))
        b.append(box(522, y - 4, 106, rh + 8, "w"))
        b.append(text(575, y + 15, "d_ff · ReLU", "sb"))
        b.append(path([(630, y + rh / 2), (658, y + rh / 2)], "ar w"))
        b.append(box(660, y, 70, rh, "g"))
        b.append(text(695, y + 15, "d_model", "sb"))
    b.append(text(506, ys[0] - 10, "W1", "tx w", "middle"))
    b.append(text(644, ys[0] - 10, "W2", "tx w", "middle"))
    b.append(lines(575, 248, L["nf"], "sb", "middle"))
    return svg(760, 280, ARIA_DOS[es], b)


# ─── 2. memoria-clave-valor ───────────────────────────────────────────────────────────────────

ARIA_MEM = {
    True: "Dos filas con la misma estructura de izquierda a derecha: una entrada, unas claves con las que se "
          "compara, unos pesos y una suma de valores. Arriba, una cabeza de atención: la consulta de la fila t "
          "se compara con T claves que salen del propio texto, una por posición; el softmax convierte las T "
          "puntuaciones en pesos positivos que suman uno, y la salida es la suma de los T valores, también "
          "sacados del texto, con esos pesos. Abajo, el perceptrón por posiciones: la fila t se compara con "
          "d_ff claves guardadas en los parámetros, las columnas de W1, iguales para cualquier texto; la ReLU "
          "deja cada coeficiente en cero o en un número positivo, sin normalizar, y la salida es la suma de "
          "d_ff valores guardados en las filas de W2, con esos coeficientes. Muchos coeficientes son cero, y "
          "sus valores no entran en la suma.",
    False: "Two rows with the same structure from left to right: an input, some keys it is compared with, "
           "some weights and a sum of values. At the top, one attention head: the query of row t is compared "
           "with T keys taken from the text itself, one per position; the softmax turns the T scores into "
           "positive weights that add up to one, and the output is the sum of the T values, also taken from "
           "the text, with those weights. At the bottom, the position-wise perceptron: row t is compared with "
           "d_ff keys stored in the parameters, the columns of W1, the same for any text; the ReLU leaves "
           "each coefficient at zero or at a positive number, unnormalised, and the output is the sum of "
           "d_ff values stored in the rows of W2, with those coefficients. Many coefficients are zero, and "
           "their values do not enter the sum.",
}


def fig_mem(es):
    L = {True: dict(ha="UNA CABEZA DE ATENCIÓN", hf="EL PERCEPTRÓN POR POSICIONES",
                    qa="consulta de t", qf="fila t",
                    ka="T claves", kas="del texto", kf="d_ff claves", kfs="columnas de W1",
                    wa="softmax", was="suman 1", wf="ReLU", wfs="≥ 0, muchos 0",
                    va="T valores", vas="del texto", vf="d_ff valores", vfs="filas de W2",
                    sa="salida", sf="salida",
                    na="lo que se lee cambia con cada texto",
                    nf="lo que se lee está escrito en los pesos"),
         False: dict(ha="ONE ATTENTION HEAD", hf="THE POSITION-WISE PERCEPTRON",
                     qa="query of t", qf="row t",
                     ka="T keys", kas="from the text", kf="d_ff keys", kfs="columns of W1",
                     wa="softmax", was="add up to 1", wf="ReLU", wfs="≥ 0, many 0",
                     va="T values", vas="from the text", vf="d_ff values", vfs="rows of W2",
                     sa="output", sf="output",
                     na="what is read changes with every text",
                     nf="what is read is written in the weights")}[es]
    b = []

    def row(y, head, hcls, q, k, ks, w, ws, v, vs, s, note, cls, zero):
        out = [text(40, y - 14, head, "hd " + hcls)]
        out.append(box(40, y, 100, 40, "g"))
        out.append(text(90, y + 24, q, "lb"))
        out.append(path([(142, y + 20), (168, y + 20)], "ar"))
        out.append(box(170, y, 130, 40, cls))
        out.append(text(235, y + 17, k, "lb " + hcls))
        out.append(text(235, y + 31, ks, "sb"))
        out.append(path([(302, y + 20), (328, y + 20)], "ar"))
        out.append(box(330, y, 120, 40, cls))
        out.append(text(390, y + 17, w, "lb " + hcls))
        out.append(text(390, y + 31, ws, "sb"))
        out.append(path([(452, y + 20), (478, y + 20)], "ar"))
        out.append(box(480, y, 130, 40, cls))
        out.append(text(545, y + 17, v, "lb " + hcls))
        out.append(text(545, y + 31, vs, "sb"))
        out.append(path([(612, y + 20), (638, y + 20)], "ar"))
        out.append(box(640, y, 80, 40, "g"))
        out.append(text(680, y + 24, s, "lb"))
        # little bars: the weights
        bars = zero
        bx0 = 340
        for i, hgt in enumerate(bars):
            x = bx0 + i * 11
            if hgt == 0:
                out.append(path([(x, y + 62), (x + 7, y + 62)], "ln"))
            else:
                out.append('<rect class="%s" x="%.1f" y="%.1f" width="7" height="%.1f"/>'
                           % (hcls, x, y + 62 - hgt, hgt))
        out.append(text(380, y + 78, note, "sb", "middle"))
        return out

    b += row(46, L["ha"], "m", L["qa"], L["ka"], L["kas"], L["wa"], L["was"], L["va"], L["vas"], L["sa"],
             L["na"], "m", [4, 14, 6, 3, 9, 2, 5, 3, 1])
    b += row(170, L["hf"], "w", L["qf"], L["kf"], L["kfs"], L["wf"], L["wfs"], L["vf"], L["vfs"], L["sf"],
             L["nf"], "w", [0, 12, 0, 0, 7, 0, 16, 0, 4])
    return svg(760, 262, ARIA_MEM[es], b)


# ─── 3. reparto-de-flops ──────────────────────────────────────────────────────────────────────

ARIA_FLOPS = {
    True: "Gráfica de líneas. En el eje horizontal, la posición del token en el texto, T, en escala "
          "logarítmica de 256 a 131 072. En el vertical, la fracción de las operaciones de una capa que hace "
          "el perceptrón por posiciones, de 0 a 100 %. Tres curvas, una por anchura del modelo: d_model igual "
          "a 768, a 4 096 y a 12 288. Las tres empiezan cerca de dos tercios, 67 %, y bajan al crecer T; cada "
          "una cruza el 50 % exactamente en T igual a dos veces d_model: en 1 536, en 8 192 y en 24 576. Con "
          "d_model igual a 768 y T igual a 131 072 el perceptrón queda en el 2 %; con 12 288, en el 24 %.",
    False: "Line chart. On the horizontal axis, the position of the token in the text, T, on a logarithmic "
           "scale from 256 to 131,072. On the vertical axis, the fraction of one layer's operations done by "
           "the position-wise perceptron, from 0 to 100%. Three curves, one per model width: d_model equal to "
           "768, to 4,096 and to 12,288. All three start near two thirds, 67%, and fall as T grows; each "
           "crosses 50% exactly at T equal to twice d_model: at 1,536, at 8,192 and at 24,576. With d_model "
           "equal to 768 and T equal to 131,072 the perceptron is down to 2%; with 12,288, to 24%.",
}


def share(d, t):
    return 4 * d / (6 * d + t)


def fig_flops(es):
    W, H = 720, 330
    x0, x1, y0, y1 = 70, 600, 280, 40
    lo, hi = math.log2(256), math.log2(131072)

    def X(t):
        return x0 + (math.log2(t) - lo) / (hi - lo) * (x1 - x0)

    def Y(f):
        return y0 - f * (y0 - y1)

    b = []
    for f in (0, 0.25, 0.5, 0.75, 1.0):
        b.append(path([(x0, Y(f)), (x1, Y(f))], "ln g" if f != 0.5 else "ln d"))
        b.append(text(x0 - 8, Y(f) + 4, "%d %%" % round(f * 100) if es else "%d%%" % round(f * 100), "sb", "end"))
    for p in range(8, 18):
        t = 2 ** p
        b.append(path([(X(t), y0), (X(t), y0 + 4)], "ln"))
        lab = ("{:,}".format(t).replace(",", " ") if es else "{:,}".format(t))
        if p % 2 == 0 or p == 17:
            b.append(text(X(t), y0 + 18, lab, "sb"))
    b.append(text((x0 + x1) / 2, y0 + 40, "T (posición del token, escala logarítmica)" if es
                  else "T (position of the token, log scale)", "sb"))
    b.append(text(x0, y1 - 14, "parte de las operaciones de la capa que hace el perceptrón" if es
                  else "share of the layer's operations done by the perceptron", "sb", "start"))
    b.append(path([(x0, Y(2 / 3)), (x1, Y(2 / 3))], "ln g"))
    b.append(text(x1 - 4, Y(2 / 3) - 6, "2/3", "sb", "end"))
    series = ((768, "ln t", "tx", TXT), (4096, "ln m", "tx m", ACC), (12288, "ln w", "tx w", WARN))
    for d, cls, tcls, col in series:
        pts = []
        t = 256.0
        while t <= 131072 * 1.0001:
            pts.append((X(t), Y(share(d, t))))
            t *= 2 ** 0.125
        b.append(path(pts, cls))
        b.append('<circle fill="%s" cx="%.1f" cy="%.1f" r="3.5"/>' % (col, X(2 * d), Y(0.5)))
        lab = "d_model = " + ("{:,}".format(d).replace(",", " ") if es else "{:,}".format(d))
        b.append(text(x1 + 8, Y(share(d, 131072)) + 4, lab, tcls, "start"))
    b.append(text(x0 + 8, Y(0.5) + 16, "50 %: T = 2 · d_model" if es else "50%: T = 2 · d_model", "sb", "start"))
    return svg(W, H, ARIA_FLOPS[es], b)


write("dos-mitades", fig_dos(True), fig_dos(False))
write("memoria-clave-valor", fig_mem(True), fig_mem(False))
write("reparto-de-flops", fig_flops(True), fig_flops(False))
print("ok")
