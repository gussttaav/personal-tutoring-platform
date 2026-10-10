"""BLOG-14 — Figures for the blog post `evaluar-texto-generado`. The overlap scores (word F1 and
ROUGE-L) and the error margins are computed here, from the texts and formulas the article states;
nothing is measured with a model and nothing is drawn by hand.

Run from this directory: python3 make_svgs.py ../../../public/blog/evaluar-texto-generado
-> writes *.svg (es) and *.en.svg, and prints every number the body quotes. Pure Python, no
dependencies.

The four answers and the reference are SPANISH in both locales: they are the data being scored,
and a translation would change the scores. The English figures translate only the labels.

Tokenisation: lower-case, then every run of word characters (`\\w+`, Unicode) is a word, so
punctuation is dropped and «Sí» == «sí». Word F1 counts shared words as a multiset (each word
counts as many times as it appears in both); ROUGE-L uses the longest common subsequence (shared
words in the same order, not necessarily adjacent). Both are F1 = 2PR / (P + R).

If an answer or the reference changes, the body quotes the scores too: B 0,81 / 0,81 · D 0,54 /
0,52 · A 0,40 / 0,36 · C 0,30 / 0,30, and «22 de 27» (B) and «9 de 27» (A) in the overlap figure.
The margins: ±12,7 (n = 50), ±6,4 (200), ±2,8 (1 000), ±0,76 (14 042), all at p = 0,7."""
import math, os, re, sys
from collections import Counter

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

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
  .m {{ fill: {ACC}; }}
  .w {{ fill: {WARN}; }}
  .x {{ fill: {BAD}; }}
  .gr {{ stroke: {GRID}; stroke-width: 1; }}
  .ax {{ stroke: {MUTED}; stroke-width: 1; }}
  .ar {{ fill: none; stroke: {MUTED}; stroke-width: 1.2; marker-end: url(#a); }}
  .cv {{ fill: none; stroke-width: 2; stroke-linejoin: round; }}
</style>"""

DEFS = ('<defs><marker id="a" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" '
        f'orient="auto-start-reverse"><path d="M0,0.5 L7.5,4 L0,7.5 z" fill="{MUTED}"/></marker></defs>')


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def svg(w, h, aria, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img"\n'
            ' aria-label="%s">\n%s\n%s\n%s\n</svg>\n'
            % (w, h, w, h, esc(aria).replace('"', "&quot;"), STYLE, DEFS, "\n".join(body)))


def text(x, y, s, cls="tx", anchor=None, fill=None):
    st = []
    if anchor:
        st.append("text-anchor:%s" % anchor)
    if fill:
        st.append("fill:%s" % fill)
    a = ' style="%s"' % ";".join(st) if st else ""
    return '<text class="%s" x="%.1f" y="%.1f"%s>%s</text>' % (cls, x, y, a, esc(s))


def box(x, y, w, h, cls="", rx=6):
    return '<rect class="bx %s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%d"/>' % (cls, x, y, w, h, rx)


def wrap(s, chars):
    """Greedy word wrap by character count (the fonts are proportional; the counts are tuned per
    column by eye, and the article never depends on where a line breaks)."""
    out, cur = [], ""
    for w in s.split():
        if cur and len(cur) + 1 + len(w) > chars:
            out.append(cur); cur = w
        else:
            cur = (cur + " " + w) if cur else w
    if cur:
        out.append(cur)
    return out


def num(v, es, d=2):
    s = "%.*f" % (d, v)
    return s.replace(".", ",") if es else s


def thousands(n, es):
    s = "{:,}".format(n)
    return s.replace(",", " ") if es else s


# ─── the data: the question, the reference and the four answers ─────────────────────────────────

QUESTION = "¿El cliente de la incidencia 4812 tiene derecho a reembolso?"
REF = ("Sí. El plan Equipo da 30 días desde el cobro anual, que se hizo el 14 de agosto, así que el "
       "plazo acaba el 13 de septiembre.")
ANSWERS = [
    ("A", True, "Puede pedirlo: con su plan dispone de treinta días desde que se le cobró la renovación, "
                "es decir, hasta el 13 de septiembre."),
    ("B", False, "No. El plan Equipo da 14 días desde el cobro anual, que se hizo el 14 de agosto, así que "
                 "el plazo acabó el 28 de agosto."),
    ("C", True, "Sí, hasta el 13 de septiembre."),
    ("D", True, "¡Buena pregunta! Sí, el cliente tiene derecho al reembolso. Ferretería Ortega tiene "
                "contratado el plan Equipo, cuyas condiciones dan 30 días desde el cobro a las suscripciones "
                "anuales. El cobro se hizo el 14 de agosto, así que el plazo acaba el 13 de septiembre y la "
                "solicitud del 2 de septiembre llegó a tiempo. Te recomiendo tramitarlo cuanto antes. "
                "¡Espero que te sirva de ayuda!"),
]


def words(s):
    return re.findall(r"\w+", s)


def toks(s):
    return [w.lower() for w in words(s)]


def f1(overlap, n_cand, n_ref):
    if not overlap:
        return 0.0
    p, r = overlap / n_cand, overlap / n_ref
    return 2 * p * r / (p + r)


def lcs_mask(a, b):
    """Longest common subsequence of token lists a and b; returns (length, mask over a)."""
    d = [[0] * (len(b) + 1) for _ in range(len(a) + 1)]
    for i in range(len(a) - 1, -1, -1):
        for j in range(len(b) - 1, -1, -1):
            d[i][j] = d[i + 1][j + 1] + 1 if a[i] == b[j] else max(d[i + 1][j], d[i][j + 1])
    mask, i, j = [False] * len(a), 0, 0
    while i < len(a) and j < len(b):
        if a[i] == b[j]:
            mask[i] = True; i += 1; j += 1
        elif d[i + 1][j] >= d[i][j + 1]:
            i += 1
        else:
            j += 1
    return d[0][0], mask


R = toks(REF)
SCORES = {}
for letter, ok, ans in ANSWERS:
    c = toks(ans)
    overlap = sum((Counter(c) & Counter(R)).values())
    l, mask = lcs_mask(c, R)
    SCORES[letter] = dict(n=len(c), overlap=overlap, lcs=l, mask=mask,
                          f1=f1(overlap, len(c), len(R)), rl=f1(l, len(c), len(R)))

# 95 % margin of an accuracy p measured on n questions, in percentage points (normal approximation)
def margin(p, n):
    return 196 * math.sqrt(p * (1 - p) / n)


MARGIN_N = (50, 200, 1000, 14042)


# ─── 1. cuatro-respuestas ───────────────────────────────────────────────────────────────────────

def fig_cuatro_respuestas(es):
    L = dict(
        q="PREGUNTA" if es else "QUESTION",
        ref="REFERENCIA, ESCRITA POR EL EQUIPO DE SOPORTE" if es else "REFERENCE, WRITTEN BY THE SUPPORT TEAM",
        ans="RESPUESTA" if es else "ANSWER",
        ok="¿ES CIERTA?" if es else "IS IT TRUE?",
        f1="F1 DE PALABRAS" if es else "WORD F1",
        rl="ROUGE-L",
        yes="cierta" if es else "true",
        no="falsa" if es else "false",
        more="… (%d palabras)" if es else "… (%d words)",
    )
    W = 740
    b = []
    b.append(text(0, 12, L["q"], "hd"))
    b.append(text(0, 30, QUESTION, "big"))
    b.append(text(0, 56, L["ref"], "hd"))
    ref_lines = wrap(REF, 112)
    for i, ln in enumerate(ref_lines):
        b.append(text(0, 74 + i * 15, ln, "tx"))
    y0 = 74 + len(ref_lines) * 15 + 18
    # column heads
    XT, XOK, XF, XR, BW = 26, 420, 500, 620, 80
    b.append(text(XT, y0, L["ans"], "hd"))
    b.append(text(XOK, y0, L["ok"], "hd"))
    b.append(text(XF, y0, L["f1"], "hd"))
    b.append(text(XR, y0, L["rl"], "hd"))
    y = y0 + 12
    for letter, ok, ans in ANSWERS:
        s = SCORES[letter]
        lines = wrap(ans, 66)
        if len(lines) > 2:
            lines = [lines[0], lines[1] + " " + L["more"] % s["n"]]
        rh = max(2, len(lines)) * 15 + 14
        b.append('<line class="gr" x1="0" y1="%.1f" x2="%d" y2="%.1f"/>' % (y, W, y))
        cy = y + rh / 2
        b.append(text(0, cy + 5, letter, "big", fill=ACC if ok else BAD))
        for i, ln in enumerate(lines):
            b.append(text(XT, cy - (len(lines) - 1) * 7.5 + i * 15 + 4, ln, "tx"))
        b.append(box(XOK, cy - 10, 58, 20, "m" if ok else "x", rx=10))
        b.append(text(XOK + 29, cy + 4, L["yes"] if ok else L["no"], "tx", "middle", ACC if ok else BAD))
        for x, v in ((XF, s["f1"]), (XR, s["rl"])):
            b.append('<rect x="%.1f" y="%.1f" width="%.1f" height="12" fill="%s" opacity="0.25" rx="2"/>' % (x, cy - 6, BW, LINE))
            b.append('<rect x="%.1f" y="%.1f" width="%.1f" height="12" fill="%s" rx="2"/>'
                     % (x, cy - 6, BW * v, ACC if ok else BAD))
            b.append(text(x + BW + 6, cy + 4, num(v, es), "tx"))
        y += rh
    b.append('<line class="gr" x1="0" y1="%.1f" x2="%d" y2="%.1f"/>' % (y, W, y))

    sc = lambda k: (num(SCORES[k]["f1"], es), num(SCORES[k]["rl"], es))
    if es:
        aria = ("Una pregunta, una respuesta de referencia y cuatro respuestas puntuadas contra ella. La pregunta: "
                "¿el cliente de la incidencia 4812 tiene derecho a reembolso? La referencia, escrita por el equipo "
                "de soporte, dice que sí: el plan Equipo da 30 días desde el cobro anual del 14 de agosto, así que "
                "el plazo acaba el 13 de septiembre. La respuesta A, cierta, lo dice con otras palabras: F1 de "
                "palabras %s, ROUGE-L %s. B, falsa, copia la referencia y cambia cinco palabras para decir que no, "
                "con 14 días y el 28 de agosto: %s y %s, la puntuación más alta. C, cierta, sólo dice sí, hasta el "
                "13 de septiembre: %s y %s, la más baja. D, cierta, lo explica todo en %d palabras con un saludo y una "
                "despedida: %s y %s. Las dos medidas ponen primera la única respuesta falsa."
                % (sc("A") + sc("B") + sc("C") + (SCORES["D"]["n"],) + sc("D")))
    else:
        aria = ("A question, a reference answer and four answers scored against it, all in Spanish. The question: "
                "is the customer in ticket 4812 entitled to a refund? The reference, written by the support team, "
                "says yes: the Team plan gives 30 days from the annual charge on 14 August, so the deadline is "
                "13 September. Answer A, true, says it in other words: word F1 %s, ROUGE-L %s. B, false, copies the "
                "reference and changes five words to say no, with 14 days and 28 August: %s and %s, the highest "
                "score. C, true, only says yes, until 13 September: %s and %s, the lowest. D, true, explains "
                "everything in %d words with a greeting and a sign-off: %s and %s. Both measures put the only "
                "false answer first."
                % (sc("A") + sc("B") + sc("C") + (SCORES["D"]["n"],) + sc("D")))
    return svg(W, int(y) + 2, aria, b)


# ─── 2. solapamiento ────────────────────────────────────────────────────────────────────────────

def chips(x0, y0, maxw, ws, mask, b):
    """Lay words out as chips, wrapping at maxw; mask None = neutral, else True/False per word."""
    x, y, ch, gap = x0, y0, 20, 4
    for i, w in enumerate(ws):
        cw = len(w) * 6.4 + 12
        if x + cw > x0 + maxw:
            x, y = x0, y + ch + gap
        if mask is None:
            cls, fill = "", TXT
        elif mask[i]:
            cls, fill = "m", ACC
        else:
            cls, fill = "x", BAD
        b.append(box(x, y, cw, ch, cls, rx=4))
        b.append(text(x + cw / 2, y + 14, w, "tx", "middle", fill))
        x += cw + gap
    return y + ch


def fig_solapamiento(es):
    W, LX, CX = 740, 0, 128
    b = []
    rows = [
        ("Referencia" if es else "Reference", None, REF, None),
        ("B · falsa" if es else "B · false", "B", TEXT_BY["B"], False),
        ("A · cierta" if es else "A · true", "A", TEXT_BY["A"], True),
    ]
    y = 4
    for label, letter, s, ok in rows:
        ws = words(s)
        mask = None if letter is None else SCORES[letter]["mask"]
        b.append(text(LX, y + 14, label, "lb", fill=TXT if ok is None else (ACC if ok else BAD)))
        if letter:
            sc = SCORES[letter]
            b.append(text(LX, y + 30, ("%d de %d en orden" if es else "%d of %d in order") % (sc["lcs"], len(R)), "tk"))
            b.append(text(LX, y + 44, "ROUGE-L " + num(sc["rl"], es), "tk"))
        else:
            b.append(text(LX, y + 30, ("%d palabras" if es else "%d words") % len(R), "tk"))
        bottom = chips(CX, y, W - CX, ws, mask, b)
        y = max(bottom, y + 48) + 16
    # legend
    b.append(box(CX, y, 14, 14, "m", rx=3))
    b.append(text(CX + 20, y + 11, "en la referencia, en el mismo orden" if es else "in the reference, in the same order", "tx d"))
    b.append(box(CX + 260, y, 14, 14, "x", rx=3))
    b.append(text(CX + 280, y + 11, "fuera de esa secuencia" if es else "outside that sequence", "tx d"))
    y += 18

    sb, sa = SCORES["B"], SCORES["A"]
    if es:
        aria = ("Las palabras de la referencia y de dos respuestas, una por casilla, sin puntuación. En verde, las "
                "palabras de cada respuesta que forman la secuencia más larga en común con la referencia, en el "
                "mismo orden; en rojo, las demás. La respuesta B, falsa, tiene %d de las %d palabras de la "
                "referencia en orden: sólo se salen no, 14, acabó, 28 y agosto, justo las palabras que la vuelven "
                "falsa. ROUGE-L %s. La respuesta A, cierta, sólo tiene %d en orden, porque dice lo mismo con otras "
                "palabras: «puede pedirlo» por «sí», «treinta» por «30», «la renovación» por «el cobro anual». "
                "ROUGE-L %s."
                % (sb["lcs"], len(R), num(sb["rl"], es), sa["lcs"], num(sa["rl"], es)))
    else:
        aria = ("The words of the reference and of two answers, one per box, without punctuation, all in Spanish. "
                "In green, each answer's words that form the longest sequence shared with the reference, in the "
                "same order; in red, the rest. Answer B, false, has %d of the reference's %d words in order: the "
                "only ones out are no, 14, acabó, 28 and agosto, exactly the words that make it false. ROUGE-L %s. "
                "Answer A, true, has only %d in order, because it says the same thing in other words: “puede pedirlo” "
                "for “sí”, “treinta” for “30”, “la renovación” for “el cobro anual”. ROUGE-L %s."
                % (sb["lcs"], len(R), num(sb["rl"], es), sa["lcs"], num(sa["rl"], es)))
    return svg(W, int(y) + 2, aria, b)


TEXT_BY = {letter: ans for letter, _, ans in ANSWERS}


# ─── 3. cuatro-jueces ───────────────────────────────────────────────────────────────────────────

JUDGES = {
    True: dict(
        left="sólo respuestas que se pueden prever", right="cualquier respuesta",
        steps=("RECIBE", "HACE", "DEVUELVE", "CON A, B, C Y D"),
        cols=[
            ("Una referencia", "la respuesta y otra escrita de antemano", "cuenta palabras en común",
             "un número de 0 a 1", None, "la falsa, primera", "x"),
            ("Un programa", "la respuesta", "extrae el sí o el no y la fecha, y los compara",
             "pasa o no pasa", "A ✓  B ✗  C ✓  D ✓", "acierta en lo que comprueba, y sólo en eso", "m"),
            ("Una persona", "dos respuestas, o una y una escala", "lee y elige",
             "una preferencia", None, "acierta si conoce el plan Equipo; si no, B suena tan segura como A", "w"),
            ("Otro modelo", "pregunta, respuesta e instrucciones", "lee, razona y puntúa",
             "un veredicto y su motivo", None, "acierta si le das las condiciones del plan; tiende a preferir D, la más larga", "w"),
        ],
    ),
    False: dict(
        left="only answers that can be foreseen", right="any answer",
        steps=("TAKES", "DOES", "RETURNS", "ON A, B, C AND D"),
        cols=[
            ("A reference", "the answer and one written in advance", "counts shared words",
             "a number from 0 to 1", None, "the false one comes first", "x"),
            ("A program", "the answer", "extracts the yes or no and the date, and compares them",
             "pass or fail", "A ✓  B ✗  C ✓  D ✓", "right about what it checks, and only that", "m"),
            ("A person", "two answers, or one and a scale", "reads and picks",
             "a preference", None, "right if they know the Team plan; if not, B sounds as sure as A", "w"),
            ("Another model", "question, answer and instructions", "reads, reasons and scores",
             "a verdict and its reason", None, "right if given the plan's terms; tends to prefer D, the longest", "w"),
        ],
    ),
}


def fig_cuatro_jueces(es):
    J = JUDGES[es]
    CW, GAP, W = 176, 12, 740
    b = []
    # the axis: what each judge can be pointed at
    b.append('<path class="ar" d="M%.1f,10 L%.1f,10"/>' % (W / 2 - 40, 4))
    b.append('<path class="ar" d="M%.1f,10 L%.1f,10"/>' % (W / 2 + 40, W - 4))
    b.append(text(8, 26, J["left"], "tk"))
    b.append(text(W - 8, 26, J["right"], "tk", "end"))
    y0 = 48
    last = 0
    ref_scores = "  ".join("%s %s" % (k, num(SCORES[k]["rl"], es)) for k in ("B", "D", "A", "C"))
    for i, (name, takes, does, returns, verdict, note, cls) in enumerate(J["cols"]):
        x = i * (CW + GAP)
        cx = x + CW / 2
        b.append(text(cx, y0, name, "lb", "middle"))
        y = y0 + 12
        for k, (head, body) in enumerate(((J["steps"][0], takes), (J["steps"][1], does), (J["steps"][2], returns))):
            lines = wrap(body, 27)
            h = 22 + len(lines) * 14
            b.append(box(x, y, CW, h, ""))
            b.append(text(x + 10, y + 15, head, "hd"))
            for j, ln in enumerate(lines):
                b.append(text(x + 10, y + 30 + j * 14, ln, "tx"))
            y += h
            if k < 2:
                b.append('<path class="ar" d="M%.1f,%.1f L%.1f,%.1f"/>' % (cx, y + 1, cx, y + 13))
                y += 14
        y += 14
        if i == 0:
            verdict = ref_scores
        lines = wrap(note, 27)
        h = 22 + (16 if verdict else 0) + len(lines) * 14 + 4
        b.append(box(x, y, CW, h, cls))
        b.append(text(x + 10, y + 15, J["steps"][3], "hd"))
        yy = y + 30
        if verdict:
            b.append(text(x + 10, yy, verdict, "tx", fill={"m": ACC, "x": BAD, "w": WARN}[cls]))
            yy += 16
        for j, ln in enumerate(lines):
            b.append(text(x + 10, yy + j * 14, ln, "tx", fill={"m": ACC, "x": BAD, "w": WARN}[cls]))
        last = max(last, y + h)
    H = int(last) + 4

    if es:
        aria = ("Cuatro columnas, una por juez, de izquierda a derecha, sobre una flecha que va de juzgar sólo "
                "respuestas que se pueden prever a juzgar cualquier respuesta. Una referencia recibe la respuesta "
                "y otra escrita de antemano, cuenta palabras en común y devuelve un número de 0 a 1; con las cuatro "
                "respuestas, %s: la falsa, primera. Un programa recibe la respuesta, extrae el sí o el no y la "
                "fecha y los compara, y devuelve pasa o no pasa; aprueba las respuestas A, C y D y suspende la B: acierta en lo que "
                "comprueba, y sólo en eso. Una persona recibe dos respuestas, o una y una escala, lee y elige, y "
                "devuelve una preferencia; acierta si conoce el plan Equipo, y si no, B suena tan segura como A. "
                "Otro modelo recibe la pregunta, la respuesta e instrucciones, lee, razona y puntúa, y devuelve un "
                "veredicto y su motivo; acierta si le das las condiciones del plan, y tiende a preferir D, la más "
                "larga." % ref_scores.replace("  ", ", "))
    else:
        aria = ("Four columns, one per judge, from left to right, above an arrow that runs from judging only "
                "answers that can be foreseen to judging any answer. A reference takes the answer and one written "
                "in advance, counts shared words and returns a number from 0 to 1; on the four answers, %s: the "
                "false one comes first. A program takes the answer, extracts the yes or no and the date and "
                "compares them, and returns pass or fail; it passes answers A, C and D and fails B: right about what it "
                "checks, and only that. A person takes two answers, or one and a scale, reads and picks, and "
                "returns a preference; they are right if they know the Team plan, and if not, B sounds as sure "
                "as A. Another model takes the question, the answer and instructions, reads, reasons and scores, "
                "and returns a verdict and its reason; it is right if given the plan's terms, and tends to prefer "
                "D, the longest." % ref_scores.replace("  ", ", "))
    return svg(W, H, aria, b)


# ─── 4. barras-de-error ─────────────────────────────────────────────────────────────────────────

def fig_barras_de_error(es):
    px, py, W, H = 64, 16, 630, 220
    n0, n1, v0, v1 = 10, 20000, 0, 30
    X = lambda n: px + (math.log10(n) - math.log10(n0)) / (math.log10(n1) - math.log10(n0)) * W
    Y = lambda v: py + H - (v - v0) / (v1 - v0) * H
    b = []
    for n in (10, 100, 1000, 10000):
        b.append('<line class="gr" x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>' % (X(n), py, X(n), py + H))
        b.append(text(X(n), py + H + 16, thousands(n, es), "tk", "middle"))
    for v in (0, 10, 20, 30):
        b.append('<line class="gr" x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>' % (px, Y(v), px + W, Y(v)))
        b.append(text(px - 8, Y(v) + 4, "±%d" % v if v else "0", "tk", "end"))
    b.append('<line class="ax" x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>' % (px, Y(0), px + W, Y(0)))
    pts = []
    for i in range(241):
        n = 10 ** (math.log10(n0) + i / 240 * (math.log10(n1) - math.log10(n0)))
        v = margin(0.7, n)
        if v <= v1:
            pts.append("%.1f,%.1f" % (X(n), Y(v)))
    b.append('<polyline class="cv" stroke="%s" points="%s"/>' % (ACC, " ".join(pts)))
    for n in MARGIN_N:
        v = margin(0.7, n)
        d = 2 if v < 1 else 1
        b.append('<circle cx="%.1f" cy="%.1f" r="3.6" fill="%s"/>' % (X(n), Y(v), ACC))
        lab = "%s: ±%s" % (thousands(n, es), num(v, es, d))
        if n == 14042:
            lab += " (MMLU)"
            b.append(text(X(n) - 6, Y(v) - 10, lab, "tx", "end"))
        else:
            b.append(text(X(n) + 8, Y(v) - 6, lab, "tx"))
    note = ("cuatro veces más preguntas, la mitad de margen" if es else "four times the questions, half the margin")
    b.append(text(X(1000) + 10, Y(16), note, "tx", fill=MUTED))
    xl = "número de preguntas (escala logarítmica)" if es else "number of questions (log scale)"
    b.append(text(px + W / 2, py + H + 34, xl, "tk", "middle"))
    yl = "margen al 95 %, en puntos" if es else "95% margin, in points"
    b.append('<text class="tk" transform="translate(14,%.1f) rotate(-90)" style="text-anchor:middle">%s</text>'
             % (py + H / 2, esc(yl)))

    m = [num(margin(0.7, n), es, 2 if margin(0.7, n) < 1 else 1) for n in MARGIN_N]
    if es:
        aria = ("Una curva que baja. En horizontal, el número de preguntas de una prueba, en escala logarítmica, "
                "de 10 a 20 000. En vertical, el margen de error al 95 %% de un modelo que acierta el 70 %%, en "
                "puntos. Con 50 preguntas, ±%s; con 200, ±%s; con 1 000, ±%s; con las 14 042 preguntas de MMLU, "
                "±%s. Cuatro veces más preguntas dejan el margen en la mitad." % tuple(m))
    else:
        aria = ("A falling curve. Horizontally, the number of questions in a test, on a log scale, from 10 to "
                "20,000. Vertically, the 95%% margin of error, in points, of a model that gets 70%% right. With 50 "
                "questions, ±%s; with 200, ±%s; with 1,000, ±%s; with MMLU's 14,042 questions, ±%s. Four times the "
                "questions halve the margin." % tuple(m))
    return svg(726, py + H + 44, aria, b)


FIGS = {
    "cuatro-respuestas": fig_cuatro_respuestas,
    "solapamiento": fig_solapamiento,
    "cuatro-jueces": fig_cuatro_jueces,
    "barras-de-error": fig_barras_de_error,
}

for name, fn in FIGS.items():
    for es, suffix in ((True, ".svg"), (False, ".en.svg")):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(fn(es))

print("reference: %d words" % len(R))
for letter, ok, _ in ANSWERS:
    s = SCORES[letter]
    print("%s (%s): %2d words, %2d shared, LCS %2d, F1 %.2f, ROUGE-L %.2f"
          % (letter, "true " if ok else "false", s["n"], s["overlap"], s["lcs"], s["f1"], s["rl"]))
for n in MARGIN_N:
    print("p = 0.7, n = %5d: ±%.2f points" % (n, margin(0.7, n)))
d = 196 * math.sqrt(0.7 * 0.3 / 200 + 0.74 * 0.26 / 200)
print("70%% vs 74%% on 200 independent questions each: difference ±%.2f points" % d)
print("wrote", len(FIGS) * 2, "files to", OUT)
