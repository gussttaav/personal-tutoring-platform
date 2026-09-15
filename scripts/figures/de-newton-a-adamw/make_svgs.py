"""BLOG-04 — Figures for the blog post `de-newton-a-adamw`. Every trajectory is computed here,
with the update rules exactly as the article states them; nothing is drawn by hand.
Run from this directory: python3 make_svgs.py ../../../public/blog/de-newton-a-adamw
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies."""
import math, sys, os
import opt

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; CONT = "#3b3b3e"
WARN = "#e8a24c"; BLUE = "#6fb1e8"; PINK = "#e87ab8"
FONT = "ui-sans-serif, system-ui, sans-serif"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .lbl {{ font-size: 11.5px; font-weight: 600; }}
  .sub {{ font-size: 10px; fill: {MUTED}; }}
  .ax {{ stroke: {MUTED}; stroke-width: 1; }}
  .ct {{ fill: none; stroke: {CONT}; stroke-width: 1; }}
  .tr {{ fill: none; stroke-width: 1.8; stroke-linejoin: round; stroke-linecap: round; }}
  .pt {{ stroke: none; }}
  .st {{ fill: none; stroke-width: 1.6; }}
</style>"""

def fmt(v):  # Spanish decimal comma for labels; English dot
    return v

class Panel:
    """Maps the ravine window x∈[-3,3], y∈[-1.5,1.5] onto a W×H box at (ox, oy)."""
    def __init__(self, ox, oy, W=330, H=165):
        self.ox, self.oy, self.W, self.H = ox, oy, W, H
    def X(self, x): return self.ox + (x + 3) / 6 * self.W
    def Y(self, y): return self.oy + (1.5 - y) / 3 * self.H
    def contours(self, a, levels):
        cid = "c%d_%d" % (self.ox, self.oy)
        out = ['<clipPath id="%s"><rect x="%d" y="%d" width="%d" height="%d"/></clipPath>'
               % (cid, self.ox, self.oy, self.W, self.H), '<g clip-path="url(#%s)">' % cid]
        for c in levels:
            rx = math.sqrt(c) / 6 * self.W; ry = math.sqrt(c / a) / 3 * self.H
            out.append('<ellipse class="ct" cx="%.1f" cy="%.1f" rx="%.1f" ry="%.1f"/>' % (self.X(0), self.Y(0), rx, ry))
        out.append("</g>")
        return "\n".join(out)
    def frame(self):
        return ('<rect x="%d" y="%d" width="%d" height="%d" fill="none" stroke="%s"/>'
                % (self.ox, self.oy, self.W, self.H, GRID)
                + '\n<line class="ax" x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke-dasharray="2 3"/>'
                % (self.X(0), self.oy, self.X(0), self.oy + self.H)
                + '\n<line class="ax" x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke-dasharray="2 3"/>'
                % (self.ox, self.Y(0), self.ox + self.W, self.Y(0)))
    def path(self, pts, color, n, dots=True):
        seg = pts[: n + 1]
        poly = " ".join("%.1f,%.1f" % (self.X(x), self.Y(y)) for x, y in seg)
        s = '<polyline class="tr" stroke="%s" points="%s"/>' % (color, poly)
        if dots:
            s += "".join('\n<circle class="pt" fill="%s" cx="%.1f" cy="%.1f" r="2"/>'
                         % (color, self.X(x), self.Y(y)) for x, y in seg[1:])
        x0, y0 = seg[0]
        s += '\n<circle class="st" stroke="%s" cx="%.1f" cy="%.1f" r="3.2"/>' % (color, self.X(x0), self.Y(y0))
        return s
    def label(self, title, sub):
        return ('<text class="lbl" x="%d" y="%d">%s</text>\n<text class="sub" x="%d" y="%d">%s</text>'
                % (self.ox, self.oy - 18, title, self.ox, self.oy - 6, sub))

LEVELS20 = [k * k for k in (0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6)]

def svg(w, h, aria, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img"\n aria-label="%s">\n%s\n%s\n</svg>\n'
            % (w, h, w, h, aria.replace('"', "&quot;"), STYLE, body))

def num(v, es):
    s = ("%g" % v)
    return s.replace(".", ",") if es else s

# ---------------------------------------------------------------- figure 1: one η, two curvatures
def fig_canon_dos(es):
    runs = [("gd", 0.02, {}), ("gd", 0.045, {})]
    body = []
    for i, (kind, eta, kw) in enumerate(runs):
        p = Panel(20 + i * 366, 40)
        path = opt.run(kind, eta, 200, **kw)
        steps = opt.first_below(path)
        title = ("η = %s" % num(eta, es))
        sub = ("%d pasos hasta el fondo" if es else "%d steps to the bottom") % steps
        body += [p.label(title, sub), p.contours(20, LEVELS20), p.frame(), p.path(path, ACC, 20)]
    aria = ("Dos mapas de contorno del mismo cañón, la función x² más veinte y², alargado en horizontal: "
            "las elipses son mucho más anchas que altas. En los dos, la trayectoria del descenso de gradiente "
            "arranca arriba a la izquierda. A la izquierda, con tasa 0,02, baja al eje horizontal en tres pasos "
            "y después avanza hacia el centro en pasos cortos que se acortan; tarda 80 pasos en llegar. A la "
            "derecha, con tasa 0,045, cada paso cruza el eje y cae en la pared contraria, un zigzag que se "
            "estrecha mientras avanza hacia el centro; tarda 35 pasos." if es else
            "Two contour maps of the same ravine, the function x² plus twenty y², stretched horizontally: the "
            "ellipses are much wider than tall. In both, the gradient-descent trajectory starts at the top left. "
            "On the left, with rate 0.02, it drops to the horizontal axis in three steps and then creeps toward "
            "the centre in short, shrinking steps; it takes 80 steps to arrive. On the right, with rate 0.045, "
            "every step crosses the axis and lands on the opposite wall, a zigzag that narrows as it advances "
            "toward the centre; it takes 35 steps.")
    return svg(726, 225, aria, "\n".join(body))

# ---------------------------------------------------------------- figure 2: four optimisers
def fig_canon_cuatro(es):
    runs = [("gd", 0.045, {}, ACC, "Descenso de gradiente" if es else "Gradient descent", "η = %s" % num(0.045, es)),
            ("mom", 0.045, {"b1": 0.5}, WARN, "Momentum", ("η = %s, β = %s" % (num(0.045, es), num(0.5, es)))),
            ("rms", 0.1, {"b2": 0.9}, BLUE, "RMSProp", ("η = %s, β₂ = %s" % (num(0.1, es), num(0.9, es)))),
            ("adam", 0.1, {}, PINK, "Adam", ("η = %s, β₁ = %s, β₂ = %s" % (num(0.1, es), num(0.9, es), num(0.999, es))))]
    body = []
    for i, (kind, eta, kw, col, name, params) in enumerate(runs):
        p = Panel(20 + (i % 2) * 366, 40 + (i // 2) * 215)
        path = opt.run(kind, eta, 200, **kw)
        steps = opt.first_below(path)
        sub = "%s · %s" % (params, ("%d pasos" if es else "%d steps") % steps)
        body += [p.label(name, sub), p.contours(20, LEVELS20), p.frame(), p.path(path, col, 20)]
    aria = ("Cuatro mapas de contorno del mismo cañón alargado, uno por método, todos con la trayectoria "
            "arrancando arriba a la izquierda y veinte pasos dibujados. Descenso de gradiente, arriba a la "
            "izquierda: zigzag entre las dos paredes, 35 pasos. Momentum, arriba a la derecha: los primeros "
            "rebotes son más cortos cada vez y la trayectoria avanza más deprisa hacia el centro, 14 pasos. "
            "RMSProp, abajo a la izquierda: una curva suave que baja en diagonal y luego sigue el eje, sin "
            "rebotar, 31 pasos. Adam, abajo a la derecha: una recta en diagonal a cuarenta y cinco grados "
            "hasta el eje y luego a lo largo de él, con todos los pasos de la misma longitud, 36 pasos." if es else
            "Four contour maps of the same stretched ravine, one per method, every trajectory starting at the "
            "top left with twenty steps drawn. Gradient descent, top left: zigzag between the two walls, 35 "
            "steps. Momentum, top right: each bounce shorter than the last and faster progress toward the "
            "centre, 14 steps. RMSProp, bottom left: a smooth curve down the diagonal and then along the axis, "
            "no bouncing, 31 steps. Adam, bottom right: a straight forty-five-degree diagonal to the axis and "
            "then along it, every step the same length, 36 steps.")
    return svg(726, 470, aria, "\n".join(body))

# ---------------------------------------------------------------- figure 3: same η, ravine 100× narrower
def fig_mismo_eta(es):
    body = []
    for i, a in enumerate((20, 2000)):
        opt.f = lambda x, y, a=a: x * x + a * y * y
        opt.grad = lambda x, y, a=a: (2 * x, 2 * a * y)
        p = Panel(20 + i * 366, 40)
        adam = opt.run("adam", 0.1, 400)
        s_adam = opt.first_below(adam)
        eta_gd = 0.045 if a == 20 else 0.00045
        gd = opt.run("gd", eta_gd, 20000)
        s_gd = opt.first_below(gd)
        levels = LEVELS20 if a == 20 else [a * y * y for y in (0.1, 0.25, 0.5, 0.75, 1.0, 1.25)]
        title = "x² + %dy²" % a
        sub = (("Adam, η = 0,1: %d pasos · descenso, η = %s: %d pasos" % (s_adam, num(eta_gd, es), s_gd)) if es
               else ("Adam, η = 0.1: %d steps · descent, η = %s: %d steps" % (s_adam, num(eta_gd, es), s_gd)))
        body += [p.label(title, sub), p.contours(a, levels), p.frame(), p.path(adam, PINK, 30)]
    opt.f = lambda x, y: x * x + 20 * y * y
    opt.grad = lambda x, y: (2 * x, 40 * y)
    aria = ("Dos mapas de contorno con la misma trayectoria de Adam encima, treinta pasos en línea recta: "
            "diagonal a cuarenta y cinco grados desde arriba a la izquierda hasta el eje horizontal y luego "
            "hacia el centro. A la izquierda el cañón es x² más veinte y², con elipses alargadas. A la derecha "
            "es x² más dos mil y², cien veces más estrecho: los contornos son casi rayas horizontales y el fondo "
            "es una rendija. Los treinta pasos son idénticos en los dos dibujos. Las etiquetas dicen que Adam "
            "llega en 36 y 75 pasos con la misma tasa 0,1, y que el descenso de gradiente necesita 35 pasos "
            "con tasa 0,045 en el primero y 3619 pasos con tasa 0,00045 en el segundo." if es else
            "Two contour maps with the same Adam trajectory over them, thirty steps in a straight line: a "
            "forty-five-degree diagonal from the top left down to the horizontal axis, then toward the centre. "
            "On the left the ravine is x² plus twenty y², with stretched ellipses. On the right it is x² plus "
            "two thousand y², a hundred times narrower: the contours are nearly horizontal stripes and the floor "
            "is a slit. The thirty steps are identical in both drawings. The labels say Adam arrives in 36 and "
            "75 steps at the same rate 0.1, and that gradient descent needs 35 steps at rate 0.045 on the first "
            "and 3619 steps at rate 0.00045 on the second.")
    return svg(726, 225, aria, "\n".join(body))

# ---------------------------------------------------------------- figure 4: timeline (not to scale)
def fig_linea_tiempo(es):
    ev = [("1847", "Cauchy", "descenso de gradiente" if es else "gradient descent"),
          ("1951", "Robbins y Monro" if es else "Robbins and Monro", "estocástico" if es else "stochastic"),
          ("1964", "Polyak", "momentum"),
          ("1983", "Nesterov", "momentum acelerado" if es else "accelerated momentum"),
          ("2011", "AdaGrad", "una tasa por parámetro" if es else "one rate per parameter"),
          ("2012", "RMSProp", "media móvil" if es else "moving average"),
          ("2014", "Adam", "las dos ideas" if es else "both ideas"),
          ("2017", "AdamW", "decaimiento desacoplado" if es else "decoupled decay"),
          ("2018", "Shampoo", "precondicionar por matriz" if es else "matrix preconditioner"),
          ("2024", "Muon", "ortogonalizar el paso" if es else "orthogonalise the step"),
          ("2025", "Kimi K2", "1 T parámetros con Muon" if es else "1T parameters on Muon"),
          ("2026", "DeepSeek-V4", "Muon, 1,6 T" if es else "Muon, 1.6T")]
    W = 726; x0, x1 = 64, W - 56; y = 78
    n = len(ev); gap = (x1 - x0) / (n - 1)
    body = ['<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.2"/>' % (x0, y, x1, y, MUTED)]
    # gap markers where time is compressed (between 1983 and 2011, and before 1951)
    for i in (0, 3):
        gx = x0 + (i + 0.5) * gap
        body.append('<path d="M%.1f %d l4 -6 l-8 12 l4 -6" fill="none" stroke="%s" stroke-width="1.2"/>' % (gx - 0, y, "#1d1d1f"))
        body.append('<path d="M%.1f %d l4 -6 l-8 12 l4 -6" fill="none" stroke="%s" stroke-width="1.2"/>' % (gx, y, MUTED))
    for i, (yr, name, what) in enumerate(ev):
        cx = x0 + i * gap
        up = i % 2 == 0
        col = ACC if name in ("Adam", "AdamW", "Muon") else TXT
        body.append('<circle cx="%.1f" cy="%d" r="3.5" fill="%s"/>' % (cx, y, col))
        ty = y - 34 if up else y + 22
        body.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="%s" stroke-width="1"/>' % (cx, y - 5 if up else y + 5, cx, y - 20 if up else y + 12, GRID))
        body.append('<text class="lbl" x="%.1f" y="%d" text-anchor="middle" fill="%s">%s</text>' % (cx, ty, col, yr))
        body.append('<text class="sub" x="%.1f" y="%d" text-anchor="middle" style="fill:%s">%s</text>' % (cx, ty + 12, TXT, name))
        body.append('<text class="sub" x="%.1f" y="%d" text-anchor="middle">%s</text>' % (cx, ty + 23, what))
    aria = ("Línea de tiempo, no a escala, con doce hitos: 1847 Cauchy, descenso de gradiente; 1951 Robbins y "
            "Monro, estocástico; 1964 Polyak, momentum; 1983 Nesterov, momentum acelerado; 2011 AdaGrad, una "
            "tasa por parámetro; 2012 RMSProp, media móvil; 2014 Adam, las dos ideas; 2017 AdamW, decaimiento "
            "desacoplado; 2018 Shampoo, precondicionar por matriz; 2024 Muon, ortogonalizar el paso; 2025 Kimi "
            "K2, un billón de parámetros con Muon; 2026 DeepSeek-V4, Muon a 1,6 billones. Ocho de los doce "
            "caen en los últimos quince años." if es else
            "Timeline, not to scale, with twelve milestones: 1847 Cauchy, gradient descent; 1951 Robbins and "
            "Monro, stochastic; 1964 Polyak, momentum; 1983 Nesterov, accelerated momentum; 2011 AdaGrad, one "
            "rate per parameter; 2012 RMSProp, moving average; 2014 Adam, both ideas; 2017 AdamW, decoupled "
            "decay; 2018 Shampoo, matrix preconditioner; 2024 Muon, orthogonalise the step; 2025 Kimi K2, one "
            "trillion parameters on Muon; 2026 DeepSeek-V4, Muon at 1.6 trillion. Eight of the twelve fall in "
            "the last fifteen years.")
    return svg(W, 150, aria, "\n".join(body))

for name, fn in [("canon-dos-tasas", fig_canon_dos), ("canon-cuatro-metodos", fig_canon_cuatro),
                 ("misma-tasa-dos-canones", fig_mismo_eta), ("linea-de-tiempo", fig_linea_tiempo)]:
    for es in (True, False):
        fname = os.path.join(OUT, name + (".svg" if es else ".en.svg"))
        with open(fname, "w", encoding="utf8") as fh:
            fh.write(fn(es))
        print("wrote", fname, os.path.getsize(fname), "bytes")
