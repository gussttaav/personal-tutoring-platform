"""BLOG-11 — Figures for the blog post `similitud-coseno`. Every number on them is computed here
from the formulas the article states (1 − cos θ, the chord √(2 − 2 cos θ), the angle θ and the
bound 2s² − 1); nothing is measured and nothing is drawn by hand.

Run from this directory: python3 make_svgs.py ../../../public/blog/similitud-coseno
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

If a value printed on a figure changes, the body quotes it too: 0,29 / 0,59 / 1,00 (the three
vectors at 0°, 45°, 90°) and 0,62 / 0,28 / −0,02 (the bound at s = 0,9 / 0,8 / 0,7)."""
import math, sys, os

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; LINE = "#3b3b3e"
WARN = "#e8a24c"; BLUE = "#6fb1e8"; BAD = "#ffb4ab"
FONT = "ui-sans-serif, system-ui, sans-serif"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .lbl {{ font-size: 12px; font-weight: 600; }}
  .sub {{ font-size: 11px; fill: {MUTED}; }}
  .tx {{ font-size: 12px; }}
  .tk {{ font-size: 10.5px; fill: {MUTED}; }}
  .big {{ font-size: 13px; font-weight: 600; }}
  .ax {{ stroke: {MUTED}; stroke-width: 1; }}
  .gr {{ stroke: {GRID}; stroke-width: 1; }}
  .arc {{ fill: none; stroke: {LINE}; stroke-width: 1.2; stroke-dasharray: 3 3; }}
  .vec {{ stroke-width: 2; }}
  .cv {{ fill: none; stroke-width: 2; stroke-linejoin: round; }}
</style>"""


def svg(w, h, aria, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img"\n aria-label="%s">\n%s\n%s\n</svg>\n'
            % (w, h, w, h, aria.replace('"', "&quot;"), STYLE, body))


def num(v, es, d=2):
    s = "%.*f" % (d, v)
    if s.startswith("-"):
        s = "−" + s[1:]
    return s.replace(".", ",") if es else s


def arrow_defs():
    out = []
    for name, col in (("a", ACC), ("w", WARN), ("b", BLUE), ("m", MUTED)):
        out.append('<marker id="h%s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
                   '<path d="M0,0 L10,5 L0,10 z" fill="%s"/></marker>' % (name, col))
    return "<defs>" + "".join(out) + "</defs>"


def vec(x1, y1, x2, y2, col, m):
    return '<line class="vec" stroke="%s" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" marker-end="url(#h%s)"/>' % (col, x1, y1, x2, y2, m)


def arc_path(cx, cy, r, a0, a1):
    """Counter-clockwise arc (maths angles, degrees) on screen coordinates (y down)."""
    x0, y0 = cx + r * math.cos(math.radians(a0)), cy - r * math.sin(math.radians(a0))
    x1, y1 = cx + r * math.cos(math.radians(a1)), cy - r * math.sin(math.radians(a1))
    large = 1 if (a1 - a0) > 180 else 0
    return "M%.1f,%.1f A%.1f,%.1f 0 %d 0 %.1f,%.1f" % (x0, y0, r, r, large, x1, y1)


# ---------------------------------------------------------------- figure 1: three vectors, 1 − cos
def fig_tres_vectores(es):
    ox, oy, R = 50, 240, 190
    pts = {"A": 0, "B": 45, "C": 90}
    body = [arrow_defs(), '<path class="arc" d="%s"/>' % arc_path(ox, oy, R, 0, 90)]
    tips = {}
    for k, a in pts.items():
        x, y = ox + R * math.cos(math.radians(a)), oy - R * math.sin(math.radians(a))
        tips[k] = (x, y)
        body.append(vec(ox, oy, x, y, ACC, "a"))
    body.append('<text class="big" x="%.1f" y="%.1f">A</text>' % (tips["A"][0] + 8, tips["A"][1] + 5))
    body.append('<text class="big" x="%.1f" y="%.1f">B</text>' % (tips["B"][0] + 7, tips["B"][1] - 4))
    body.append('<text class="big" x="%.1f" y="%.1f">C</text>' % (tips["C"][0] + 8, tips["C"][1] + 2))
    # the two 45° angles near the origin
    for a0, a1, r in ((0, 45, 52), (45, 90, 70)):
        body.append('<path d="%s" fill="none" stroke="%s" stroke-width="1.2"/>' % (arc_path(ox, oy, r, a0, a1), MUTED))
        mid = math.radians((a0 + a1) / 2)
        body.append('<text class="tk" x="%.1f" y="%.1f">45°</text>' % (ox + (r + 8) * math.cos(mid), oy - (r + 8) * math.sin(mid) + 4))

    d45, d90 = 1 - math.cos(math.radians(45)), 1 - math.cos(math.radians(90))
    x0 = 330
    title = "1 − cos entre cada par" if es else "1 − cos for each pair"
    rows = [("A y B" if es else "A and B", "1 − cos 45°", d45),
            ("B y C" if es else "B and C", "1 − cos 45°", d45),
            ("A y C" if es else "A and C", "1 − cos 90°", d90)]
    body.append('<text class="lbl" x="%d" y="48">%s</text>' % (x0, title))
    for i, (pair, expr, v) in enumerate(rows):
        y = 78 + i * 26
        body.append('<text class="tx" x="%d" y="%d">%s</text>' % (x0, y, pair))
        body.append('<text class="tx" x="%d" y="%d" fill="%s" style="fill:%s">%s</text>' % (x0 + 70, y, MUTED, MUTED, expr))
        body.append('<text class="tx" x="%d" y="%d" text-anchor="end">%s</text>' % (x0 + 250, y, num(v, es)))
    body.append('<line class="gr" x1="%d" y1="148" x2="%d" y2="148"/>' % (x0, x0 + 360))
    detour = ("Pasando por B: %s + %s = %s" if es else "Going through B: %s + %s = %s") % (num(d45, es), num(d45, es), num(2 * d45, es))
    direct = ("Directo de A a C: %s" if es else "Straight from A to C: %s") % num(d90, es)
    body.append('<text class="tx" x="%d" y="174">%s</text>' % (x0, detour))
    body.append('<text class="tx" x="%d" y="198">%s</text>' % (x0, direct))
    verdict = ("El camino directo mide más que el rodeo." if es else "The direct route is longer than the detour.")
    body.append('<text class="lbl" x="%d" y="230" style="fill:%s">%s</text>' % (x0, BAD, verdict))

    aria = ("Tres vectores de longitud uno, dibujados como flechas que salen del mismo origen: A en horizontal, B a cuarenta y cinco grados "
            "y C en vertical, con un arco discontinuo que une sus puntas. A la derecha, el valor de uno menos el coseno "
            "para cada par: entre A y B, 0,29; entre B y C, 0,29; entre A y C, 1,00. Pasando por B, 0,29 más 0,29 "
            "suman 0,59, y el camino directo de A a C mide 1,00: el camino directo mide más que el rodeo, cosa que "
            "una distancia de verdad nunca permite." if es else
            "Three vectors of length one, drawn as arrows leaving the same origin: A horizontal, B at forty-five degrees and C vertical, "
            "with a dashed arc joining their tips. On the right, one minus the cosine for each pair: between A and B, "
            "0.29; between B and C, 0.29; between A and C, 1.00. Going through B, 0.29 plus 0.29 adds up to 0.59, and "
            "the straight route from A to C measures 1.00: the direct route is longer than the detour, which a true "
            "distance never allows.")
    return svg(726, 262, aria, "\n".join(body))


# ---------------------------------------------------------------- figure 2: arc, chord, gap
def fig_arco_cuerda(es):
    body = [arrow_defs()]
    # left panel: the geometry of one pair, θ = 60°
    ox, oy, R, th = 30, 252, 210, 60
    ax_, ay_ = ox + R, oy
    bx_, by_ = ox + R * math.cos(math.radians(th)), oy - R * math.sin(math.radians(th))
    body.append('<path class="arc" d="%s"/>' % arc_path(ox, oy, R, 0, 90))
    body.append('<path d="%s" fill="none" stroke="%s" stroke-width="3"/>' % (arc_path(ox, oy, R, 0, th), ACC))
    body.append(vec(ox, oy, ax_, ay_, MUTED, "m"))
    body.append(vec(ox, oy, bx_, by_, MUTED, "m"))
    body.append('<line stroke="%s" stroke-width="2.4" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (BLUE, ax_, ay_, bx_, by_))
    body.append('<line stroke="%s" stroke-width="1" stroke-dasharray="3 3" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (MUTED, bx_, by_, bx_, oy))
    body.append('<line stroke="%s" stroke-width="4" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (WARN, bx_, oy + 1, ax_, oy + 1))
    body.append('<path d="%s" fill="none" stroke="%s" stroke-width="1.2"/>' % (arc_path(ox, oy, 34, 0, th), MUTED))
    body.append('<text class="tk" x="%.1f" y="%.1f">θ</text>' % (ox + 40, oy - 14))
    body.append('<text class="big" x="%.1f" y="%.1f">A</text>' % (ax_ + 6, ay_ + 4))
    body.append('<text class="big" x="%.1f" y="%.1f">B</text>' % (bx_ + 4, by_ - 8))
    body.append('<text class="tx" x="%.1f" y="%.1f" style="fill:%s">%s</text>'
                % (ox + R * math.cos(math.radians(30)) + 10, oy - R * math.sin(math.radians(30)), ACC, "arco: θ" if es else "arc: θ"))
    body.append('<text class="tx" x="%.1f" y="%.1f" text-anchor="end" style="fill:%s">%s</text>'
                % ((ax_ + bx_) / 2 - 8, (ay_ + by_) / 2 + 4, BLUE, "cuerda" if es else "chord"))
    body.append('<text class="tx" x="%.1f" y="%.1f" text-anchor="middle" style="fill:%s">1 − cos θ</text>' % ((bx_ + ax_) / 2, oy + 20, WARN))
    body.append('<text class="tk" x="%.1f" y="%.1f" text-anchor="middle">cos θ</text>' % ((ox + bx_) / 2, oy + 20))

    # right panel: the three measures as θ goes from 0° to 180°
    px, py, W, H = 370, 30, 330, 210
    X = lambda deg: px + deg / 180 * W
    Y = lambda v: py + H - v / 3.2 * H
    for t in (0, 45, 90, 135, 180):
        body.append('<line class="gr" x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>' % (X(t), py, X(t), py + H))
        body.append('<text class="tk" x="%.1f" y="%d" text-anchor="middle">%d°</text>' % (X(t), py + H + 16, t))
    for v in (0, 1, 2, 3):
        body.append('<line class="gr" x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>' % (px, Y(v), px + W, Y(v)))
        body.append('<text class="tk" x="%d" y="%.1f" text-anchor="end">%d</text>' % (px - 6, Y(v) + 4, v))
    body.append('<line class="ax" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (px, py + H, px + W, py + H))
    curves = [(ACC, lambda t: math.radians(t)), (BLUE, lambda t: 2 * math.sin(math.radians(t) / 2)),
              (WARN, lambda t: 1 - math.cos(math.radians(t)))]
    for col, f in curves:
        pts = " ".join("%.1f,%.1f" % (X(t), Y(f(t))) for t in range(0, 181, 2))
        body.append('<polyline class="cv" stroke="%s" points="%s"/>' % (col, pts))
    for t in (45, 90):
        v = 1 - math.cos(math.radians(t))
        body.append('<circle cx="%.1f" cy="%.1f" r="3.4" fill="%s"/>' % (X(t), Y(v), WARN))
        body.append('<text class="tk" x="%.1f" y="%.1f" style="fill:%s">%s</text>' % (X(t) + 7, Y(v) + 13, WARN, num(v, es)))
    legend = [(ACC, "ángulo θ, en radianes" if es else "angle θ, in radians"),
              (BLUE, "cuerda √(2 − 2 cos θ)" if es else "chord √(2 − 2 cos θ)"),
              (WARN, "1 − cos θ")]
    for i, (col, lab) in enumerate(legend):
        y = py + 14 + i * 18
        body.append('<line stroke="%s" stroke-width="2.4" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (col, px + 10, y - 4, px + 30, y - 4))
        body.append('<text class="tx" x="%d" y="%d">%s</text>' % (px + 36, y, lab))

    aria = ("Dos paneles. A la izquierda, dos vectores de longitud uno, dibujados como flechas, A en horizontal y B a sesenta grados, sobre "
            "un arco de circunferencia. Se marcan tres formas de medir lo lejos que están: el arco entre sus puntas, "
            "que mide el ángulo theta; la cuerda, el segmento recto entre las dos puntas; y, sobre el vector A, el "
            "trozo que va desde la sombra de B hasta la punta de A, que mide uno menos el coseno. A la derecha, las "
            "tres medidas en función del ángulo, de 0 a 180 grados. Las tres crecen siempre, así que ordenan los "
            "pares igual. El ángulo y la cuerda arrancan en línea recta y casi juntos; uno menos el coseno arranca "
            "plano, vale 0,29 a 45 grados y 1,00 a 90: doblar el ángulo lo multiplica por más de tres." if es else
            "Two panels. On the left, two vectors of length one, drawn as arrows, A horizontal and B at sixty degrees, on a circular "
            "arc. Three ways of measuring how far apart they are are marked: the arc between their tips, which "
            "measures the angle theta; the chord, the straight segment between the two tips; and, along vector A, "
            "the piece from B's shadow to A's tip, which measures one minus the cosine. On the right, the three "
            "measures as a function of the angle, from 0 to 180 degrees. All three always increase, so they rank "
            "pairs the same way. The angle and the chord start as straight lines, almost together; one minus the "
            "cosine starts flat, is 0.29 at 45 degrees and 1.00 at 90: doubling the angle multiplies it by more "
            "than three.")
    return svg(726, 280, aria, "\n".join(body))


# ---------------------------------------------------------------- figure 3: the guarantee 2s² − 1
def fig_garantia(es):
    px, py, W, H = 70, 24, 610, 230
    s0, s1, v0, v1 = 0.5, 1.0, -0.6, 1.0
    X = lambda s: px + (s - s0) / (s1 - s0) * W
    Y = lambda v: py + H - (v - v0) / (v1 - v0) * H
    body = []
    body.append('<rect x="%d" y="%.1f" width="%d" height="%.1f" fill="rgba(255,180,171,0.07)"/>' % (px, Y(0), W, Y(v0) - Y(0)))
    for s in (0.5, 0.6, 0.7, 0.8, 0.9, 1.0):
        body.append('<line class="gr" x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>' % (X(s), py, X(s), py + H))
        body.append('<text class="tk" x="%.1f" y="%d" text-anchor="middle">%s</text>' % (X(s), py + H + 16, num(s, es, 1)))
    for v in (-0.5, 0, 0.5, 1.0):
        body.append('<line class="gr" x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>' % (px, Y(v), px + W, Y(v)))
        body.append('<text class="tk" x="%d" y="%.1f" text-anchor="end">%s</text>' % (px - 6, Y(v) + 4, num(v, es, 1)))
    body.append('<line class="ax" x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>' % (px, Y(0), px + W, Y(0)))
    # what intuition assumes (A–C as similar as each step) vs what is guaranteed
    body.append('<line stroke="%s" stroke-width="1.4" stroke-dasharray="5 4" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>'
                % (MUTED, X(s0), Y(s0), X(s1), Y(s1)))
    pts = " ".join("%.1f,%.1f" % (X(s0 + i / 200 * (s1 - s0)), Y(2 * (s0 + i / 200 * (s1 - s0)) ** 2 - 1)) for i in range(201))
    body.append('<polyline class="cv" stroke="%s" points="%s"/>' % (ACC, pts))
    for s in (0.7, 0.8, 0.9):
        v = 2 * s * s - 1
        body.append('<circle cx="%.1f" cy="%.1f" r="3.6" fill="%s"/>' % (X(s), Y(v), ACC))
        body.append('<text class="tx" x="%.1f" y="%.1f">%s</text>' % (X(s) + 8, Y(v) + 16, num(v, es)))
    body.append('<text class="tx" x="%.1f" y="%.1f" style="fill:%s">%s</text>'
                % (X(0.53), Y(0.80), MUTED, "lo que se suele suponer: s" if es else "what people tend to assume: s"))
    body.append('<text class="tx" x="%.1f" y="%.1f" style="fill:%s">%s</text>'
                % (X(0.885), Y(0.36), ACC, "lo garantizado: 2s² − 1" if es else "what is guaranteed: 2s² − 1"))
    body.append('<text class="tx" x="%.1f" y="%.1f" style="fill:%s">%s</text>'
                % (X(0.745), Y(-0.35), BAD, "ninguna garantía: A y C pueden ser perpendiculares" if es else
                   "no guarantee: A and C can be perpendicular"))
    xl = "s, el coseno de A con B y de B con C" if es else "s, the cosine of A with B and of B with C"
    body.append('<text class="sub" x="%.1f" y="%d" text-anchor="middle">%s</text>' % (px + W / 2, py + H + 34, xl))
    yl = "cos(A, C) mínimo" if es else "minimum cos(A, C)"
    body.append('<text class="sub" transform="translate(%d,%.1f) rotate(-90)" text-anchor="middle">%s</text>' % (18, py + H / 2, yl))

    aria = ("Una gráfica. En horizontal, s, el coseno de A con B y de B con C, de 0,5 a 1. En vertical, el coseno "
            "mínimo que eso garantiza entre A y C. Una recta discontinua marca lo que se suele suponer, que A y C se "
            "parecen tanto como cada paso. Una curva por debajo marca lo garantizado, dos s al cuadrado menos uno: "
            "con s igual a 0,9 garantiza 0,62; con 0,8, 0,28; con 0,7, menos 0,02. Por debajo de 0,71 la curva cruza "
            "el cero y entra en una franja sombreada: ninguna garantía, A y C pueden ser perpendiculares." if es else
            "A chart. Horizontally, s, the cosine of A with B and of B with C, from 0.5 to 1. Vertically, the minimum "
            "cosine this guarantees between A and C. A dashed straight line marks what people tend to assume, that A "
            "and C are as alike as each step. A curve below it marks what is guaranteed, two s squared minus one: "
            "s equal to 0.9 guarantees 0.62; 0.8, 0.28; 0.7, minus 0.02. Below 0.71 the curve crosses zero into a "
            "shaded band: no guarantee, A and C can be perpendicular.")
    return svg(726, 300, aria, "\n".join(body))


FIGS = {"tres-vectores": fig_tres_vectores, "arco-cuerda": fig_arco_cuerda, "garantia": fig_garantia}

for name, fn in FIGS.items():
    for es, suffix in ((True, ".svg"), (False, ".en.svg")):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(fn(es))
print("wrote", len(FIGS) * 2, "files to", OUT)
