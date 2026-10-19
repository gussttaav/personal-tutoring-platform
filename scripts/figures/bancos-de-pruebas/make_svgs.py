"""BLOG-18 — Figures for the blog post `bancos-de-pruebas`.

Run from this directory: python3 make_svgs.py ../../../public/blog/bancos-de-pruebas
-> writes *.svg (es) and *.en.svg, and prints every number the body quotes. Pure Python, no
dependencies: the measured figures read public/blog/bancos-de-pruebas/ejemplos/resultados/mmlu.json,
which the post's own script, ejemplos/medir_mmlu.py, writes (that one needs PyTorch and runs the
models; this one only draws).

Three kinds of numbers, never mixed in one figure:
  - cited:    the Hugging Face table of eight models under three MMLU implementations
              (huggingface.co/blog/open-llm-leaderboard-mmlu, 23-06-2023), copied below as HF_TABLE;
  - computed: the margin of a difference between two versions on the same 200 questions, from
              the formula the body states;
  - measured: SmolLM2-360M and Qwen2.5-0.5B on 570 MMLU questions (resultados/mmlu.json).

The MMLU question and its options stay in ENGLISH in both locales: they are the text the models
scored. The Spanish figures translate only the labels."""
import json, math, os, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; LINE = "#3b3b3e"
WARN = "#e8a24c"; BAD = "#ffb4ab"; BLUE = "#6fb1e8"
FONT = "ui-sans-serif, system-ui, sans-serif"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .bx {{ fill: none; stroke: {LINE}; stroke-width: 1; }}
  .bx.m {{ stroke: {ACC}; fill: rgba(78,222,163,0.08); }}
  .bx.w {{ stroke: {WARN}; fill: rgba(232,162,76,0.08); }}
  .bx.x {{ stroke: {BAD}; fill: rgba(255,180,171,0.08); }}
  .lb {{ font-size: 12px; font-weight: 600; }}
  .tx {{ font-size: 11px; }}
  .tx.d {{ fill: {MUTED}; }}
  .tk {{ font-size: 10.5px; fill: {MUTED}; }}
  .hd {{ font-size: 10px; fill: {MUTED}; letter-spacing: 0.1em; }}
  .big {{ font-size: 13px; font-weight: 600; }}
  .gr {{ stroke: {GRID}; stroke-width: 1; }}
  .ax {{ stroke: {MUTED}; stroke-width: 1; }}
  .ch {{ stroke: {MUTED}; stroke-width: 1; stroke-dasharray: 4 4; }}
  .cv {{ fill: none; stroke-width: 2; stroke-linejoin: round; }}
</style>"""


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def svg(w, h, aria, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img"\n'
            ' aria-label="%s">\n%s\n%s\n</svg>\n'
            % (w, h, w, h, esc(aria).replace('"', "&quot;"), STYLE, "\n".join(body)))


def text(x, y, s, cls="tx", anchor=None, fill=None, weight=None):
    st = []
    if anchor:
        st.append("text-anchor:%s" % anchor)
    if fill:
        st.append("fill:%s" % fill)
    if weight:
        st.append("font-weight:%s" % weight)
    a = ' style="%s"' % ";".join(st) if st else ""
    return '<text class="%s" x="%.1f" y="%.1f"%s>%s</text>' % (cls, x, y, a, esc(s))


def line(x1, y1, x2, y2, cls="gr", stroke=None, width=None):
    st = []
    if stroke:
        st.append("stroke:%s" % stroke)
    if width:
        st.append("stroke-width:%s" % width)
    a = ' style="%s"' % ";".join(st) if st else ""
    return '<line class="%s" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"%s/>' % (cls, x1, y1, x2, y2, a)


def num(v, es, d=1):
    s = "%.*f" % (d, v)
    return s.replace(".", ",") if es else s


def pct(v, es, d=1):
    return (num(v, es, d) + " %") if es else (num(v, es, d) + "%")


# ─── cited: eight models, three implementations of MMLU (Hugging Face, June 2023) ───────────────

# (label, original, HELM, Harness), as fractions, in the blog's table order.
HF_TABLE = [
    ("LLaMA 65B", 0.636, 0.637, 0.488),
    ("Falcon 40B", 0.558, 0.571, 0.527),
    ("LLaMA 30B", 0.584, 0.583, 0.457),
    ("GPT-NeoX 20B", 0.262, 0.256, 0.333),
    ("LLaMA 13B", 0.470, 0.471, 0.377),
    ("LLaMA 7B", 0.351, 0.339, 0.342),
    ("Falcon 7B", 0.254, 0.278, 0.350),
    ("RedPajama 7B", 0.269, 0.275, 0.340),
]
HIGHLIGHT = {"LLaMA 65B": ACC, "Falcon 40B": WARN}


def ranks(col):
    order = sorted(HF_TABLE, key=lambda r: -r[col])
    return {r[0]: i + 1 for i, r in enumerate(order)}


def fig_clasificacion_cambia(es):
    px, py, W, H = 150, 46, 440, 300
    v0, v1 = 0.20, 0.70
    cols = [1, 2, 3]
    X = lambda c: px + (c - 1) / 2 * W
    Y = lambda v: py + H - (v - v0) / (v1 - v0) * H
    heads = (["código original", "HELM", "LM Evaluation Harness"] if es
             else ["original code", "HELM", "LM Evaluation Harness"])
    subs = (["la letra más probable", "lo que escribe", "la opción entera"] if es
            else ["most likely letter", "what it writes", "the whole option"])
    b = []
    for v in (0.2, 0.3, 0.4, 0.5, 0.6, 0.7):
        b.append(line(px - 10, Y(v), px + W + 10, Y(v)))
    b.append(line(px - 10, Y(0.25), px + W + 10, Y(0.25), "ch"))
    b.append(text(px + W + 14, Y(0.25) + 4, "azar: 25 %" if es else "chance: 25%", "tk"))
    for c, h, s in zip(cols, heads, subs):
        b.append(text(X(c), 16, h, "lb", "middle"))
        b.append(text(X(c), 31, s, "tk", "middle"))
        b.append(line(X(c), py - 6, X(c), py + H + 6, "ax"))
    # muted lines first, highlighted on top
    for row in sorted(HF_TABLE, key=lambda r: r[0] in HIGHLIGHT):
        name = row[0]
        color = HIGHLIGHT.get(name, MUTED)
        w = 2.4 if name in HIGHLIGHT else 1.2
        pts = " ".join("%.1f,%.1f" % (X(c), Y(row[c])) for c in cols)
        b.append('<polyline class="cv" stroke="%s" stroke-width="%.1f" points="%s"/>' % (color, w, pts))
        for c in cols:
            b.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>' % (X(c), Y(row[c]), 3.4 if name in HIGHLIGHT else 2.4, color))
    # labels: left of the first column and right of the last, nudged apart when they collide
    for col, anchor, dx in ((1, "end", -10), (3, "start", 10)):
        last = None
        for r in sorted(HF_TABLE, key=lambda r: -r[col]):  # top to bottom
            y = Y(r[col]) + 4
            if last is not None and y - last < 12.5:
                y = last + 12.5
            last = y
            lab = ("%s  %s" % (r[0], pct(r[col] * 100, es)) if col == 1
                   else "%s  %s" % (pct(r[col] * 100, es), r[0]))
            b.append(text(X(col) + dx, y, lab, "tx", anchor, fill=HIGHLIGHT.get(r[0], TXT),
                          weight=600 if r[0] in HIGHLIGHT else None))
    if es:
        aria = ("Ocho modelos abiertos y su nota en MMLU con tres programas distintos que corrigen el mismo "
                "examen, según Hugging Face en junio de 2023, unidos por líneas. Con el código original, que "
                "mira la letra más probable, LLaMA 65B saca un 63,6 % y es el primero; Falcon 40B, un 55,8 %, el "
                "tercero. Con HELM, que mira lo que escribe el modelo, casi lo mismo: 63,7 % y 57,1 %. Con el LM "
                "Evaluation Harness, que mira la probabilidad de la opción entera, LLaMA 65B baja al 48,8 % y "
                "Falcon 40B, con un 52,7 %, pasa a ser el primero. Los modelos más débiles, que con el código "
                "original están cerca del 25 % que da el azar, suben hasta el 33 o el 35 % con el Harness.")
    else:
        aria = ("Eight open models and their MMLU score under three different programs that grade the same exam, "
                "as reported by Hugging Face in June 2023, joined by lines. With the original code, which looks "
                "at the most likely letter, LLaMA 65B scores 63.6% and ranks first; Falcon 40B scores 55.8% and "
                "ranks third. With HELM, which looks at what the model writes, almost the same: 63.7% and 57.1%. "
                "With the LM Evaluation Harness, which looks at the probability of the whole option, LLaMA 65B "
                "drops to 48.8% and Falcon 40B, at 52.7%, takes first place. The weakest models, close to the 25% "
                "of chance with the original code, climb to 33 or 35% with the Harness.")
    return svg(740, py + H + 20, aria, b)


# ─── computed: two versions on the same 200 questions ───────────────────────────────────────────

N_PAIRED = 200
P1, P2 = 0.70, 0.74  # version 1 and version 2: 140 and 148 right


def margin_unpaired(p1, p2, n):
    return 1.96 * math.sqrt(p1 * (1 - p1) / n + p2 * (1 - p2) / n) * 100


def margin_paired(discordant, gain, n):
    """95 % margin, in points, of the mean of d_i ∈ {−1, 0, +1} over n questions, where `discordant`
    questions have d ≠ 0 and their sum is `gain` questions."""
    mean = gain / n
    var = discordant / n - mean ** 2
    return 1.96 * math.sqrt(var / n) * 100


GAIN = round((P2 - P1) * N_PAIRED)  # 8 questions = 4 points
D_MIN = GAIN                          # version 2 fixes 8, breaks none
D_MAX = round((1 - P1) * N_PAIRED) + round((1 - P2) * N_PAIRED)  # 60 + 52: every wrong answer of one is right in the other
D_INDEP = round(N_PAIRED * (P1 * (1 - P2) + (1 - P1) * P2))      # what independent versions would disagree on


def crossing():
    """Smallest number of disagreements at which the margin reaches the 4-point gain."""
    d = D_MIN
    while margin_paired(d + 2, GAIN, N_PAIRED) <= (P2 - P1) * 100:
        d += 2
    return d


def fig_comparacion_pareada(es):
    px, py, W, H = 64, 20, 600, 230
    d0, d1, v0, v1 = 0, 120, 0, 11
    X = lambda d: px + (d - d0) / (d1 - d0) * W
    Y = lambda v: py + H - (v - v0) / (v1 - v0) * H
    b = []
    for d in range(0, 121, 20):
        b.append(line(X(d), py, X(d), py + H))
        b.append(text(X(d), py + H + 16, str(d), "tk", "middle"))
    for v in (0, 2, 4, 6, 8, 10):
        b.append(line(px, Y(v), px + W, Y(v)))
        b.append(text(px - 8, Y(v) + 4, "±%d" % v if v else "0", "tk", "end"))
    gain = (P2 - P1) * 100
    b.append(line(px, Y(gain), px + W, Y(gain), "ch"))
    b.append(text(px + W - 4, Y(gain) - 6,
                  "la ventaja de la versión 2: 4 puntos" if es else "version 2's lead: 4 points", "tx", "end", fill=MUTED))
    pts = []
    for d in range(D_MIN, D_MAX + 1, 2):
        pts.append("%.1f,%.1f" % (X(d), Y(margin_paired(d, GAIN, N_PAIRED))))
    b.append('<polyline class="cv" stroke="%s" points="%s"/>' % (ACC, " ".join(pts)))
    unp = margin_unpaired(P1, P2, N_PAIRED)
    b.append('<circle cx="%.1f" cy="%.1f" r="4" fill="%s"/>' % (X(D_INDEP), Y(unp), WARN))
    b.append(text(X(D_INDEP) - 8, Y(unp) - 10,
                  ("%d desacuerdos: ±%s, como si fueran preguntas distintas" % (D_INDEP, num(unp, es)))
                  if es else ("%d disagreements: ±%s, as if the questions were different" % (D_INDEP, num(unp, es))),
                  "tx", "end", fill=WARN))
    c = crossing()
    mc = margin_paired(c, GAIN, N_PAIRED)
    b.append('<circle cx="%.1f" cy="%.1f" r="4" fill="%s"/>' % (X(c), Y(mc), ACC))
    b.append(text(X(c) + 10, Y(mc) + 18,
                  ("hasta %d desacuerdos, los 4 puntos son una diferencia real" % c) if es
                  else ("up to %d disagreements, the 4 points are a real difference" % c), "tx", fill=ACC))
    xl = ("preguntas en las que las dos versiones no coinciden (de 200)" if es
          else "questions on which the two versions disagree (out of 200)")
    b.append(text(px + W / 2, py + H + 34, xl, "tk", "middle"))
    yl = "margen de la diferencia al 95 %" if es else "95% margin of the difference"
    b.append('<text class="tk" transform="translate(14,%.1f) rotate(-90)" style="text-anchor:middle">%s</text>'
             % (py + H / 2, esc(yl)))
    m20, m12 = margin_paired(20, GAIN, N_PAIRED), margin_paired(12, GAIN, N_PAIRED)
    if es:
        aria = ("Una curva que sube. En horizontal, en cuántas de las 200 preguntas no coinciden dos versiones del "
                "asistente, de 8 a 112. En vertical, el margen de error al 95 %% de la diferencia entre ellas, en "
                "puntos. La versión 1 acierta el 70 %% y la 2, el 74 %%. Si no coinciden en 12 preguntas, el margen "
                "es de ±%s puntos; en 20, de ±%s. Hasta %d desacuerdos, el margen queda por debajo de los 4 puntos "
                "de ventaja y la diferencia es real. Con %d desacuerdos, lo esperable si las dos versiones fallaran "
                "con independencia, el margen es de ±%s, el mismo que si respondieran a preguntas distintas."
                % (num(m12, es), num(m20, es), c, D_INDEP, num(unp, es)))
    else:
        aria = ("A rising curve. Horizontally, on how many of the 200 questions two versions of the assistant "
                "disagree, from 8 to 112. Vertically, the 95%% margin of error of the difference between them, in "
                "points. Version 1 gets 70%% right and version 2, 74%%. If they disagree on 12 questions, the "
                "margin is ±%s points; on 20, ±%s. Up to %d disagreements the margin stays below the 4-point lead "
                "and the difference is real. At %d disagreements, what you'd expect if the two versions failed "
                "independently, the margin is ±%s, the same as if they had answered different questions."
                % (num(m12, es), num(m20, es), c, D_INDEP, num(unp, es)))
    return svg(700, py + H + 44, aria, b)


# ─── measured: two small models, 570 MMLU questions ─────────────────────────────────────────────

RESULTS = os.path.join(HERE, "../../../public/blog/bancos-de-pruebas/ejemplos/resultados/mmlu.json")
MODELS = [("HuggingFaceTB/SmolLM2-360M", "SmolLM2-360M", WARN), ("Qwen/Qwen2.5-0.5B", "Qwen2.5-0.5B", ACC)]
LETTERS = "ABCD"


def load_results():
    with open(RESULTS, encoding="utf-8") as f:
        return json.load(f)


def argmax(xs):
    return max(range(len(xs)), key=lambda j: xs[j])


def softmax(xs):
    m = max(xs)
    e = [math.exp(x - m) for x in xs]
    s = sum(e)
    return [v / s for v in e]


# Each reading: (key, label es, label en, picks(row) -> option index or None for "not a letter").
READINGS = [
    ("letter", "la letra más probable", "most likely letter", lambda r: argmax(r["letter_logp"])),
    ("generate", "lo que escribe", "what it writes",
     lambda r: LETTERS.index(r["top_token"].strip()) if r["top_token"].strip() in LETTERS else None),
    ("option", "la opción entera", "the whole option", lambda r: argmax(r["option_logp"])),
    ("option_norm", "la opción entera, por token", "the whole option, per token",
     lambda r: argmax([lp / nt for lp, nt in zip(r["option_logp"], r["option_tokens"])])),
    ("cloze", "sin opciones, por carácter", "no options shown, per character",
     lambda r: argmax([lp / nc for lp, nc in zip(r["cloze_logp"], r["cloze_chars"])])),
]


def accuracy(rows, pick):
    return sum(pick(r) == r["answer"] for r in rows) / len(rows)


def paired(rows, pick_a, pick_b):
    """(difference b − a in points, 95 % margin in points, questions where exactly one is right)."""
    d = [(pick_b(r) == r["answer"]) - (pick_a(r) == r["answer"]) for r in rows]
    n = len(d)
    mean = sum(d) / n
    var = sum((x - mean) ** 2 for x in d) / (n - 1)
    return mean * 100, 1.96 * math.sqrt(var / n) * 100, sum(1 for x in d if x)


def margin(p, n):
    return 1.96 * math.sqrt(p * (1 - p) / n) * 100


def fig_lecturas_por_modelo(es):
    res = load_results()["models"]
    px, py, W = 250, 40, 420
    row_h = 46
    v0, v1 = 0.15, 0.60
    X = lambda v: px + (v - v0) / (v1 - v0) * W
    H = row_h * len(READINGS)
    b = []
    for v in (0.15, 0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60):
        b.append(line(X(v), py - 8, X(v), py + H, "gr"))
        b.append(text(X(v), py + H + 16, pct(v * 100, es, 0), "tk", "middle"))
    b.append(line(X(0.25), py - 8, X(0.25), py + H, "ch"))
    b.append(text(X(0.25), py - 14, "azar" if es else "chance", "tk", "middle"))
    # legend
    lx = px
    for mid, label, color in MODELS:
        if mid not in res:
            continue
        b.append('<circle cx="%.1f" cy="14" r="4.5" fill="%s"/>' % (lx, color))
        b.append(text(lx + 9, 18, label, "tx", fill=color, weight=600))
        lx += 130
    for i, (key, les, len_, pick) in enumerate(READINGS):
        y = py + i * row_h + row_h / 2
        b.append(text(px - 16, y + 4, les if es else len_, "tx", "end"))
        for k, (mid, label, color) in enumerate(MODELS):
            if mid not in res:
                continue
            rows = res[mid]["questions"]
            a = accuracy(rows, pick)
            mg = margin(a, len(rows)) / 100
            yy = y + (k - 0.5) * 12
            b.append(line(X(a - mg), yy, X(a + mg), yy, stroke=color, width=1.4))
            b.append('<circle cx="%.1f" cy="%.1f" r="4.5" fill="%s"/>' % (X(a), yy, color))
            b.append(text(X(a + mg) + 6, yy + 4, pct(a * 100, es), "tk", fill=color))
    xl = ("aciertos en 570 preguntas de MMLU, con su margen al 95 %" if es
          else "accuracy on 570 MMLU questions, with its 95% margin")
    b.append(text(px + W / 2, py + H + 34, xl, "tk", "middle"))
    acc = {mid: [pct(accuracy(res[mid]["questions"], p) * 100, es) for _, _, _, p in READINGS]
           for mid, _, _ in MODELS if mid in res}
    s, q = acc.get(MODELS[0][0], ["?"] * 5), acc.get(MODELS[1][0], ["?"] * 5)
    if es:
        aria = ("Los aciertos de dos modelos pequeños en las mismas 570 preguntas de MMLU, leyendo su respuesta de "
                "cinco formas, cada uno con su margen de error. Una línea discontinua marca el 25 %% del azar. "
                "SmolLM2-360M: la letra más probable, %s; lo que escribe, %s; la opción entera, %s; la opción entera "
                "por token, %s; sin mostrar las opciones y por carácter, %s. Qwen2.5-0.5B: %s, %s, %s, %s y %s."
                % tuple(s + q))
    else:
        aria = ("The accuracy of two small models on the same 570 MMLU questions, reading their answer in five ways, "
                "each with its margin of error. A dashed line marks the 25%% of chance. SmolLM2-360M: most likely "
                "letter, %s; what it writes, %s; the whole option, %s; the whole option per token, %s; without "
                "showing the options and per character, %s. Qwen2.5-0.5B: %s, %s, %s, %s and %s." % tuple(s + q))
    return svg(740, py + H + 44, aria, b)


def fig_posicion_de_la_clave(es):
    res = load_results()["models"]
    panels = [(mid, label, color) for mid, label, color in MODELS if mid in res]
    pw, ph, gap, py = 330, 200, 50, 52
    v0, v1 = 0, 0.8
    b = []
    descr = []
    for p, (mid, label, color) in enumerate(panels):
        x0 = 40 + p * (pw + gap)
        Y = lambda v: py + ph - (v - v0) / (v1 - v0) * ph
        b.append(text(x0 + pw / 2, 18, label, "lb", "middle", fill=color))
        for v in (0, 0.2, 0.4, 0.6, 0.8):
            b.append(line(x0, Y(v), x0 + pw, Y(v)))
            b.append(text(x0 - 6, Y(v) + 4, pct(v * 100, es, 0), "tk", "end"))
        base = accuracy(res[mid]["questions"], READINGS[0][3])
        b.append(line(x0, Y(base), x0 + pw, Y(base), "ch"))
        bw = pw / 4 * 0.56
        vals = []
        for k in range(4):
            a = sum(r["rotation_pred"][k] == k for r in res[mid]["questions"]) / len(res[mid]["questions"])
            vals.append(a)
            cx = x0 + (k + 0.5) * pw / 4
            b.append('<rect x="%.1f" y="%.1f" width="%.1f" height="%.1f" fill="%s" opacity="0.85" rx="2"/>'
                     % (cx - bw / 2, Y(a), bw, Y(0) - Y(a), color))
            if Y(0) - Y(a) > 28:  # inside the bar, clear of the dashed line
                b.append(text(cx, Y(a) + 16, pct(a * 100, es), "tx", "middle", fill="#131315", weight=600))
            else:
                b.append(text(cx, Y(a) - 6, pct(a * 100, es), "tk", "middle", fill=TXT))
            b.append(text(cx, Y(0) + 16, LETTERS[k], "lb", "middle"))
        b.append(text(x0 + pw / 2, 33, ("discontinua: las opciones en su orden, %s" if es
                                        else "dashed: options in their original order, %s") % pct(base * 100, es),
                      "tk", "middle"))
        descr.append((label, [pct(v * 100, es) for v in vals], pct(base * 100, es)))
    xl = ("letra en la que está la respuesta correcta" if es else "letter the correct answer is moved to")
    b.append(text(370, py + ph + 36, xl, "tk", "middle"))
    if es:
        parts = ["%s acierta un %s con la respuesta correcta en la A, un %s en la B, un %s en la C y un %s en la D, "
                 "y un %s con las opciones en su orden" % (lab, v[0], v[1], v[2], v[3], base) for lab, v, base in descr]
        aria = ("Las mismas 570 preguntas, con las opciones rotadas para que la respuesta correcta quede siempre en la "
                "misma letra, leyendo la letra más probable. " + "; ".join(parts) + ".")
    else:
        parts = ["%s scores %s with the correct answer at A, %s at B, %s at C and %s at D, and %s with the options in "
                 "their original order" % (lab, v[0], v[1], v[2], v[3], base) for lab, v, base in descr]
        aria = ("The same 570 questions, with the options rotated so that the correct answer always sits at the same "
                "letter, reading the most likely letter. " + "; ".join(parts) + ".")
    return svg(40 + len(panels) * pw + (len(panels) - 1) * gap + 20, py + ph + 46, aria, b)


EXAMPLE_I = 3532  # MMLU test index: high school geography, «What family do most European languages belong to?»
EXAMPLE_MODEL = "HuggingFaceTB/SmolLM2-360M"


def example_question():
    """MMLU test question EXAMPLE_I, copied from cais/mmlu (all/test) so this script needs no download;
    fig_tres_lecturas checks its key against the one measure_mmlu.py stored."""
    q = {
        "subject": "high_school_geography",
        "question": "What family do most European languages belong to?",
        "choices": ["Ural-Altaic", "Basque", "Indo-European", "Phoenician"],
        "answer": 2,
    }
    return q


def wrap(s, chars):
    out, cur = [], ""
    for w in s.split():
        if cur and len(cur) + 1 + len(w) > chars:
            out.append(cur); cur = w
        else:
            cur = (cur + " " + w) if cur else w
    if cur:
        out.append(cur)
    return out


def small_pct(p, es):
    return ("< 0,1 %" if es else "< 0.1%") if p < 0.0005 else pct(p * 100, es)


def fig_tres_lecturas(es):
    res = load_results()["models"]
    r = next(x for x in res[EXAMPLE_MODEL]["questions"] if x["i"] == EXAMPLE_I)
    q = example_question()
    assert r["answer"] == q["answer"]
    label = dict((m, l) for m, l, _ in MODELS)[EXAMPLE_MODEL]
    b = []
    # left: the question as the model sees it
    x0 = 24
    b.append(text(x0, 24, "MMLU · HIGH SCHOOL GEOGRAPHY", "hd"))
    y = 50
    for ln in wrap(q["question"], 34):
        b.append(text(x0, y, ln, "big"))
        y += 18
    y += 10
    for k, c in enumerate(q["choices"]):
        key = k == q["answer"]
        b.append(text(x0, y, "%s. %s" % (LETTERS[k], c), "tx", fill=ACC if key else TXT, weight=600 if key else None))
        if key:
            b.append(text(x0 + 150, y, "✓ " + ("la clave" if es else "the key"), "tk", fill=ACC))
        y += 20
    y += 14
    b.append(text(x0, y, label, "lb", fill=WARN))
    b.append(text(x0, y + 16, ("modelo base, cinco ejemplos delante" if es else "base model, five examples first"), "tk"))
    # right: three readings, four bars each (relative probability of the four options)
    readings = [
        (("la letra más probable", "« A» … « D» después de «Answer:»") if es
         else ("most likely letter", "\" A\" … \" D\" after \"Answer:\""), softmax(r["letter_logp"])),
        (("la opción entera", "«A. Ural-Altaic» … «D. Phoenician», con las opciones a la vista") if es
         else ("the whole option", "\"A. Ural-Altaic\" … \"D. Phoenician\", options shown"), softmax(r["option_logp"])),
        (("sin mostrar las opciones", "«Ural-Altaic» … «Phoenician» como continuación") if es
         else ("without showing the options", "\"Ural-Altaic\" … \"Phoenician\" as a continuation"),
         softmax(r["cloze_logp"])),
    ]
    rx, bw_max, top = 330, 250, 26
    for i, ((title, sub), probs) in enumerate(readings):
        yy = top + i * 102
        win = argmax(probs)
        ok = win == q["answer"]
        b.append(text(rx, yy, title, "lb"))
        verdict = (("elige la %s: acierta" if ok else "elige la %s: falla") if es
                   else ("picks %s: right" if ok else "picks %s: wrong")) % LETTERS[win]
        b.append(text(rx + 386, yy, verdict, "tx", "end", fill=ACC if ok else BAD, weight=600))
        b.append(text(rx, yy + 14, sub, "tk"))
        for k, p in enumerate(probs):
            by = yy + 24 + k * 14
            b.append(text(rx + 8, by + 8, LETTERS[k], "tk", "middle"))
            w = max(1.5, p * bw_max)
            color = (ACC if ok else BAD) if k == win else LINE
            b.append('<rect x="%.1f" y="%.1f" width="%.1f" height="9" rx="2" fill="%s"/>' % (rx + 20, by, w, color))
            b.append(text(rx + 26 + w, by + 8, small_pct(p, es), "tk"))
    foot = ("probabilidad de cada opción frente a las otras tres" if es
            else "probability of each option relative to the other three")
    b.append(text(rx + 386, top + 3 * 102 - 8, foot, "tk", "end"))
    L, O, C = readings[0][1], readings[1][1], readings[2][1]
    f = lambda xs: ", ".join("%s %s" % (LETTERS[k], small_pct(v, es)) for k, v in enumerate(xs))
    if es:
        aria = ("Una pregunta de MMLU, de geografía de secundaria: ¿a qué familia pertenecen la mayoría de las lenguas "
                "europeas? Opciones: A, Ural-Altaic; B, Basque; C, Indo-European, la clave; D, Phoenician. Al lado, tres "
                "formas de leer la respuesta de %s, con la probabilidad de cada opción frente a las otras tres. La "
                "letra más probable: %s; elige la B y falla. La opción entera, con las opciones a la vista: %s; elige "
                "la D y falla. Sin mostrar las opciones: %s; elige la C y acierta. El modelo sabe la respuesta, pero "
                "no sabe decirla con una letra." % (label, f(L), f(O), f(C)))
    else:
        aria = ("An MMLU question from high school geography: what family do most European languages belong to? "
                "Options: A, Ural-Altaic; B, Basque; C, Indo-European, the key; D, Phoenician. Beside it, three ways "
                "of reading %s's answer, with the probability of each option relative to the other three. Most likely "
                "letter: %s; it picks B and is wrong. The whole option, with the options shown: %s; it picks D and is "
                "wrong. Without showing the options: %s; it picks C and is right. The model knows the answer but "
                "can't give it as a letter." % (label, f(L), f(O), f(C)))
    return svg(740, top + 3 * 102 + 2, aria, b)


FIGS = {
    "tres-lecturas": fig_tres_lecturas,
    "clasificacion-cambia": fig_clasificacion_cambia,
    "comparacion-pareada": fig_comparacion_pareada,
    "lecturas-por-modelo": fig_lecturas_por_modelo,
    "posicion-de-la-clave": fig_posicion_de_la_clave,
}

if __name__ == "__main__":
    for name, fn in FIGS.items():
        for es, suffix in ((True, ".svg"), (False, ".en.svg")):
            with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
                f.write(fn(es))
    for col, label in ((1, "original"), (2, "HELM"), (3, "Harness")):
        print(label, ranks(col))
    print("unpaired 70 vs 74, n = 200: ±%.2f" % margin_unpaired(P1, P2, N_PAIRED))
    for d in (8, 12, 17, 20, 30, D_INDEP, D_MAX):
        print("paired, %3d disagreements: ±%.2f" % (d, margin_paired(d, GAIN, N_PAIRED)))
    print("crossing at", crossing(), "disagreements; independent:", D_INDEP)
    res = load_results()["models"]
    for mid, label, _ in MODELS:
        rows, s = res[mid]["questions"], res[mid]["summary"]
        print("%s (%d questions, %d uncached prompts, %d s)" % (label, len(rows), res[mid]["uncached_prompts"], res[mid]["seconds"]))
        for key, _, len_, pick in READINGS:
            a_ = accuracy(rows, pick)
            assert abs(a_ - s[key]) < 1e-6, (key, a_, s[key])  # the stored summary is rounded to 6 decimals
            print("  %-34s %5.1f%%  ±%.1f" % (len_, a_ * 100, margin(a_, len(rows))))
        nos = lambda r: argmax(r["nospace_logp"])
        print("  no-space letters: %.1f%%; vs letter: %+.1f ± %.1f (%d disagree)"
              % (accuracy(rows, nos) * 100, *paired(rows, READINGS[0][3], nos)))
        print("  cloze vs letter: %+.1f ± %.1f (%d disagree)" % paired(rows, READINGS[0][3], READINGS[4][3]))
        print("  mass on the four letters: %.1f%%; top token a letter in %d of %d"
              % (s["letter_mass_mean"] * 100, sum(r["top_token"].strip() in LETTERS for r in rows), len(rows)))
        picks = [sum(argmax(r["letter_logp"]) == k for r in rows) for k in range(4)]
        print("  letter picks A-D:", picks, "; key share in the sample:", [round(v * 100, 1) for v in s["key_share"]])
        print("  key moved to A-D:", [round(v * 100, 1) for v in s["rotation_acc"]],
              "; answers per letter:", [round(v * 100, 1) for v in s["rotation_pred_share"]])
        rot = [sum(r["rotation_pred"][k] == k for r in rows) / len(rows) for k in range(4)]
        hi, lo = argmax(rot), argmax([-v for v in rot])
        d = [(r["rotation_pred"][hi] == hi) - (r["rotation_pred"][lo] == lo) for r in rows]
        mean = sum(d) / len(d)
        var = sum((x - mean) ** 2 for x in d) / (len(d) - 1)
        print("  key at its best letter (%s) vs its worst (%s): %+.1f ± %.1f"
              % (LETTERS[hi], LETTERS[lo], mean * 100, 1.96 * math.sqrt(var / len(d)) * 100))
        ex = next(r for r in rows if r["i"] == EXAMPLE_I)
        print("  example: letter", [round(v * 100, 1) for v in softmax(ex["letter_logp"])],
              "option", [round(v * 100, 1) for v in softmax(ex["option_logp"])],
              "cloze", [round(v * 100, 1) for v in softmax(ex["cloze_logp"])])
    S, Q = res[MODELS[0][0]]["questions"], res[MODELS[1][0]]["questions"]
    for key, _, len_, pick in READINGS:
        d = [(pick(q) == q["answer"]) - (pick(s) == s["answer"]) for s, q in zip(S, Q)]
        n = len(d); mean = sum(d) / n; var = sum((x - mean) ** 2 for x in d) / (n - 1)
        print("Qwen2.5 - SmolLM2, %-34s %+.1f ± %.1f (%d disagree)"
              % (len_, mean * 100, 1.96 * math.sqrt(var / n) * 100, sum(1 for x in d if x)))
    print("wrote", len(FIGS) * 2, "files to", OUT)
