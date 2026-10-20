"""BLOG-19 — Figures for the blog post `de-videojuegos-a-llm`.
Run from this directory: python3 make_svgs.py ../../../public/blog/de-videojuegos-a-llm
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

No measurements: every number is a published spec or comes from a sum written next to it.
  - `vertice-a-pixel`: the per-vertex 4x4 transform (16 multiplications, 12 additions) and the
    per-pixel dot product. A diagram, no numbers beyond those.
  - `cpu-y-gpu` (the post's cover): a schematic of where each chip spends its area. Not to
    scale and no vendor floorplan: it shows the idea, not a die shot.
  - `capa-de-un-transformer`: the matrix shapes of one Llama 3 405B layer (arXiv 2407.21783,
    table 3): model dimension 16 384, FFN 53 248, 128 query heads and 8 key/value heads of
    dimension 128 (so K and V are 16 384 x 1 024), vocabulary 128 000, 126 layers.
    Parameters per layer: 2 x 16 384^2 + 2 x 16 384 x 1 024 + 3 x 16 384 x 53 248 = 3 188 M.
  - `techo`: roofline from the datasheets. H100 SXM: 989 TFLOPS dense BF16, 3.35 TB/s.
    Xeon 6980P: 128 cores x 1 024 BF16 ops/cycle (AMX, Intel's Xeon 6 product brief) x 2.0 GHz
    base = 262 TFLOPS; 12 x MRDIMM-8800 x 8 B = 844.8 GB/s. Marks: decode at batch 1 (BF16,
    2 ops per 2 bytes = 1 op/B), batch 64 (64 op/B), and an n = 16 384 square matmul counting
    the output write (2n^3 / (3n^2 x 2 B) = n/3 = 5 461 op/B).
  - `tres-formas`: SIMT lanes (a 32-thread warp), a Volta tensor core (4x4x4, D = A x B + C,
    64 FMA per clock) and the TPU's systolic array (256 x 256 in the real chip, drawn 6 x 6).
  - `linea-de-tiempo`: dates from the post's sources."""
import math
import os
import sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; LINE = "#3b3b3e"
WARN = "#e8a24c"; BLUE = "#6fb1e8"; BAD = "#ffb4ab"
FONT = "ui-sans-serif, system-ui, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .bx {{ fill: none; stroke: {MUTED}; stroke-width: 1; }}
  .bx.m {{ stroke: {ACC}; fill: rgba(78,222,163,0.14); }}
  .bx.w {{ stroke: {WARN}; fill: rgba(232,162,76,0.16); }}
  .bx.b {{ stroke: {BLUE}; fill: rgba(111,177,232,0.14); }}
  .bx.g {{ stroke: {LINE}; }}
  .bx.s {{ stroke: {LINE}; fill: rgba(134,148,138,0.10); }}
  .bx.f {{ stroke: {ACC}; fill: rgba(78,222,163,0.45); }}
  .lb {{ font-size: 12.5px; font-weight: 600; }}
  .sb {{ font-size: 11px; fill: {MUTED}; }}
  .tx {{ font-size: 11.5px; }}
  .mo {{ font-family: {MONO}; font-size: 11px; }}
  .m {{ fill: {ACC}; }}
  .w {{ fill: {WARN}; }}
  .b {{ fill: {BLUE}; }}
  .ed {{ stroke: {LINE}; stroke-width: 1; }}
  .gl {{ stroke: {GRID}; stroke-width: 1; }}
  .rf {{ stroke: {MUTED}; stroke-width: 1; stroke-dasharray: 4 4; }}
  .ar {{ stroke: {MUTED}; stroke-width: 1.2; fill: none; marker-end: url(#ah); }}
</style>
<defs><marker id="ah" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7"
  orient="auto-start-reverse"><path d="M0,0 L8,4 L0,8 z" fill="{MUTED}"/></marker></defs>"""


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def svg(w, h, aria, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img"\n'
            ' aria-label="%s">\n%s\n%s\n</svg>\n'
            % (w, h, w, h, esc(aria).replace('"', "&quot;"), STYLE, "\n".join(body)))


def box(x, y, w, h, cls="", rx=4):
    return '<rect class="bx %s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%g"/>' % (cls, x, y, w, h, rx)


def text(x, y, s, cls="tx", anchor=None):
    a = ' style="text-anchor:%s"' % anchor if anchor else ""
    return '<text class="%s" x="%.1f" y="%.1f"%s>%s</text>' % (cls, x, y, a, esc(s))


def line(x1, y1, x2, y2, cls="ed"):
    return '<line class="%s" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (cls, x1, y1, x2, y2)


def arrow(x1, y1, x2, y2):
    return '<path class="ar" d="M%.1f,%.1f L%.1f,%.1f"/>' % (x1, y1, x2, y2)


def num(v, es, dec=0):
    """Decimal comma and space thousands in Spanish; point and comma in English."""
    s = "{:,.{d}f}".format(v, d=dec)
    if es:
        s = s.replace(",", " ").replace(".", ",")
        # Spanish leaves four-digit numbers ungrouped.
        if len(s.split(",")[0].replace(" ", "")) <= 4:
            s = s.replace(" ", "")
    return s


def legend(b, items, right, y=14):
    """items: (css class of the swatch box, label). Right-aligned at `right`."""
    x = right
    for cls, label in reversed(items):
        w = 6.2 * len(label) + 20
        x -= w
        b.append(box(x, y - 9, 11, 11, cls, rx=2))
        b.append(text(x + 16, y, label, "sb"))
        x -= 12


def write(name, es_svg, en_svg):
    for suffix, content in ((".svg", es_svg), (".en.svg", en_svg)):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(content)


# ─── 1. vertice-a-pixel ──────────────────────────────────────────────────────────────────────────

def fig_vertice(es):
    L = {
        True: dict(
            s1=("1. Vértices", "x, y, z de cada uno"), s2=("2. Colocar", "la misma matriz de 4×4"),
            s3=("3. Rasterizar", "qué píxeles cubre"), s4=("4. Pintar", "el color de cada píxel"),
            ops=("16 multiplicaciones", "y 12 sumas por vértice"), dot=("normal · luz:", "un producto escalar"),
            note="La misma operación para millones de vértices y de píxeles: ninguno espera a otro.",
            aria="Cuatro etapas de izquierda a derecha. Uno, vértices: tres puntos con coordenadas x, y, z. "
                 "Dos, colocar: cada vértice se multiplica por la misma matriz de 4×4, 16 multiplicaciones y "
                 "12 sumas por vértice. Tres, rasterizar: el triángulo, ya en la pantalla, sobre una cuadrícula "
                 "de píxeles, con los que cubre marcados. Cuatro, pintar: cada píxel cubierto recibe su color "
                 "con un producto escalar entre la normal y la dirección de la luz. Debajo, una nota: la misma "
                 "operación para millones de vértices y de píxeles, ninguno espera a otro."),
        False: dict(
            s1=("1. Vertices", "x, y, z of each one"), s2=("2. Place", "the same 4×4 matrix"),
            s3=("3. Rasterise", "which pixels it covers"), s4=("4. Shade", "the colour of each pixel"),
            ops=("16 multiplications", "and 12 additions per vertex"), dot=("normal · light:", "a dot product"),
            note="The same operation for millions of vertices and pixels: none waits for another.",
            aria="Four stages from left to right. One, vertices: three points with x, y, z coordinates. Two, "
                 "place: each vertex is multiplied by the same 4×4 matrix, 16 multiplications and 12 additions "
                 "per vertex. Three, rasterise: the triangle, now on the screen, over a grid of pixels, with the "
                 "ones it covers marked. Four, shade: each covered pixel gets its colour from a dot product "
                 "between the normal and the direction of the light. Below, a note: the same operation for "
                 "millions of vertices and pixels, none waits for another."),
    }[es]
    W, H = 760, 210
    cw, top, ph = 172, 52, 112
    xs = [16 + i * (cw + 18) for i in range(4)]
    b = []
    for x, (t, s) in zip(xs, (L["s1"], L["s2"], L["s3"], L["s4"])):
        b.append(text(x, 22, t, "lb"))
        b.append(text(x, 38, s, "sb"))
        b.append(box(x, top, cw, ph, "g"))
    for i in range(3):
        b.append(arrow(xs[i] + cw + 2, top + ph / 2, xs[i + 1] - 3, top + ph / 2))
    # 1. three vertices
    pts = [(xs[0] + 40, top + 88), (xs[0] + 132, top + 74), (xs[0] + 78, top + 22)]
    b.append('<polygon points="%s" fill="none" stroke="%s" stroke-dasharray="3 3"/>'
             % (" ".join("%.1f,%.1f" % p for p in pts), LINE))
    for (px, py), lab in zip(pts, ("(x₁, y₁, z₁)", "(x₂, y₂, z₂)", "(x₃, y₃, z₃)")):
        b.append('<circle cx="%.1f" cy="%.1f" r="4" fill="%s"/>' % (px, py, BLUE))
        b.append(text(px, py + (16 if py > top + 50 else -8), lab, "mo", "middle"))
    # 2. the 4x4 matrix times a vertex
    mx, my, c = xs[1] + 18, top + 18, 15
    for r in range(4):
        for k in range(4):
            b.append(box(mx + k * c, my + r * c, c - 2, c - 2, "w", rx=1))
    vx = mx + 4 * c + 14
    for r, lab in enumerate("xyz1"):
        b.append(box(vx, my + r * c, c - 2, c - 2, "b", rx=1))
        b.append(text(vx + (c - 2) / 2, my + r * c + 10.5, lab, "mo", "middle"))
    b.append(text(mx + 4 * c + 5, my + 2 * c + 3, "×", "tx", "middle"))
    b.append(text(vx + c + 10, my + 2 * c + 3, "=", "tx", "middle"))
    for r, lab in enumerate(("x'", "y'", "z'", "w'")):
        b.append(box(vx + c + 22, my + r * c, c + 4, c - 2, "b", rx=1))
        b.append(text(vx + c + 22 + (c + 4) / 2, my + r * c + 10.5, lab, "mo", "middle"))
    b.append(text(xs[1] + cw / 2, top + ph - 20, L["ops"][0], "sb", "middle"))
    b.append(text(xs[1] + cw / 2, top + ph - 6, L["ops"][1], "sb", "middle"))
    # 3. raster grid with a triangle
    gx, gy, g, n = xs[2] + 22, top + 10, 13, 7
    tri = [(gx + 0.6 * g, gy + 6.4 * g), (gx + 6.6 * g, gy + 5.2 * g), (gx + 3.0 * g, gy + 0.5 * g)]

    def inside(px, py):
        (x1, y1), (x2, y2), (x3, y3) = tri
        d = lambda ax, ay, bx, by, cx, cy: (ax - cx) * (by - cy) - (bx - cx) * (ay - cy)
        d1, d2, d3 = d(px, py, x1, y1, x2, y2), d(px, py, x2, y2, x3, y3), d(px, py, x3, y3, x1, y1)
        return not ((d1 < 0 or d2 < 0 or d3 < 0) and (d1 > 0 or d2 > 0 or d3 > 0))
    for r in range(n):
        for k in range(n):
            cx, cy = gx + k * g + g / 2, gy + r * g + g / 2
            b.append(box(gx + k * g, gy + r * g, g - 1, g - 1, "m" if inside(cx, cy) else "s", rx=1))
    b.append('<polygon points="%s" fill="none" stroke="%s" stroke-width="1.4"/>'
             % (" ".join("%.1f,%.1f" % p for p in tri), BLUE))
    # 4. shading: a surface, its normal and the light
    sx0, sy0 = xs[3] + 26, top + 70
    b.append('<path d="M%.1f,%.1f L%.1f,%.1f" stroke="%s" stroke-width="3"/>' % (sx0, sy0, sx0 + 120, sy0, ACC))
    b.append(arrow(sx0 + 60, sy0, sx0 + 60, sy0 - 52))
    b.append(text(sx0 + 66, sy0 - 44, "n", "mo"))
    b.append('<circle cx="%.1f" cy="%.1f" r="7" fill="%s"/>' % (sx0 + 118, sy0 - 62, WARN))
    b.append(arrow(sx0 + 110, sy0 - 56, sx0 + 66, sy0 - 6))
    b.append(text(sx0 + 128, sy0 - 52, "luz" if es else "light", "sb"))
    b.append(text(xs[3] + cw / 2, top + ph - 20, L["dot"][0], "sb", "middle"))
    b.append(text(xs[3] + cw / 2, top + ph - 6, L["dot"][1], "sb", "middle"))
    b.append(text(W / 2, H - 14, L["note"], "tx", "middle"))
    return svg(W, H, L["aria"], b)


# ─── 2. cpu-y-gpu (the post's cover) ─────────────────────────────────────────────────────────────

def fig_cpu_gpu(es):
    L = {
        True: dict(cpu="CPU", gpu="GPU", core="núcleo", ctl="control", cache="caché", alu="arit.",
                   l3="caché compartida", mem="memoria", sm="multiprocesador",
                   k=(("w", "control"), ("b", "caché"), ("m", "aritmética")),
                   cs="pocos núcleos grandes, un hilo rápido", gs="miles de núcleos sencillos, miles de hilos",
                   aria="Esquema de dos chips, no a escala. A la izquierda, una CPU: cuatro núcleos grandes, cada "
                        "uno con una parte de control (predicción de saltos, ejecución fuera de orden), una caché "
                        "propia y una unidad de aritmética pequeña, y debajo una caché grande compartida; la "
                        "memoria, a la derecha, unida por un conducto estrecho. A la derecha, una GPU: una "
                        "cuadrícula de multiprocesadores, cada uno con una franja fina de control y caché y muchas "
                        "celdas pequeñas de aritmética, y una memoria unida por un conducto ancho. Leyenda: control, "
                        "caché y aritmética."),
        False: dict(cpu="CPU", gpu="GPU", core="core", ctl="control", cache="cache", alu="arith.",
                    l3="shared cache", mem="memory", sm="multiprocessor",
                    k=(("w", "control"), ("b", "cache"), ("m", "arithmetic")),
                    cs="a few big cores, one fast thread", gs="thousands of simple cores, thousands of threads",
                    aria="Schematic of two chips, not to scale. On the left, a CPU: four big cores, each with a "
                         "control part (branch prediction, out-of-order execution), its own cache and a small "
                         "arithmetic unit, and below them a large shared cache; the memory, on the right, joined by "
                         "a narrow channel. On the right, a GPU: a grid of multiprocessors, each with a thin strip "
                         "of control and cache and many small arithmetic cells, and a memory joined by a wide "
                         "channel. Legend: control, cache and arithmetic."),
    }[es]
    W, H = 760, 270
    b = []
    legend(b, L["k"], W - 16)
    # CPU
    cx, cy, cw, ch = 16, 48, 268, 196
    b.append(text(cx, 34, L["cpu"], "lb"))
    b.append(text(cx + 34, 34, L["cs"], "sb"))
    b.append(box(cx, cy, cw, ch, "g"))
    kw, kh = 124, 64
    for i in range(4):
        x = cx + 8 + (i % 2) * (kw + 4)
        y = cy + 8 + (i // 2) * (kh + 4)
        b.append(box(x, y, kw, kh, "g", rx=2))
        b.append(box(x + 3, y + 3, 64, kh - 6, "w", rx=2))
        b.append(text(x + 35, y + kh / 2 + 4, L["ctl"], "sb", "middle"))
        b.append(box(x + 70, y + 3, 51, 34, "b", rx=2))
        b.append(text(x + 95.5, y + 24, L["cache"], "sb", "middle"))
        b.append(box(x + 70, y + 40, 51, kh - 43, "m", rx=2))
        b.append(text(x + 95.5, y + 55, L["alu"], "sb", "middle"))
    b.append(box(cx + 8, cy + 148, cw - 16, 40, "b", rx=2))
    b.append(text(cx + cw / 2, cy + 172, L["l3"], "tx", "middle"))
    mx = cx + cw + 22
    b.append(box(mx, cy + 60, 52, 76, "s"))
    b.append(text(mx + 26, cy + 102, L["mem"], "sb", "middle"))
    b.append(box(cx + cw, cy + 94, 22, 8, "s", rx=1))
    # GPU
    gx, gy, gw, gh = 380, 48, 268, 196
    b.append(text(gx, 34, L["gpu"], "lb"))
    b.append(text(gx + 34, 34, L["gs"], "sb"))
    b.append(box(gx, gy, gw, gh, "g"))
    smw, smh = 62, 44
    for r in range(4):
        for k in range(4):
            x = gx + 8 + k * (smw + 2)
            y = gy + 8 + r * (smh + 4)
            b.append(box(x, y, smw, smh, "g", rx=2))
            b.append(box(x + 2, y + 2, smw - 4, 5, "w", rx=1))
            b.append(box(x + 2, y + 8, smw - 4, 5, "b", rx=1))
            for rr in range(3):
                for kk in range(8):
                    b.append(box(x + 3 + kk * 7.1, y + 16 + rr * 8.5, 5.6, 6.5, "f", rx=0.8))
    mx = gx + gw + 22
    b.append(box(mx, gy + 40, 52, 116, "s"))
    b.append(text(mx + 26, gy + 102, L["mem"], "sb", "middle"))
    b.append(box(gx + gw, gy + 62, 22, 72, "s", rx=1))
    return svg(W, H, L["aria"], b)


# ─── 3. capa-de-un-transformer ───────────────────────────────────────────────────────────────────

def fig_capa(es):
    L = {
        True: dict(att="Atención", ffn="Red feed-forward", inp="token", out="token",
                   q="consulta", k="clave", v="valor", cmp="comparar", mix="mezclar", o="salida",
                   up="ensanchar ×2", dn="estrechar",
                   rows="las de parámetros tienen 16 384 filas; debajo, sus columnas",
                   lg=(("w", "matriz de parámetros"), ("m", "multiplicación entre tokens, sin parámetros")),
                   foot="≈ 3 200 millones de parámetros por capa × 126 capas + vocabulario (128 000 tokens) "
                        "≈ 405 000 millones",
                   aria="Una capa de Llama 3 405B como una fila de multiplicaciones de matrices, con sus tamaños. "
                        "Entra el vector de un token, de 16 384 números. Atención: consulta, una matriz de "
                        "16 384 × 16 384; clave y valor, dos de 16 384 × 1 024; comparar consultas con claves y "
                        "mezclar valores, dos multiplicaciones más; salida, 16 384 × 16 384. Red feed-forward: dos "
                        "matrices de 16 384 × 53 248 y una de 53 248 × 16 384. Sale otro vector de 16 384 números. "
                        "Debajo: unos 3 200 millones de parámetros por capa, por 126 capas, más el vocabulario de "
                        "128 000 tokens, unos 405 000 millones."),
        False: dict(att="Attention", ffn="Feed-forward network", inp="token", out="token",
                    q="query", k="key", v="value", cmp="compare", mix="mix", o="output",
                    up="widen ×2", dn="narrow",
                    rows="the parameter matrices have 16,384 rows; below, their columns",
                    lg=(("w", "parameter matrix"), ("m", "multiplication between tokens, no parameters")),
                    foot="≈ 3.2 billion parameters per layer × 126 layers + vocabulary (128,000 tokens) "
                         "≈ 405 billion",
                    aria="One layer of Llama 3 405B as a row of matrix multiplications, with their sizes. In comes "
                         "the vector of one token, 16,384 numbers. Attention: query, a 16,384 × 16,384 matrix; key "
                         "and value, two of 16,384 × 1,024; comparing queries with keys and mixing values, two more "
                         "multiplications; output, 16,384 × 16,384. Feed-forward network: two 16,384 × 53,248 "
                         "matrices and one of 53,248 × 16,384. Out comes another vector of 16,384 numbers. Below: "
                         "about 3.2 billion parameters per layer, times 126 layers, plus the 128,000-token "
                         "vocabulary, about 405 billion."),
    }[es]
    n = lambda v: num(v, es)
    W, H = 760, 250
    b = []
    legend(b, L["lg"], W - 16)
    y0 = 56
    # input vector
    b.append(box(16, y0 + 20, 14, 100, "b", rx=2))
    b.append(text(23, y0 + 136, L["inp"], "sb", "middle"))
    b.append(text(23, y0 + 150, n(16384), "tx", "middle"))
    # attention group
    ax, aw = 46, 382
    b.append(box(ax, y0 - 20, aw, 176, "g"))
    b.append(text(ax + 10, y0 - 4, L["att"], "lb"))
    # weight matrices drawn with heights proportional-ish (not to scale): 16 384 square vs 1 024 wide
    col = [
        (L["q"], 16384, 16384, "w"), (L["k"], 16384, 1024, "w"), (L["v"], 16384, 1024, "w"),
    ]
    x = ax + 12
    for lab, r, c, cls in col:
        wpx = 54 if c == 16384 else 14
        b.append(box(x, y0 + 20, wpx, 70, cls, rx=2))
        b.append(text(x + wpx / 2, y0 + 106, lab, "tx", "middle"))
        b.append(text(x + wpx / 2, y0 + 120, n(c), "tx", "middle"))
        x += wpx + (22 if c == 16384 else 26)
    # compare / mix (activation x activation)
    for lab in (L["cmp"], L["mix"]):
        b.append(box(x, y0 + 32, 46, 46, "m", rx=2))
        b.append(text(x + 23, y0 + 59, "×", "lb", "middle"))
        b.append(text(x + 23, y0 + 106, lab, "tx", "middle"))
        x += 62
    b.append(box(x, y0 + 20, 54, 70, "w", rx=2))
    b.append(text(x + 27, y0 + 106, L["o"], "tx", "middle"))
    b.append(text(x + 27, y0 + 120, n(16384), "tx", "middle"))
    b.append(text(ax + aw / 2, y0 + 146, L["rows"], "sb", "middle"))
    # FFN group
    fx, fw = ax + aw + 14, 252
    b.append(box(fx, y0 - 20, fw, 176, "g"))
    b.append(text(fx + 10, y0 - 4, L["ffn"], "lb"))
    b.append(box(fx + 12, y0 + 20, 120, 54, "w", rx=2))
    b.append(text(fx + 72, y0 + 52, L["up"], "tx", "middle"))
    b.append(text(fx + 72, y0 + 92, "%s × %s" % (n(16384), n(53248)), "tx", "middle"))
    b.append(box(fx + 148, y0 + 14, 54, 120, "w", rx=2))
    b.append(text(fx + 175, y0 + 78, L["dn"], "tx", "middle"))
    b.append(text(fx + 175, y0 + 150, "%s × %s" % (n(53248), n(16384)), "tx", "middle"))
    b.append(text(fx + 72, y0 + 120, "(SwiGLU)", "sb", "middle"))
    # output vector
    ox = fx + fw + 14
    b.append(box(ox, y0 + 20, 14, 100, "b", rx=2))
    b.append(text(ox + 7, y0 + 136, L["out"], "sb", "middle"))
    b.append(text(ox + 7, y0 + 150, n(16384), "tx", "middle"))
    b.append(text(W / 2, H - 12, L["foot"], "tx", "middle"))
    return svg(W, H, L["aria"], b)


# ─── 4. techo (roofline) ─────────────────────────────────────────────────────────────────────────

H100 = (989.0, 3.35)       # TFLOPS dense BF16, TB/s
XEON = (262.144, 0.8448)   # 128 x 1024 x 2.0 GHz; 12 x 8800 MT/s x 8 B


def fig_techo(es):
    L = {
        True: dict(y="billones de operaciones por segundo (TFLOPS, BF16)",
                   x="intensidad aritmética: operaciones por byte leído de memoria",
                   h="H100: 989 TFLOPS, 3,35 TB/s", c="Xeon 6980P: ≈ 262 TFLOPS, 845 GB/s",
                   d1="decodificar, 1 persona", d64="decodificar, 64 a la vez", tr="entrenar o prefill",
                   mem="manda la memoria", alu="manda la aritmética",
                   aria="Gráfico en escala logarítmica en los dos ejes. Horizontal: intensidad aritmética, "
                        "operaciones por byte leído, de 0,1 a 10 000. Vertical: billones de operaciones por "
                        "segundo (TFLOPS), de 0,1 a 2 000. Dos curvas con forma de tejado: suben en diagonal "
                        "mientras manda la memoria y se aplanan en el máximo de cálculo. H100: sube con sus "
                        "3,35 TB/s y se aplana en 989 TFLOPS hacia las 295 operaciones por byte. Xeon 6980P: sube "
                        "con sus 845 GB/s y se aplana en unos 262 TFLOPS hacia las 310. Tres marcas verticales: "
                        "decodificar para una persona, 1 operación por byte, donde la H100 da 3,35 TFLOPS; "
                        "decodificar para 64 a la vez, 64 operaciones por byte, 214 TFLOPS; y entrenar o prefill, "
                        "unas 5 000 operaciones por byte, en el máximo de los dos chips."),
        False: dict(y="trillions of operations per second (TFLOPS, BF16)",
                    x="arithmetic intensity: operations per byte read from memory",
                    h="H100: 989 TFLOPS, 3.35 TB/s", c="Xeon 6980P: ≈ 262 TFLOPS, 845 GB/s",
                    d1="decode, 1 person", d64="decode, 64 at once", tr="training or prefill",
                    mem="memory-bound", alu="compute-bound",
                    aria="Chart with logarithmic scales on both axes. Horizontal: arithmetic intensity, operations "
                         "per byte read, from 0.1 to 10,000. Vertical: trillions of operations per second (TFLOPS), "
                         "from 0.1 to 2,000. Two roof-shaped curves: they rise diagonally while memory is the limit "
                         "and flatten at the compute peak. H100: rises with its 3.35 TB/s and flattens at 989 "
                         "TFLOPS at about 295 operations per byte. Xeon 6980P: rises with its 845 GB/s and "
                         "flattens at about 262 TFLOPS at about 310. Three vertical marks: decoding for one person, "
                         "1 operation per byte, where the H100 gives 3.35 TFLOPS; decoding for 64 at once, 64 "
                         "operations per byte, 214 TFLOPS; and training or prefill, about 5,000 operations per "
                         "byte, at the peak of both chips."),
    }[es]
    W, H = 760, 330
    left, right, top, bottom = 64, 24, 30, 262
    xmin, xmax, ymin, ymax = 0.1, 10000, 0.1, 2000
    lx = lambda v: (math.log10(v) - math.log10(xmin)) / (math.log10(xmax) - math.log10(xmin))
    ly = lambda v: (math.log10(v) - math.log10(ymin)) / (math.log10(ymax) - math.log10(ymin))
    sx = lambda v: left + lx(v) * (W - left - right)
    sy = lambda v: bottom - ly(v) * (bottom - top)
    b = [text(16, 16, L["y"], "sb")]
    for v in (0.1, 1, 10, 100, 1000):
        b.append(line(left, sy(v), W - right, sy(v), "gl" if v > 0.1 else "ed"))
        b.append(text(left - 8, sy(v) + 4, num(v, es, 1 if v < 1 else 0), "sb", "end"))
    for v in (0.1, 1, 10, 100, 1000, 10000):
        b.append(line(sx(v), bottom, sx(v), bottom + 4))
        b.append(text(sx(v), bottom + 17, num(v, es, 1 if v < 1 else 0), "tx", "middle"))
    b.append(text((left + W - right) / 2, bottom + 38, L["x"], "sb", "middle"))
    for (peak, bw), colr, lab, dy in ((H100, ACC, L["h"], -10), (XEON, BLUE, L["c"], 16)):
        ridge = peak / bw
        x0 = max(xmin, ymin / bw)
        pts = [(sx(x0), sy(x0 * bw)), (sx(ridge), sy(peak)), (sx(xmax), sy(peak))]
        b.append('<polyline points="%s" fill="none" stroke="%s" stroke-width="2.2"/>'
                 % (" ".join("%.1f,%.1f" % p for p in pts), colr))
        b.append('<circle cx="%.1f" cy="%.1f" r="3.5" fill="%s"/>' % (sx(ridge), sy(peak), colr))
        if colr == ACC:
            b.append(text(sx(ridge) - 12, sy(peak) + 4, lab, "tx m", "end"))
        else:
            b.append(text(sx(ridge) + 10, sy(peak) + dy, lab, "tx b"))
    for v, lab in ((1, L["d1"]), (64, L["d64"]), (5461, L["tr"])):
        b.append(line(sx(v), top + 4, sx(v), bottom, "rf"))
        yy = sy(min(v * H100[1], H100[0]))
        b.append('<circle cx="%.1f" cy="%.1f" r="4" fill="%s"/>' % (sx(v), yy, TXT))
        anchor = "end" if v > 1000 else None
        b.append(text(sx(v) + (-6 if anchor else 6), bottom - 8, lab, "sb", anchor))
    b.append(text(sx(0.12), sy(3), L["mem"], "sb"))
    b.append(text(sx(2000), sy(H100[0]) - 10, L["alu"], "sb", "middle"))
    return svg(W, H, L["aria"], b)


# ─── 5. tres-formas ──────────────────────────────────────────────────────────────────────────────

def fig_tres(es):
    L = {
        True: dict(t1=("Núcleos de una GPU", "32 hilos, la misma instrucción"),
                   t2=("Núcleo tensorial", "D = A × B + C, de 4×4"),
                   t3=("Matriz sistólica (TPU)", "256 × 256 en el chip real"),
                   f1="1 multiplicación y suma por hilo y ciclo", f2="64 multiplicaciones y sumas por paso",
                   f3="cada dato se usa en toda la fila", data="datos", part="sumas",
                   aria="Tres esquemas, uno al lado del otro, de cómo un chip multiplica matrices. Uno, núcleos de "
                        "una GPU: 32 hilos de un warp en fila, cada uno con su multiplicación y su suma por ciclo, "
                        "la misma instrucción para todos. Dos, núcleo tensorial: dos matrices de 4×4, A y B, entran "
                        "juntas y sale D igual a A por B más C, 64 multiplicaciones y sumas en un paso. Tres, "
                        "matriz sistólica de la TPU: una cuadrícula de celdas; los parámetros están cargados en las "
                        "celdas, los datos entran por la izquierda y los resultados parciales bajan de celda en "
                        "celda hasta salir por abajo, de modo que cada número leído se usa en toda una fila."),
        False: dict(t1=("GPU cores", "32 threads, the same instruction"),
                    t2=("Tensor core", "D = A × B + C, 4×4"),
                    t3=("Systolic array (TPU)", "256 × 256 in the real chip"),
                    f1="1 multiply-add per thread per cycle", f2="64 multiply-adds per step",
                    f3="each input is used along a whole row", data="inputs", part="sums",
                    aria="Three schematics, side by side, of how a chip multiplies matrices. One, GPU cores: the 32 "
                         "threads of a warp in a row, each with its own multiply and add per cycle, the same "
                         "instruction for all. Two, tensor core: two 4×4 matrices, A and B, go in together and D "
                         "equals A times B plus C comes out, 64 multiply-adds in one step. Three, the TPU's systolic "
                         "array: a grid of cells; the parameters are loaded into the cells, the inputs come in from "
                         "the left and the partial sums move down from cell to cell until they leave at the bottom, "
                         "so each number read is used along a whole row."),
    }[es]
    W, H = 760, 250
    pw, top = 236, 52
    xs = [16, 16 + pw + 16, 16 + 2 * (pw + 16)]
    b = []
    for x, (t, s), f in zip(xs, (L["t1"], L["t2"], L["t3"]), (L["f1"], L["f2"], L["f3"])):
        b.append(text(x, 22, t, "lb"))
        b.append(text(x, 38, s, "sb"))
        b.append(box(x, top, pw, 160, "g"))
        b.append(text(x + pw / 2, top + 178, f, "sb", "middle"))
    # 1. SIMT lanes: 32 tiny lanes in 4 rows of 8, a shared instruction bar on top
    x0 = xs[0]
    b.append(box(x0 + 14, top + 14, pw - 28, 18, "w", rx=2))
    b.append(text(x0 + pw / 2, top + 27, "a ← a + x · y", "mo", "middle"))
    for r in range(4):
        for k in range(8):
            b.append(box(x0 + 18 + k * 25.5, top + 44 + r * 27, 21, 21, "m", rx=2))
            b.append(text(x0 + 28.5 + k * 25.5, top + 58 + r * 27, "×+", "sb", "middle"))
    # 2. tensor core: A (4x4) x B (4x4) + C -> D
    x0 = xs[1]
    c = 11

    def mat(x, y, cls, lab):
        for r in range(4):
            for k in range(4):
                b.append(box(x + k * c, y + r * c, c - 1.5, c - 1.5, cls, rx=0.8))
        b.append(text(x + 2 * c, y + 4 * c + 14, lab, "mo", "middle"))
    mat(x0 + 12, top + 50, "b", "A")
    b.append(text(x0 + 12 + 4 * c + 8, top + 50 + 2 * c + 4, "×", "tx", "middle"))
    mat(x0 + 12 + 4 * c + 16, top + 50, "b", "B")
    b.append(text(x0 + 12 + 8 * c + 24, top + 50 + 2 * c + 4, "+", "tx", "middle"))
    mat(x0 + 12 + 8 * c + 32, top + 50, "s", "C")
    b.append(arrow(x0 + 12 + 12 * c + 36, top + 50 + 2 * c, x0 + 12 + 12 * c + 52, top + 50 + 2 * c))
    mat(x0 + 12 + 12 * c + 56, top + 50, "m", "D")
    # 3. systolic array: 6x6 cells, inputs from the left, partial sums down
    x0 = xs[2]
    g, gx, gy = 19, x0 + 66, top + 22
    for r in range(6):
        for k in range(6):
            b.append(box(gx + k * g, gy + r * g, g - 3, g - 3, "w", rx=1.5))
    for r in range(6):
        b.append(arrow(gx - 26, gy + r * g + 8, gx - 4, gy + r * g + 8))
    b.append(text(gx - 32, gy + 3 * g + 4, L["data"], "sb", "end"))
    for k in range(6):
        b.append(arrow(gx + k * g + 8, gy + 6 * g, gx + k * g + 8, gy + 6 * g + 14))
    b.append(text(gx + 6 * g + 6, gy + 6 * g + 12, L["part"], "sb"))
    b.append('<path class="ar" d="M%.1f,%.1f L%.1f,%.1f" stroke="%s"/>' % (gx + 8, gy + 2.5 * g, gx + 5.2 * g, gy + 2.5 * g, ACC))
    return svg(W, H, L["aria"], b)


# ─── 6. linea-de-tiempo ──────────────────────────────────────────────────────────────────────────

def fig_linea(es):
    ev = [  # (year, (es, sub), (en, sub), family: game | calc | ai)
        (1996, ("Voodoo Graphics", "texturas"), ("Voodoo Graphics", "textures"), "game"),
        (1997, ("GLQuake", "con aceleradora"), ("GLQuake", "with an accelerator"), "game"),
        (1999, ("GeForce 256", "la primera GPU"), ("GeForce 256", "the first GPU"), "game"),
        (2001, ("GeForce 3", "programable"), ("GeForce 3", "programmable"), "game"),
        (2007, ("CUDA", "programar la GPU"), ("CUDA", "programming the GPU"), "calc"),
        (2009, ("Redes en GPU", "70× más deprisa"), ("Nets on GPUs", "up to 70× faster"), "calc"),
        (2012, ("AlexNet", "dos GTX 580"), ("AlexNet", "two GTX 580s"), "calc"),
        (2015, ("TPU", "matriz sistólica"), ("TPU", "systolic array"), "ai"),
        (2017, ("Núcleos tensoriales", "y el transformer"), ("Tensor cores", "and the transformer"), "ai"),
        (2022, ("H100", "FP8"), ("H100", "FP8"), "ai"),
        (2024, ("B200", "FP4"), ("B200", "FP4"), "ai"),
        (2025, ("Ironwood", "TPU para inferir"), ("Ironwood", "an inference TPU"), "ai"),
    ]
    col = {"game": (BLUE, "b"), "calc": (ACC, "m"), "ai": (WARN, "w")}
    L = {
        True: dict(k=(("game", "videojuegos"), ("calc", "la GPU para calcular"), ("ai", "chips para IA")),
                   aria="Línea de tiempo, no a escala, con doce hitos. En azul, los videojuegos: 1996, Voodoo "
                        "Graphics, rasteriza y pega texturas; 1997, GLQuake, Quake con aceleradora; 1999, GeForce "
                        "256, la primera GPU, transforma los vértices; 2001, GeForce 3, shaders programables. En "
                        "verde, la GPU para calcular: 2007, CUDA; 2009, redes en GPU, hasta 70 veces más deprisa; "
                        "2012, AlexNet, en dos GTX 580. En naranja, chips para IA: 2015, TPU, la matriz sistólica "
                        "de Google; 2017, núcleos tensoriales en la V100, el mismo año del transformer; 2022, H100, "
                        "FP8; 2024, B200, FP4; 2025, Ironwood, TPU para inferencia."),
        False: dict(k=(("game", "video games"), ("calc", "the GPU for computing"), ("ai", "AI chips")),
                    aria="Timeline, not to scale, with twelve milestones. In blue, video games: 1996, Voodoo "
                         "Graphics, rasterises and applies textures; 1997, GLQuake, Quake with an accelerator; "
                         "1999, GeForce 256, the first GPU, transforms the vertices; 2001, GeForce 3, programmable "
                         "shaders. In green, the GPU for computing: 2007, CUDA; 2009, networks on GPUs, up to 70 "
                         "times faster; 2012, AlexNet, on two GTX 580s. In orange, AI chips: 2015, TPU, Google's "
                         "systolic array; 2017, tensor cores in the V100, the same year as the transformer; 2022, "
                         "H100, FP8; 2024, B200, FP4; 2025, Ironwood, an inference TPU."),
    }[es]
    W, H, Y = 760, 176, 102
    b = [line(8, Y, W - 8, Y, "ed")]
    step = (W - 72 - 62) / (len(ev) - 1)
    for i, (yr, tes, ten, fam) in enumerate(ev):
        x = 72 + i * step
        t = tes if es else ten
        c, cls = col[fam]
        b.append('<circle cx="%.1f" cy="%d" r="4.5" fill="%s"/>' % (x, Y, c))
        up = i % 2 == 0
        b.append(line(x, Y + (-7 if up else 7), x, Y + (-17 if up else 17), "ed"))
        ty = Y - 48 if up else Y + 31
        b.append(text(x, ty, str(yr), "lb " + cls, "middle"))
        b.append(text(x, ty + 14, t[0], "tx", "middle"))
        b.append(text(x, ty + 27, t[1], "sb", "middle"))
    kx = W - 16
    for fam, label in reversed(L["k"]):
        w = 6.4 * len(label) + 22
        kx -= w
        b.append('<circle cx="%d" cy="12" r="4.5" fill="%s"/>' % (kx, col[fam][0]))
        b.append(text(kx + 10, 16, label, "sb"))
        kx -= 10
    return svg(W, H, L["aria"], b)


for name, fn in (("vertice-a-pixel", fig_vertice), ("cpu-y-gpu", fig_cpu_gpu),
                 ("capa-de-un-transformer", fig_capa), ("techo", fig_techo),
                 ("tres-formas", fig_tres), ("linea-de-tiempo", fig_linea)):
    write(name, fn(True), fn(False))
print("ok:", OUT)
