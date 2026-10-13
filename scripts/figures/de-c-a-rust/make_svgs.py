"""BLOG-16 — Figures for the blog post `de-c-a-rust`.
Run from this directory: python3 make_svgs.py ../../../public/blog/de-c-a-rust
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

Nothing here is measured by this script:
  - `vector-que-se-mueve` draws the heap the post's examples `primero.c` and `primero_movido.c`
    run on (glibc 2.43, gcc 15.2): with nothing behind the vector's 16-byte block, realloc grows it
    in place and the stale pointer still reads 1; with the strdup("serie") block behind it, realloc
    moves the vector and the stale pointer reads whatever malloc wrote into the freed block.
  - `android-memoria` plots the share of Android's vulnerabilities that were memory-safety bugs, as
    Google's security blog states it in prose: 76 % (2019) and 35 % (2022) in "Memory Safe Languages
    in Android 13" (Dec 2022); 24 % (2024, extrapolated to the full year) in "Eliminating Memory
    Safety Vulnerabilities at the Source" (Sep 2024); "below 20 %" (2025) in "Rust in Android: move
    fast and fix things" (Nov 2025). Years the posts do not quote get no bar. The 70 % line is the
    "industry norm" the 2024 post compares against.
  - `linea-de-tiempo` is dates."""
import os, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; LINE = "#3b3b3e"
WARN = "#e8a24c"; BLUE = "#6fb1e8"; BAD = "#ffb4ab"; BG = "#131315"
FONT = "ui-sans-serif, system-ui, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .bx {{ fill: none; stroke: {MUTED}; stroke-width: 1; }}
  .bx.m {{ stroke: {ACC}; fill: rgba(78,222,163,0.12); }}
  .bx.w {{ stroke: {WARN}; fill: rgba(232,162,76,0.12); }}
  .bx.x {{ stroke: {BAD}; fill: rgba(255,180,171,0.08); stroke-dasharray: 3 3; }}
  .bx.g {{ stroke: {LINE}; }}
  .bx.s {{ stroke: {LINE}; fill: rgba(134,148,138,0.10); }}
  .lb {{ font-size: 12.5px; font-weight: 600; }}
  .sb {{ font-size: 11px; fill: {MUTED}; }}
  .tx {{ font-size: 11.5px; }}
  .tx.d {{ fill: {MUTED}; }}
  .mo {{ font-family: {MONO}; font-size: 11.5px; }}
  .mo.d {{ fill: {MUTED}; }}
  .m {{ fill: {ACC}; }}
  .w {{ fill: {WARN}; }}
  .b {{ fill: {BLUE}; }}
  .x {{ fill: {BAD}; }}
  .ar {{ fill: none; stroke: {MUTED}; stroke-width: 1.2; marker-end: url(#a); }}
  .ar.m {{ stroke: {ACC}; stroke-width: 1.5; marker-end: url(#am); }}
  .ar.x {{ stroke: {BAD}; stroke-width: 1.5; marker-end: url(#ax); }}
  .ed {{ stroke: {LINE}; stroke-width: 1; }}
  .gl {{ stroke: {GRID}; stroke-width: 1; }}
  .rf {{ stroke: {MUTED}; stroke-width: 1; stroke-dasharray: 4 4; }}
  .sep {{ stroke: {GRID}; stroke-width: 1; }}
</style>"""

DEFS = "<defs>" + "".join(
    f'<marker id="{i}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
    f'<path d="M0,0.5 L7.5,4 L0,7.5 z" fill="{c}"/></marker>'
    for i, c in (("a", MUTED), ("am", ACC), ("ax", BAD))) + "</defs>"


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def svg(w, h, aria, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img"\n'
            ' aria-label="%s">\n%s\n%s\n%s\n</svg>\n'
            % (w, h, w, h, esc(aria).replace('"', "&quot;"), STYLE, DEFS, "\n".join(body)))


def box(x, y, w, h, cls="", rx=4):
    return '<rect class="bx %s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%g"/>' % (cls, x, y, w, h, rx)


def text(x, y, s, cls="tx", anchor=None):
    a = ' style="text-anchor:%s"' % anchor if anchor else ""
    return '<text class="%s" x="%.1f" y="%.1f"%s>%s</text>' % (cls, x, y, a, esc(s))


def arrow(pts, cls="ar"):
    d = "M" + " L".join("%.1f,%.1f" % p for p in pts)
    return '<path class="%s" d="%s"/>' % (cls, d)


def line(x1, y1, x2, y2, cls="ed"):
    return '<line class="%s" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (cls, x1, y1, x2, y2)


def write(name, es_svg, en_svg):
    for suffix, content in ((".svg", es_svg), (".en.svg", en_svg)):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(content)


# ─── 1. vector-que-se-mueve (the post's cover) ───────────────────────────────────────────────────

CELL = 34      # one int
ROW_H = 118    # one scenario


def cells(b, x, y, vals, cls):
    """A malloc block of len(vals) ints; None = allocated but unused."""
    b.append(box(x, y, CELL * len(vals), 26, cls, rx=3))
    for i, v in enumerate(vals):
        if i:
            b.append(line(x + i * CELL, y, x + i * CELL, y + 26, "ed"))
        if v is not None:
            b.append(text(x + i * CELL + CELL / 2, y + 17.5, str(v), "mo", "middle"))


def pointer(b, x_label, y_label, x_to, y_to, name, cls):
    b.append(text(x_label, y_label, name, "mo " + ("x" if cls == "x" else "m"), "middle"))
    b.append(arrow([(x_label, y_label + 5), (x_to, y_to - 3)], "ar " + cls))


def fig_vector(es):
    L = {
        True: dict(
            r1=("Antes de push(5)", "cuatro enteros, bloque lleno"),
            r2=("Si detrás no hay nada", "realloc estira el bloque"),
            r3=("Si detrás hay otra reserva", "realloc lo muda"),
            free="liberado: malloc lo reutiliza",
            serie='"serie"',
            ok="primero = 1, por suerte",
            bad="= basura",
            heap="heap",
            aria="Tres filas que muestran la memoria del heap en el ejemplo primero.c. Fila 1, antes de "
                 "push(5): un bloque de cuatro enteros, 1, 2, 3 y 4; v.datos y primero apuntan a su primera "
                 "casilla. Fila 2, si detrás del bloque no hay nada: realloc lo estira en el mismo sitio hasta "
                 "ocho casillas, con el 5 en la quinta; v.datos y primero siguen apuntando al mismo 1, así que "
                 "el programa imprime 1 por suerte. Fila 3, si detrás hay otra reserva, la cadena serie: realloc "
                 "pide un bloque nuevo más adelante, copia los cinco enteros y libera el viejo; v.datos apunta "
                 "al bloque nuevo, pero primero sigue apuntando al viejo, ya liberado, y lee basura."),
        False: dict(
            r1=("Before push(5)", "four ints, block full"),
            r2=("If nothing is behind it", "realloc stretches the block"),
            r3=("If another block is behind it", "realloc moves it"),
            free="freed: malloc reuses it",
            serie='"serie"',
            ok="primero = 1, by luck",
            bad="= garbage",
            heap="heap",
            aria="Three rows showing heap memory in the example primero.c. Row 1, before push(5): a block of "
                 "four ints, 1, 2, 3 and 4; v.datos and primero point at its first cell. Row 2, if nothing is "
                 "behind the block: realloc stretches it in place to eight cells, with the 5 in the fifth; "
                 "v.datos and primero still point at the same 1, so the program prints 1 by luck. Row 3, if "
                 "another allocation, the string serie, sits behind it: realloc gets a new block further on, "
                 "copies the five ints and frees the old one; v.datos points at the new block, but primero "
                 "still points at the old, freed one and reads garbage."),
    }[es]
    W, H = 760, 3 * ROW_H + 8
    X0 = 250            # where the heap strip starts
    b = []
    for r in range(3):
        y = r * ROW_H
        if r:
            b.append(line(16, y + 2, W - 16, y + 2, "sep"))
        title, sub = L["r%d" % (r + 1)]
        b.append(text(16, y + 62, title, "lb"))
        b.append(text(16, y + 78, sub, "sb"))
        if r == 0:
            b.append(text(X0, y + 104, L["heap"], "sb"))
        sy = y + 62     # heap strip top
        b.append(line(X0 - 8, sy + 13, W - 16, sy + 13, "gl"))
        if r == 0:
            cells(b, X0, sy, [1, 2, 3, 4], "m")
            pointer(b, X0 + 17, y + 26, X0 + 17, sy, "v.datos", "m")
            pointer(b, X0 + 95, y + 26, X0 + 24, sy, "primero", "m")
        elif r == 1:
            cells(b, X0, sy, [1, 2, 3, 4, 5, None, None, None], "m")
            pointer(b, X0 + 17, y + 26, X0 + 17, sy, "v.datos", "m")
            pointer(b, X0 + 95, y + 26, X0 + 24, sy, "primero", "m")
            b.append(text(X0 + 8 * CELL + 16, sy + 17.5, L["ok"], "tx"))
        else:
            b.append(box(X0, sy, 4 * CELL, 26, "x", rx=3))
            b.append(text(X0 + 2 * CELL, sy + 17.5, "· · · ·", "mo d", "middle"))
            b.append(text(X0 + 2 * CELL, sy + 42, L["free"], "sb", "middle"))
            sx = X0 + 4 * CELL + 14
            b.append(box(sx, sy, 62, 26, "s", rx=3))
            b.append(text(sx + 31, sy + 17.5, L["serie"], "mo d", "middle"))
            nx = sx + 62 + 14
            cells(b, nx, sy, [1, 2, 3, 4, 5, None, None, None], "m")
            pointer(b, nx + 17, y + 26, nx + 17, sy, "v.datos", "m")
            pointer(b, X0 + 95, y + 26, X0 + 24, sy, "primero", "x")
            b.append(text(X0 + 126, y + 26, L["bad"], "tx x"))
    return svg(W, H, L["aria"], b)


# ─── 2. android-memoria ──────────────────────────────────────────────────────────────────────────

def fig_android(es):
    data = [(2019, 76, "76 %" if es else "76%"), (2022, 35, "35 %" if es else "35%"),
            (2024, 24, "24 %" if es else "24%"), (2025, 20, "< 20 %" if es else "< 20%")]
    L = {
        True: dict(
            y="% de las vulnerabilidades de Android que son de memoria",
            ref="70 %: lo habitual en el sector, según Google",
            est="estimado para el año entero",
            aria="Gráfico de barras. Parte de las vulnerabilidades de Android que son fallos de memoria, según el "
                 "blog de seguridad de Google: 76 % en 2019, 35 % en 2022, 24 % en 2024 (estimado para el año "
                 "entero) y menos del 20 % en 2025. Una línea discontinua marca el 70 %, lo habitual en el "
                 "sector según Google. Los años 2020, 2021 y 2023 no tienen barra porque Google no da la cifra "
                 "en el texto."),
        False: dict(
            y="% of Android's vulnerabilities that are memory-safety bugs",
            ref="70%: the industry norm, per Google",
            est="estimated for the full year",
            aria="Bar chart. Share of Android's vulnerabilities that are memory-safety bugs, according to Google's "
                 "security blog: 76% in 2019, 35% in 2022, 24% in 2024 (estimated for the full year) and below "
                 "20% in 2025. A dashed line marks 70%, the industry norm according to Google. 2020, 2021 and "
                 "2023 have no bar because Google does not give the figure in the text."),
    }[es]
    W, H = 760, 300
    left, right, top, bottom = 64, 40, 36, 252
    y0, y1 = 0, 80
    sy = lambda v: bottom - (v - y0) / (y1 - y0) * (bottom - top)
    years = list(range(2019, 2026))
    slot = (W - left - right) / len(years)
    sx = lambda yr: left + (yr - 2019 + 0.5) * slot
    b = [text(16, 18, L["y"], "sb")]
    for v in (0, 20, 40, 60, 80):
        b.append(line(left, sy(v), W - right, sy(v), "gl" if v else "ed"))
        b.append(text(left - 10, sy(v) + 4, str(v), "sb", "end"))
    b.append(line(left, sy(70), W - right, sy(70), "rf"))
    b.append(text(W - right, sy(70) - 7, L["ref"], "sb", "end"))
    bw = 46
    for yr, v, lab in data:
        x = sx(yr) - bw / 2
        upper_bound = yr == 2025
        h = sy(0) - sy(v)
        # 4 px rounded top, square at the baseline
        path = ("M%.1f,%.1f L%.1f,%.1f Q%.1f,%.1f %.1f,%.1f L%.1f,%.1f Q%.1f,%.1f %.1f,%.1f L%.1f,%.1f Z"
                % (x, sy(0), x, sy(v) + 4, x, sy(v), x + 4, sy(v), x + bw - 4, sy(v), x + bw, sy(v),
                   x + bw, sy(v) + 4, x + bw, sy(0)))
        if upper_bound:
            b.append('<path d="%s" fill="none" stroke="%s" stroke-width="1.2" stroke-dasharray="4 3"/>' % (path, WARN))
        else:
            b.append('<path d="%s" fill="%s"/>' % (path, WARN))
        b.append(text(sx(yr), sy(v) - 8, lab, "lb", "middle"))
        if yr == 2024:
            b.append(text(sx(yr), sy(v) - 22, L["est"], "sb", "middle"))
        del h
    for yr in years:
        b.append(text(sx(yr), bottom + 18, str(yr), "sb" if yr not in (d[0] for d in data) else "tx", "middle"))
    return svg(W, H, L["aria"], b)


# ─── 3. linea-de-tiempo ──────────────────────────────────────────────────────────────────────────

def fig_linea(es):
    ev = [  # (year, es, en, family: c | mem | rust)
        (1972, ("nace C", "Ritchie, Bell Labs"), ("C is born", "Ritchie, Bell Labs"), "c"),
        (1988, ("gusano de Morris", "un gets() de más"), ("Morris worm", "one gets() too many"), "mem"),
        (1989, ("ANSI C", "la primera norma"), ("ANSI C", "the first standard"), "c"),
        (2011, ("C11", "hilos y atómicos"), ("C11", "threads, atomics"), "c"),
        (2014, ("Heartbleed", "OpenSSL"), ("Heartbleed", "OpenSSL"), "mem"),
        (2015, ("Rust 1.0", "Mozilla"), ("Rust 1.0", "Mozilla"), "rust"),
        (2019, ("70 % en Microsoft", "fallos de memoria"), ("70% at Microsoft", "memory-safety bugs"), "mem"),
        (2022, ("Linux 6.1", "admite Rust"), ("Linux 6.1", "accepts Rust"), "rust"),
        (2024, ("C23", "se publica"), ("C23", "is published"), "c"),
        (2025, ("Rust en Linux", "fin del experimento"), ("Rust in Linux", "experiment over"), "rust"),
    ]
    col = {"c": (ACC, "m"), "mem": (WARN, "w"), "rust": (BLUE, "b")}
    L = {
        True: dict(k=(("c", "C y su norma"), ("mem", "fallos de memoria"), ("rust", "Rust")),
                   aria="Línea de tiempo, no a escala, con diez hitos. En verde, C y su norma: 1972, nace C, de "
                        "Dennis Ritchie en los Bell Labs; 1989, ANSI C, la primera norma; 2011, C11, con hilos y "
                        "operaciones atómicas; 2024, se publica C23. En naranja, fallos de memoria: 1988, el gusano "
                        "de Morris, que entraba por un gets(); 2014, Heartbleed, en OpenSSL; 2019, Microsoft cuenta "
                        "que el 70 % de sus vulnerabilidades son de memoria. En azul, Rust: 2015, Rust 1.0; 2022, "
                        "Linux 6.1 admite código en Rust; 2025, Rust en Linux deja de ser un experimento."),
        False: dict(k=(("c", "C and its standard"), ("mem", "memory-safety failures"), ("rust", "Rust")),
                    aria="Timeline, not to scale, with ten milestones. In green, C and its standard: 1972, C is "
                         "born, by Dennis Ritchie at Bell Labs; 1989, ANSI C, the first standard; 2011, C11, with "
                         "threads and atomics; 2024, C23 is published. In orange, memory-safety failures: 1988, the "
                         "Morris worm, which got in through a gets(); 2014, Heartbleed, in OpenSSL; 2019, Microsoft "
                         "reports that 70% of its vulnerabilities are memory-safety bugs. In blue, Rust: 2015, "
                         "Rust 1.0; 2022, Linux 6.1 accepts Rust code; 2025, Rust in Linux is no longer an "
                         "experiment."),
    }[es]
    W, H, Y = 760, 166, 96
    b = [line(8, Y, W - 8, Y, "ed")]
    step = (W - 124) / (len(ev) - 1)
    for i, (yr, tes, ten, fam) in enumerate(ev):
        x = 62 + i * step
        t = tes if es else ten
        c, cls = col[fam]
        b.append('<circle cx="%.1f" cy="%d" r="4.5" fill="%s"/>' % (x, Y, c))
        up = i % 2 == 0
        b.append(line(x, Y + (-6 if up else 6), x, Y + (-16 if up else 16), "ed"))
        ty = Y - 46 if up else Y + 30
        b.append(text(x, ty, str(yr), "lb " + cls, "middle"))
        b.append(text(x, ty + 14, t[0], "tx", "middle"))
        b.append(text(x, ty + 27, t[1], "sb", "middle"))
    kx = W - 16
    for fam, label in reversed(L["k"]):
        w = 7 * len(label) + 22
        kx -= w
        b.append('<circle cx="%d" cy="12" r="4.5" fill="%s"/>' % (kx, col[fam][0]))
        b.append(text(kx + 10, 16, label, "sb"))
        kx -= 10
    return svg(W, H, L["aria"], b)


for name, fn in (("vector-que-se-mueve", fig_vector), ("android-memoria", fig_android),
                 ("linea-de-tiempo", fig_linea)):
    write(name, fn(True), fn(False))
print("ok:", OUT)
