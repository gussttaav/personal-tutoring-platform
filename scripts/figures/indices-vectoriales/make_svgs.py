"""BLOG-12 — Figures for the blog post `indices-vectoriales`.

Run from this directory: python3 make_svgs.py ../../../public/blog/indices-vectoriales
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

The benchmark chart reads benchmarks.json (written by extract_benchmarks.py from VIBE's published
results); nothing on it is measured by us. The geometry figures (LSH planes, IVF cells, the HNSW
walk) are computed here: the cells are real Voronoi cells of the drawn centres, and the HNSW path is
the greedy search actually run on the drawn graph. Nothing is placed by hand except the inputs.

If a value printed on a figure changes, the body quotes it too: 0,83 / 0,50 and 97 % / 30 % / 2 %
(LSH, b = 10, L = 20), 96 bytes / 3 072 bytes (PQ), and the VIBE values in the comparison table."""
import json, math, os, random, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; LINE = "#3b3b3e"
WARN = "#e8a24c"; BLUE = "#6fb1e8"; BAD = "#ffb4ab"; FAINT = "#5c6660"
FONT = "ui-sans-serif, system-ui, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .lbl {{ font-size: 12px; font-weight: 600; }}
  .sub {{ font-size: 11px; fill: {MUTED}; }}
  .tx {{ font-size: 12px; }}
  .sm {{ font-size: 11px; }}
  .tk {{ font-size: 10.5px; fill: {MUTED}; }}
  .big {{ font-size: 13px; font-weight: 600; }}
  .mono {{ font-family: {MONO}; font-size: 11px; }}
  .ax {{ stroke: {MUTED}; stroke-width: 1; }}
  .gr {{ stroke: {GRID}; stroke-width: 1; }}
</style>"""


def svg(w, h, aria, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img"\n aria-label="%s">\n%s\n%s\n</svg>\n'
            % (w, h, w, h, aria.replace('"', "&quot;"), STYLE, body))


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def text(x, y, s, cls="tx", anchor="start", color=None, extra=""):
    st = ' style="fill:%s"' % color if color else ""
    return '<text class="%s" x="%.1f" y="%.1f" text-anchor="%s"%s%s>%s</text>' % (cls, x, y, anchor, st, extra, esc(s))


def num(v, es, d=2):
    s = "%.*f" % (d, v)
    if s.startswith("-"):
        s = "−" + s[1:]
    return s.replace(".", ",") if es else s


def thousands(n, es):
    s = "{:,}".format(int(round(n)))
    return s.replace(",", " ") if es else s


def arrow_defs():
    out = []
    for name, col in (("a", ACC), ("w", WARN), ("m", MUTED), ("b", BLUE)):
        out.append('<marker id="h%s" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
                   '<path d="M0,0 L10,5 L0,10 z" fill="%s"/></marker>' % (name, col))
    return "<defs>" + "".join(out) + "</defs>"


def star(cx, cy, r, fill, stroke="none"):
    pts = []
    for i in range(10):
        a = math.pi / 2 + i * math.pi / 5
        rr = r if i % 2 == 0 else r * 0.45
        pts.append("%.1f,%.1f" % (cx + rr * math.cos(a), cy - rr * math.sin(a)))
    return '<polygon points="%s" fill="%s" stroke="%s" stroke-width="1.5"/>' % (" ".join(pts), fill, stroke)


# ---------------------------------------------------------------- figure 1: timeline
def fig_linea_de_tiempo(es):
    T = lambda a, b: a if es else b
    years = [1975, 1998, 2003, 2011, 2013, 2014, 2016, 2017, 2019, 2020, 2021, 2023, 2024, 2025]
    above = {  # algorithms and libraries
        1975: [T("árbol k-d", "k-d tree")], 1998: ["LSH"], 2003: [T("listas invertidas", "inverted lists"), "(Video Google)"],
        2011: [T("cuantización", "product"), T("por producto", "quantization")], 2013: ["Annoy"], 2014: ["NSW"],
        2016: ["HNSW"], 2017: ["Faiss"], 2019: ["DiskANN", "NSG"], 2020: ["ScaNN"],
        2021: ["SPANN", "FreshDiskANN"], 2023: ["Filtered-DiskANN"], 2024: ["RaBitQ", "ACORN"],
    }
    below = {  # databases and what they added
        2019: ["Milvus", T("Qdrant: HNSW filtrable", "Qdrant: filterable HNSW")], 2021: ["pgvector"],
        2023: ["pgvector:", "HNSW"],
        2024: [T("pgvector: búsqueda", "pgvector: iterative"), T("iterativa", "scans"), "Weaviate: ACORN"],
        2025: ["SQL Server:", "DiskANN"],
    }
    W, H, AX = 760, 218, 120
    x0, x1 = 40, W - 52
    xs = {y: x0 + i * (x1 - x0) / (len(years) - 1) for i, y in enumerate(years)}
    body = ['<line class="ax" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (x0 - 14, AX, x1 + 14, AX)]
    for y in years:
        x = xs[y]
        body.append('<circle cx="%.1f" cy="%d" r="3.5" fill="%s"/>' % (x, AX, TXT))
    # year labels on the axis, between the two rows
    for y in years:
        body.append('<rect x="%.1f" y="%d" width="34" height="14" fill="#131315"/>' % (xs[y] - 17, AX - 7))
        body.append(text(xs[y], AX + 4, str(y), "tk", "middle"))
    # staggered tiers so neighbouring labels never share a line
    for side, items, col in ((-1, above, ACC), (1, below, WARN)):
        tier = 0
        for y in years:
            if y not in items:
                continue
            lines = items[y]
            near = 22 if tier % 2 == 0 else 58
            tier += 1
            x = xs[y]
            if side < 0:
                ybase = AX - near
                body.append('<line stroke="%s" stroke-width="1" x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>' % (col, x, AX - 9, x, ybase + 3))
                for i, s in enumerate(reversed(lines)):
                    body.append(text(x, ybase - i * 13, s, "sm", "middle", col))
            else:
                ybase = AX + near
                body.append('<line stroke="%s" stroke-width="1" x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>' % (col, x, AX + 9, x, ybase - 11))
                for i, s in enumerate(lines):
                    body.append(text(x, ybase + i * 13, s, "sm", "middle", col))
    body.append(text(8, 14, T("Algoritmos y bibliotecas", "Algorithms and libraries"), "lbl", "start", ACC))
    body.append(text(8, AX + 34, T("Bases de datos", "Databases"), "lbl", "start", WARN))
    aria = ("Línea de tiempo, no a escala, con dos filas. Arriba, en verde, algoritmos y bibliotecas: 1975, el árbol k-d; 1998, el hashing "
            "sensible a la localidad; 2003, las listas invertidas de Video Google; 2011, la cuantización por producto; 2013, Annoy; 2014, NSW; "
            "2016, HNSW; 2017, Faiss; 2019, DiskANN y NSG; 2020, ScaNN; 2021, SPANN y FreshDiskANN; 2023, Filtered-DiskANN; 2024, RaBitQ y "
            "ACORN. Abajo, en naranja, bases de datos: 2019, Milvus y el HNSW filtrable de Qdrant; 2021, pgvector; 2023, HNSW en pgvector; "
            "2024, las búsquedas iterativas de pgvector y ACORN en Weaviate; 2025, DiskANN en SQL Server." if es else
            "Timeline, not to scale, in two rows. Above, in green, algorithms and libraries: 1975, the k-d tree; 1998, locality-sensitive "
            "hashing; 2003, Video Google's inverted lists; 2011, product quantization; 2013, Annoy; 2014, NSW; 2016, HNSW; 2017, Faiss; "
            "2019, DiskANN and NSG; 2020, ScaNN; 2021, SPANN and FreshDiskANN; 2023, Filtered-DiskANN; 2024, RaBitQ and ACORN. Below, in "
            "orange, databases: 2019, Milvus and Qdrant's filterable HNSW; 2021, pgvector; 2023, HNSW in pgvector; 2024, pgvector's iterative "
            "scans and ACORN in Weaviate; 2025, DiskANN in SQL Server.")
    return svg(W, H, aria, "\n".join(body))


# ---------------------------------------------------------------- figure 2: two decisions
def fig_dos_decisiones(es):
    T = lambda a, b: a if es else b
    rows = [T("Todo (fuerza bruta)", "Everything (brute force)"), T("Árboles", "Trees"), "Hashing (LSH)",
            T("Listas invertidas", "Inverted lists"), T("Grafo", "Graph")]
    cols = [(T("Vector entero", "Full vector"), T("3 072 bytes", "3,072 bytes")),
            (T("1 byte por número", "1 byte per number"), T("768 bytes", "768 bytes")),
            (T("Cuantización por producto", "Product quantization"), T("96 bytes", "96 bytes")),
            (T("1 bit por número", "1 bit per number"), T("96 bytes", "96 bytes"))]
    # Only names the article has introduced before the figure (it closes the "combinations" section);
    # an empty cell is a combination that is rare or that the article does not cover.
    cells = [
        [T("fuerza bruta (exacta)", "brute force (exact)"), "", "", T("binaria + reordenar", "binary + rerank")],
        [T("k-d, Annoy", "k-d, Annoy"), "", "", ""],
        ["LSH", "", "", ""],
        [T("IVF-Flat", "IVF-Flat"), "", "IVF-PQ, ScaNN", "IVF + RaBitQ"],
        ["HNSW, NSG, Vamana", "HNSW + int8", "DiskANN", ""],
    ]
    W, H = 760, 300
    lx, cw, top, hh, rh = 150, 152, 26, 40, 44
    body = []
    body.append(text(lx + 2 * cw, 14, T("Cuánto guardar de cada vector (768 dimensiones)", "How much of each vector to keep (768 dimensions)"), "lbl", "middle", BLUE))
    body.append('<text class="lbl" x="14" y="%d" text-anchor="middle" transform="rotate(-90 14 %d)" style="fill:%s">%s</text>'
                % (top + hh + 2.5 * rh, top + hh + 2.5 * rh, ACC, esc(T("Dónde mirar", "Where to look"))))
    for j, (name, size) in enumerate(cols):
        cx = lx + j * cw + cw / 2
        body.append(text(cx, top + 16, name, "sm", "middle"))
        body.append(text(cx, top + 31, size, "tk", "middle"))
    for i, rname in enumerate(rows):
        y = top + hh + i * rh
        body.append(text(lx - 10, y + rh / 2 + 4, rname, "sm", "end", ACC))
        for j in range(4):
            x = lx + j * cw
            s = cells[i][j]
            fill = "#1c1b1d" if s else "none"
            body.append('<rect x="%.1f" y="%.1f" width="%d" height="%d" rx="4" fill="%s" stroke="%s"/>' % (x + 3, y + 3, cw - 6, rh - 6, fill, LINE))
            body.append(text(x + cw / 2, y + rh / 2 + 4, s if s else "—", "sm" if s else "tk", "middle", None if s else FAINT))
    aria = ("Tabla de dos ejes. Las filas son dónde mirar: todo (fuerza bruta), árboles, hashing, listas invertidas y grafo. Las columnas son "
            "cuánto guardar de cada vector de 768 dimensiones: el vector entero, 3 072 bytes; un byte por número, 768; cuantización por "
            "producto, 96; un bit por número, 96. En cada celda, los índices de este artículo que hacen esa combinación. Todo: la fuerza "
            "bruta, exacta, con el vector entero, y la búsqueda binaria con reordenación. Árboles con el vector entero: el árbol k-d y Annoy. "
            "Hashing con el vector entero: LSH. Listas invertidas: IVF-Flat con el vector entero, IVF-PQ y ScaNN con cuantización por "
            "producto, e IVF con RaBitQ con un bit por número. Grafo: HNSW, NSG y Vamana con el vector entero, HNSW con un byte por número "
            "y DiskANN con cuantización por producto. Las demás celdas están vacías." if es else
            "Two-axis table. Rows are where to look: everything (brute force), trees, hashing, inverted lists and graph. Columns are how much "
            "of each 768-dimensional vector to keep: the full vector, 3,072 bytes; one byte per number, 768; product quantization, 96; one "
            "bit per number, 96. Each cell holds this article's indexes that make that combination. Everything: brute force, exact, with the "
            "full vector, and binary search with reranking. Trees with the full vector: the k-d tree and Annoy. Hashing with the full vector: "
            "LSH. Inverted lists: IVF-Flat with the full vector, IVF-PQ and ScaNN with product quantization, and IVF with RaBitQ at one bit "
            "per number. Graph: HNSW, NSG and Vamana with the full vector, HNSW with one byte per number and DiskANN with product "
            "quantization. The other cells are empty.")
    return svg(W, H, aria, "\n".join(body))


# ---------------------------------------------------------------- figure 3: LSH, random planes
def lsh_found(theta_deg, b=10, L=20):
    p = 1 - theta_deg / 180
    return 1 - (1 - p ** b) ** L


def fig_lsh(es):
    T = lambda a, b: a if es else b
    W, H = 720, 300
    cx, cy, R = 150, 150, 112
    a_ang, b_ang = 20, 50
    lines = [10, 38, 72, 104, 133, 161]  # directions mod 180°; one in six falls inside the 30° angle
    body = [arrow_defs(), '<circle cx="%d" cy="%d" r="%d" fill="none" stroke="%s" stroke-width="1"/>' % (cx, cy, R, LINE)]
    for ang in lines:
        sep = a_ang < ang < b_ang
        col, wdt = (WARN, 2) if sep else (FAINT, 1.2)
        dx, dy = (R + 14) * math.cos(math.radians(ang)), (R + 14) * math.sin(math.radians(ang))
        body.append('<line stroke="%s" stroke-width="%.1f" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (col, wdt, cx - dx, cy + dy, cx + dx, cy - dy))
    # the angle between a and b, shaded
    def pt(r, ang):
        return cx + r * math.cos(math.radians(ang)), cy - r * math.sin(math.radians(ang))
    p0, p1 = pt(R, a_ang), pt(R, b_ang)
    body.append('<path d="M%d,%d L%.1f,%.1f A%d,%d 0 0 0 %.1f,%.1f Z" fill="%s" fill-opacity="0.12"/>' % (cx, cy, p0[0], p0[1], R, R, p1[0], p1[1], ACC))
    for ang, name in ((a_ang, "a"), (b_ang, "b")):
        x, y = pt(R - 6, ang)
        body.append('<line stroke="%s" stroke-width="2.4" x1="%d" y1="%d" x2="%.1f" y2="%.1f" marker-end="url(#ha)"/>' % (ACC, cx, cy, x, y))
        lx, ly = pt(R + 10, ang)
        body.append(text(lx + 2, ly + 4, name, "big"))
    mx, my = pt(42, (a_ang + b_ang) / 2)
    body.append(text(mx + 6, my + 4, "θ", "sm"))
    x0 = 320
    body.append(text(x0, 40, T("Un plano al azar por el origen da un bit:", "A random plane through the origin gives one bit:"), "lbl"))
    body.append(text(x0, 58, T("de qué lado cae cada vector.", "which side each vector falls on."), "tx"))
    body.append(text(x0, 84, T("Separa a y b sólo si cae dentro del ángulo θ.", "It separates a and b only if it falls inside θ."), "tx", "start", WARN))
    body.append(text(x0, 102, T("Probabilidad de que lo haga: θ / π.", "Probability that it does: θ / π."), "tx"))
    body.append('<line class="gr" x1="%d" y1="118" x2="%d" y2="118"/>' % (x0, W - 20))
    body.append(text(x0, 140, T("Mismo bit, 1 − θ / 180°:", "Same bit, 1 − θ / 180°:"), "lbl"))
    for i, th in enumerate((30, 90)):
        body.append(text(x0, 160 + i * 18, "θ = %d°" % th, "tx"))
        body.append(text(x0 + 140, 160 + i * 18, num(1 - th / 180, es), "tx", "end"))
    body.append(text(x0, 208, T("Candidato con 10 bits y 20 tablas:", "Candidate with 10 bits and 20 tables:"), "lbl"))
    for i, th in enumerate((30, 60, 90)):
        body.append(text(x0, 228 + i * 18, "θ = %d°" % th, "tx"))
        body.append(text(x0 + 140, 228 + i * 18, ("%d %%" if es else "%d%%") % round(100 * lsh_found(th)), "tx", "end"))
    aria = ("Un círculo con dos vectores, a y b, que forman un ángulo de treinta grados, y seis rectas al azar que pasan por el centro. La "
            "única recta que cae dentro del ángulo entre a y b, en naranja, los separa y les da bits distintos; las demás, en gris, los dejan "
            "del mismo lado. A la derecha, la cuenta: una recta al azar cae dentro del ángulo con probabilidad theta entre pi, así que dos "
            "vectores a treinta grados reciben el mismo bit con probabilidad 0,83, y dos perpendiculares, con 0,50. Con claves de 10 bits y "
            "20 tablas, un vector a 30 grados sale como candidato el 97 % de las veces; a 60 grados, el 30 %; a 90 grados, el 2 %." if es else
            "A circle with two vectors, a and b, thirty degrees apart, and six random lines through the centre. The only line inside the "
            "angle between a and b, in orange, separates them and gives them different bits; the others, in grey, leave them on the same "
            "side. On the right, the arithmetic: a random line falls inside the angle with probability theta over pi, so two vectors thirty "
            "degrees apart get the same bit with probability 0.83, and two perpendicular ones with 0.50. With 10-bit keys and 20 tables, a "
            "vector at 30 degrees comes out as a candidate 97% of the time; at 60 degrees, 30%; at 90 degrees, 2%.")
    return svg(W, H, aria, "\n".join(body))


# ---------------------------------------------------------------- figure 4: IVF cells
def clip(poly, a, b, c):
    """Keep the part of convex polygon `poly` where a*x + b*y <= c (Sutherland–Hodgman)."""
    out = []
    n = len(poly)
    for i in range(n):
        p, q = poly[i], poly[(i + 1) % n]
        fp, fq = a * p[0] + b * p[1] - c, a * q[0] + b * q[1] - c
        if fp <= 0:
            out.append(p)
        if (fp <= 0) != (fq <= 0):
            t = fp / (fp - fq)
            out.append((p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])))
    return out


def voronoi_cell(i, cents, box):
    poly = box
    ci = cents[i]
    for j, cj in enumerate(cents):
        if j == i:
            continue
        # |x - ci|² <= |x - cj|²  <=>  2 (cj - ci)·x <= |cj|² - |ci|²
        a, b = 2 * (cj[0] - ci[0]), 2 * (cj[1] - ci[1])
        c = cj[0] ** 2 + cj[1] ** 2 - ci[0] ** 2 - ci[1] ** 2
        poly = clip(poly, a, b, c)
    return poly


def d2(p, q):
    return (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2


def fig_ivf(es):
    T = lambda a, b: a if es else b
    W, H = 720, 380
    X0, Y0, PW, PH = 16, 16, 440, 348
    box = [(X0, Y0), (X0 + PW, Y0), (X0 + PW, Y0 + PH), (X0, Y0 + PH)]
    cents = [(80, 70), (215, 55), (370, 80), (95, 200), (240, 185), (390, 215), (70, 320), (220, 315), (380, 330)]
    rnd = random.Random(12)
    pts = []
    for c in cents:
        for _ in range(24):
            p = (c[0] + rnd.gauss(0, 34), c[1] + rnd.gauss(0, 30))
            if X0 + 6 < p[0] < X0 + PW - 6 and Y0 + 6 < p[1] < Y0 + PH - 6:
                pts.append(p)
    # the query sits next to the vertex shared by cells A, B, C, just inside A, with B the second-nearest;
    # its true nearest neighbour sits just across the border, in C, the third-nearest centre.
    A, B, C = 4, 1, 3   # centre indices
    ax, ay = cents[A]; bx, by = cents[B]; cx_, cy_ = cents[C]
    dd = 2 * (ax * (by - cy_) + bx * (cy_ - ay) + cx_ * (ay - by))
    vx = ((ax ** 2 + ay ** 2) * (by - cy_) + (bx ** 2 + by ** 2) * (cy_ - ay) + (cx_ ** 2 + cy_ ** 2) * (ay - by)) / dd
    vy = ((ax ** 2 + ay ** 2) * (cx_ - bx) + (bx ** 2 + by ** 2) * (ax - cx_) + (cx_ ** 2 + cy_ ** 2) * (bx - ax)) / dd
    def toward(p, q, r):
        L = math.dist(p, q)
        return (p[0] + (q[0] - p[0]) * r / L, p[1] + (q[1] - p[1]) * r / L)
    q = toward(toward((vx, vy), cents[A], 9), cents[B], 4)
    nn = toward((vx, vy), cents[C], 9)
    rq = math.dist(q, nn)
    pts = [p for p in pts if math.dist(p, q) > rq + 10] + [nn]
    order = sorted(range(len(cents)), key=lambda i: d2(q, cents[i]))
    probed = order[:2]
    assert probed == [A, B] and order[2] == C, order
    near = lambda p: min(range(len(cents)), key=lambda i: d2(p, cents[i]))
    assert near(nn) == C
    found = min((p for p in pts if near(p) in probed), key=lambda p: d2(p, q))
    body = []
    for i in range(len(cents)):
        poly = voronoi_cell(i, cents, box)
        fill = "#20302a" if i in probed else "none"
        body.append('<polygon points="%s" fill="%s" stroke="%s" stroke-width="1.2"/>'
                    % (" ".join("%.1f,%.1f" % p for p in poly), fill, LINE))
    for p in pts:
        if p == nn:
            continue
        inside = near(p) in probed
        body.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>' % (p[0], p[1], 3 if inside else 2.4, ACC if inside else FAINT))
    for i, c in enumerate(cents):
        col = ACC if i in probed else MUTED
        body.append('<rect x="%.1f" y="%.1f" width="9" height="9" fill="#131315" stroke="%s" stroke-width="1.6" transform="rotate(45 %.1f %.1f)"/>' % (c[0] - 4.5, c[1] - 4.5, col, c[0], c[1]))
    body.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="none" stroke="%s" stroke-width="1" stroke-dasharray="3 3"/>' % (q[0], q[1], math.dist(q, found), MUTED))
    body.append('<circle cx="%.1f" cy="%.1f" r="6" fill="none" stroke="%s" stroke-width="1.6"/>' % (found[0], found[1], ACC))
    body.append('<circle cx="%.1f" cy="%.1f" r="4.2" fill="%s"/>' % (nn[0], nn[1], WARN))
    body.append(star(q[0], q[1], 8, "#ffffff", "#131315"))
    x0 = 478
    leg = [
        ('star', T("la pregunta", "the query")),
        ('cent', T("centro de una celda", "a cell's centre")),
        ('probe', T("celdas visitadas (n_probe = 2)", "visited cells (n_probe = 2)")),
        ('found', T("el mejor que encuentra", "the best one it finds")),
        ('nn', T("el más cercano de verdad,", "the true nearest neighbour,")),
    ]
    y = 46
    for kind, s in leg:
        if kind == 'star':
            body.append(star(x0 + 6, y - 4, 7, "#ffffff", "#131315"))
        elif kind == 'cent':
            body.append('<rect x="%.1f" y="%.1f" width="9" height="9" fill="#131315" stroke="%s" stroke-width="1.6" transform="rotate(45 %.1f %.1f)"/>' % (x0 + 1.5, y - 8.5, MUTED, x0 + 6, y - 4))
        elif kind == 'probe':
            body.append('<rect x="%d" y="%d" width="13" height="11" fill="#20302a" stroke="%s"/>' % (x0, y - 10, LINE))
        elif kind == 'found':
            body.append('<circle cx="%d" cy="%d" r="6" fill="none" stroke="%s" stroke-width="1.6"/>' % (x0 + 6, y - 4, ACC))
        else:
            body.append('<circle cx="%d" cy="%d" r="4.2" fill="%s"/>' % (x0 + 6, y - 4, WARN))
        body.append(text(x0 + 22, y, s, "sm"))
        y += 26
    body.append(text(x0 + 22, y - 12, T("en una tercera celda que no se visita", "in a third cell that is never visited"), "sm"))
    body.append(text(x0, y + 26, T("Una pregunta compara con los centros,", "A query compares against the centres,"), "sub"))
    body.append(text(x0, y + 42, T("elige las celdas más cercanas y sólo", "picks the nearest cells and compares"), "sub"))
    body.append(text(x0, y + 58, T("compara con los puntos de esas celdas.", "only with the points in those cells."), "sub"))
    aria = ("Un plano dividido en nueve celdas por las fronteras de sus centros, con puntos repartidos en grupos. Una pregunta, marcada con una "
            "estrella, cae cerca de una esquina donde se tocan tres celdas. Las dos celdas cuyos centros están más cerca de la pregunta "
            "aparecen resaltadas, y sus puntos se comparan; un círculo discontinuo marca el mejor punto que encuentra la búsqueda. El vecino "
            "más cercano de verdad, en naranja, está justo al otro lado de la frontera, dentro de ese círculo, en una tercera celda que no se "
            "visita, y la búsqueda no lo encuentra." if es else
            "A plane divided into nine cells by the borders of their centres, with points scattered in clusters. A query, marked with a star, "
            "falls near a corner where three cells meet. The two cells whose centres are nearest the query are highlighted, and their points "
            "are compared; a dashed circle marks the best point the search finds. The true nearest neighbour, in orange, sits just across "
            "the border, inside that circle, in a third cell that is never visited, so the search misses it.")
    return svg(W, H, aria, "\n".join(body))


# ---------------------------------------------------------------- figure 5: HNSW layers and the greedy walk
def knn_graph(nodes, P, m):
    adj = {i: set() for i in nodes}
    for i in nodes:
        for j in sorted((j for j in nodes if j != i), key=lambda j: d2(P[i], P[j]))[:m]:
            adj[i].add(j); adj[j].add(i)
    return adj


def greedy(adj, P, start, q):
    path = [start]
    cur = start
    while True:
        best = min(adj[cur], key=lambda j: d2(P[j], q))
        if d2(P[best], q) >= d2(P[cur], q):
            return path
        cur = best
        path.append(cur)


def hnsw_case():
    """Search seeds for a layout whose walk is legible: at least one hop per upper layer and two in
    layer 0, ending at the true nearest neighbour, and keep the one whose shortest per-layer leg is
    longest (a hop of a few pixels reads as no hop)."""
    best, best_score = None, -1
    for case in _hnsw_cases():
        P, lvl, adj, q, (p2, p1, p0) = case
        leg = lambda path: sum(math.dist(P[a], P[b]) for a, b in zip(path, path[1:]))
        clear = min(math.dist(P[i], q) for i in range(len(P)))
        score = min(leg(p2), leg(p1), leg(p0) * 1.5) if clear > 12 else 0
        if score > best_score:
            best, best_score = case, score
    if best is None:
        raise SystemExit("no HNSW case found")
    return best


HN_PW, HN_PH, HN_SK = 470, 92, 130


def hn_flat(u):
    """A point of the unit square as drawn on a layer's parallelogram (pixels, before the layer's
    offset). Distances, graphs and the walk are all computed here, so what looks closer IS closer."""
    return (u[0] * HN_PW + (1 - u[1]) * HN_SK, u[1] * HN_PH)


def _hnsw_cases():
    for seed in range(1, 1500):
        rnd = random.Random(seed)
        n = 42
        P = [hn_flat((rnd.random(), rnd.random())) for _ in range(n)]
        lvl = []
        for _ in range(n):
            l = 0
            while rnd.random() < 0.28 and l < 2:
                l += 1
            lvl.append(l)
        L2 = [i for i in range(n) if lvl[i] >= 2]
        L1 = [i for i in range(n) if lvl[i] >= 1]
        if not (3 <= len(L2) <= 3 and 8 <= len(L1) <= 10):
            continue
        q = hn_flat((0.80, 0.70))
        adj = [knn_graph(list(range(n)), P, 3), knn_graph(L1, P, 2), knn_graph(L2, P, 2)]
        entry = max(L2, key=lambda i: d2(P[i], q))
        p2 = greedy(adj[2], P, entry, q)
        p1 = greedy(adj[1], P, p2[-1], q)
        p0 = greedy(adj[0], P, p1[-1], q)
        truth = min(range(n), key=lambda i: d2(P[i], q))
        if len(p2) >= 2 and len(p1) >= 2 and len(p0) >= 3 and p0[-1] == truth:
            yield P, lvl, adj, q, (p2, p1, p0)


def fig_hnsw(es):
    T = lambda a, b: a if es else b
    P, lvl, adj, q, paths = hnsw_case()
    W, H = 760, 430
    PH, X0 = HN_PH, 150
    tops = {2: 22, 1: 150, 0: 278}
    def proj(p, layer):
        return X0 + p[0], tops[layer] + p[1]
    body = [arrow_defs()]
    for layer in (2, 1, 0):
        t = tops[layer]
        corners = [proj(hn_flat(c), layer) for c in ((0, 0), (1, 0), (1, 1), (0, 1))]
        pad = [(corners[0][0] - 10, corners[0][1] - 10), (corners[1][0] + 10, corners[1][1] - 10),
               (corners[2][0] + 10, corners[2][1] + 10), (corners[3][0] - 10, corners[3][1] + 10)]
        body.append('<polygon points="%s" fill="#1a1a1c" stroke="%s"/>' % (" ".join("%.1f,%.1f" % c for c in pad), LINE))
        body.append(text(16, t + PH / 2 + 4, T("capa %d", "layer %d") % layer, "lbl"))
        sub = {2: T("pocos nodos, enlaces largos", "few nodes, long links"), 1: "", 0: T("todos los nodos, enlaces cortos", "every node, short links")}[layer]
        if sub:
            body.append(text(16, t + PH / 2 + 20, sub, "sub"))
    # vertical links between a node's copies
    for i, l in enumerate(lvl):
        for layer in range(l, 0, -1):
            a, b = proj(P[i], layer), proj(P[i], layer - 1)
            body.append('<line stroke="%s" stroke-width="1" stroke-dasharray="2 3" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (FAINT, a[0], a[1], b[0], b[1]))
    for layer in (2, 1, 0):
        for i, nb in adj[layer].items():
            for j in nb:
                if i < j:
                    a, b = proj(P[i], layer), proj(P[j], layer)
                    body.append('<line stroke="%s" stroke-width="1" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (LINE if layer == 0 else MUTED, a[0], a[1], b[0], b[1]))
        for i in adj[layer]:
            x, y = proj(P[i], layer)
            body.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s"/>' % (x, y, 3.6 if layer else 3, TXT if layer else MUTED))
        qx, qy = proj(q, layer)
        body.append(star(qx, qy, 8 if layer == 0 else 6, "#ffffff" if layer == 0 else FAINT, "#131315"))
    # the walk
    p2, p1, p0 = paths
    walk = [(2, i) for i in p2] + [(1, i) for i in p1] + [(0, i) for i in p0]
    for (la, a), (lb, b) in zip(walk, walk[1:]):
        if la == lb and a == b:
            continue
        x1, y1 = proj(P[a], la); x2, y2 = proj(P[b], lb)
        L = math.hypot(x2 - x1, y2 - y1)
        sx, sy = x2 - (x2 - x1) * 5 / L, y2 - (y2 - y1) * 5 / L
        dash = ' stroke-dasharray="4 3"' if la != lb else ""
        body.append('<line stroke="%s" stroke-width="2.4"%s x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" marker-end="url(#ha)"/>' % (ACC, dash, x1, y1, sx, sy))
    ex, ey = proj(P[p2[0]], 2)
    body.append('<circle cx="%.1f" cy="%.1f" r="6" fill="none" stroke="%s" stroke-width="1.6"/>' % (ex, ey, ACC))
    body.append(text(ex - 10, ey - 10, T("entrada", "entry"), "sm", "end", ACC))
    hops = (len(p2) - 1, len(p1) - 1, len(p0) - 1)
    lx = 620
    body.append('<line stroke="%s" stroke-width="2.4" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (ACC, lx, H - 50, lx + 24, H - 50))
    body.append(text(lx + 30, H - 46, T("salto voraz", "greedy hop"), "sm"))
    body.append('<line stroke="%s" stroke-width="2.4" stroke-dasharray="4 3" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (ACC, lx, H - 30, lx + 24, H - 30))
    body.append(text(lx + 30, H - 26, T("bajar de capa", "go down a layer"), "sm"))
    body.append(star(lx + 12, H - 12, 6, "#ffffff", "#131315"))
    body.append(text(lx + 30, H - 8, T("la pregunta", "the query"), "sm"))
    aria = ("Tres capas de un grafo HNSW, dibujadas como planos superpuestos. La capa 2, arriba, tiene tres nodos unidos por enlaces largos; "
            "la capa 1, %d; la capa 0, abajo, los %d puntos, unidos con sus vecinos cercanos. Unas líneas discontinuas unen cada nodo con su "
            "copia en la capa de debajo. Un camino en verde empieza en el punto de entrada de la capa 2, da %d salto%s largo%s hacia la "
            "pregunta, baja a la capa 1, da %d salto%s más corto%s, baja a la capa 0 y termina con %d pasos pequeños en el vecino más cercano "
            "a la pregunta, marcada con una estrella."
            % (len(adj[1]), len(P), hops[0], "" if hops[0] == 1 else "s", "" if hops[0] == 1 else "s", hops[1], "" if hops[1] == 1 else "s",
               "" if hops[1] == 1 else "s", hops[2]) if es else
            "Three layers of an HNSW graph, drawn as stacked planes. Layer 2, on top, has three nodes joined by long links; layer 1, %d; "
            "layer 0, at the bottom, all %d points, each joined to its close neighbours. Dashed lines join each node to its copy in the layer "
            "below. A green path starts at the entry point in layer 2, makes %d long hop%s towards the query, goes down to layer 1, makes %d "
            "shorter hop%s, goes down to layer 0 and ends with %d small steps at the query's nearest neighbour, marked with a star."
            % (len(adj[1]), len(P), hops[0], "" if hops[0] == 1 else "s", hops[1], "" if hops[1] == 1 else "s", hops[2]))
    return svg(W, H, aria, "\n".join(body)), hops


# ---------------------------------------------------------------- figure 6: product quantization
def fig_pq(es):
    T = lambda a, b: a if es else b
    W, H = 760, 340
    codes = [17, 203, 88, 41]
    body = [arrow_defs()]
    segx = [20, 96, 172, 290]   # chunks 1, 2, 3, ..., 96
    sw = 70
    def strip(y, label, col):
        body.append(text(20, y - 8, label, "lbl", "start", col))
        for k, x in enumerate(segx):
            body.append('<rect x="%d" y="%d" width="%d" height="26" rx="3" fill="#1c1b1d" stroke="%s"/>' % (x, y, sw, col))
            body.append(text(x + sw / 2, y + 17, (T("trozo %d", "chunk %d") % (k + 1)) if k < 3 else T("trozo 96", "chunk 96"), "sm", "middle"))
        body.append(text(252, y + 17, "…", "big", "middle"))
    # stored vector -> code
    strip(34, T("Vector guardado: 768 números = 96 trozos de 8", "Stored vector: 768 numbers = 96 chunks of 8"), ACC)
    for k, x in enumerate(segx):
        body.append('<line stroke="%s" stroke-width="1.2" x1="%d" y1="62" x2="%d" y2="84" marker-end="url(#hm)"/>' % (MUTED, x + sw / 2, x + sw / 2))
        body.append('<rect x="%d" y="88" width="%d" height="24" rx="3" fill="#20302a" stroke="%s"/>' % (x + 14, sw - 28, ACC))
        body.append(text(x + sw / 2, 104, str(codes[k]), "mono", "middle"))
    body.append(text(252, 104, "…", "big", "middle"))
    body.append(text(380, 60, T("Cada trozo se cambia por el número de su", "Each chunk becomes the number of its"), "sm"))
    body.append(text(380, 75, T("centro más cercano entre los 256 de su", "nearest centre among the 256 in its"), "sm"))
    body.append(text(380, 90, T("diccionario: un byte.", "codebook: one byte."), "sm"))
    body.append(text(380, 112, T("Código: 96 bytes (el vector entero, 3 072)", "Code: 96 bytes (the full vector, 3,072)"), "lbl", "start", ACC))
    # query -> table
    strip(160, T("Pregunta, sin comprimir: los mismos 96 trozos", "Query, uncompressed: the same 96 chunks"), BLUE)
    tx0, ty0, cwid, rhgt = 382, 150, 22, 22
    cols = [0, 1, 2, None, 17, None, 41, None, 88, None, 203, None, 255]
    body.append(text(tx0, ty0 - 6, T("Tabla: distancia de cada trozo a cada centro", "Table: distance from each chunk to each centre"), "sm"))
    rows = [0, 1, 2, None, 95]
    for r, row in enumerate(rows):
        y = ty0 + r * rhgt + 6
        lab = "…" if row is None else (T("trozo %d", "chunk %d") % (row + 1))
        body.append(text(tx0 + 36, y + 15, lab, "tk", "end"))
        for c, col in enumerate(cols):
            x = tx0 + 44 + c * cwid
            if row is None or col is None:
                continue
            hit = (row < 3 and col == codes[row]) or (row == 95 and col == codes[3])
            body.append('<rect x="%d" y="%d" width="%d" height="%d" fill="%s" stroke="%s"/>' % (x + 1, y + 1, cwid - 2, rhgt - 2, ACC if hit else "#1c1b1d", LINE))
    for c, col in enumerate(cols):
        body.append(text(tx0 + 44 + c * cwid + cwid / 2, ty0 + 6 + len(rows) * rhgt + 14, "…" if col is None else str(col), "tk", "middle"))
    body.append('<line stroke="%s" stroke-width="1.4" x1="366" y1="173" x2="%d" y2="173" marker-end="url(#hb)"/>' % (BLUE, tx0 - 2))
    body.append(text(20, 214, T("Para cada trozo, su distancia a los 256 centros de", "For each chunk, its distance to the 256 centres of"), "sm"))
    body.append(text(20, 230, T("su posición: 96 × 256, una vez por pregunta.", "its position: 96 × 256, once per query."), "sm"))
    body.append(text(20, 262, T("Distancia a un vector guardado:", "Distance to a stored vector:"), "lbl"))
    body.append(text(20, 282, T("una casilla por byte de su código, y sumar.", "one cell per byte of its code, then add."), "sm"))
    body.append(text(20, 306, "T[1][17] + T[2][203] + T[3][88] + … + T[96][41]", "mono", "start", ACC))
    aria = ("Arriba, un vector de 768 números dibujado como una franja partida en 96 trozos de 8 números. Cada trozo se sustituye por el "
            "número de su centro más cercano entre los 256 de su diccionario, un byte: 17, 203, 88 y, en el último, 41. El vector queda como un "
            "código de 96 bytes, frente a los 3 072 del vector entero. Abajo, la pregunta, sin comprimir, partida en los mismos 96 trozos; "
            "para cada trozo se calcula una vez su distancia a los 256 centros de su posición, y eso forma una tabla de 96 filas y 256 "
            "columnas. La distancia a un vector guardado es la suma de una casilla por fila, la que indica cada byte de su código: la "
            "columna 17 de la fila 1, la 203 de la fila 2, la 88 de la fila 3 y así hasta la 41 de la fila 96." if es else
            "Top: a vector of 768 numbers drawn as a strip split into 96 chunks of 8 numbers. Each chunk is replaced by the number of its "
            "nearest centre among the 256 in its codebook, one byte: 17, 203, 88 and, in the last one, 41. The vector becomes a 96-byte code, "
            "against the 3,072 bytes of the full vector. Bottom: the query, uncompressed, split into the same 96 chunks; for each chunk its "
            "distance to the 256 centres of that position is computed once, which fills a table of 96 rows and 256 columns. The distance to "
            "a stored vector is the sum of one cell per row, the one each byte of its code points to: column 17 of row 1, 203 of row 2, 88 "
            "of row 3 and so on up to 41 of row 96.")
    return svg(W, H, aria, "\n".join(body))


# ---------------------------------------------------------------- figure 7: VIBE recall vs QPS
SERIES_COLORS = {  # validated with the dataviz skill's checker on the blog surface #131315 (dark): all checks pass
    "hnsw": "#3987e5", "ivfpq": "#d95926", "ivf": "#199e70", "annoy": "#c98500", "lsh": "#d55181", "glass": "#9085e9",
}


def fig_vibe(es):
    T = lambda a, b: a if es else b
    data = json.load(open(os.path.join(HERE, "benchmarks.json")))["vibe"]
    W, H = 760, 440
    L, R, TOP, BOT = 64, 590, 18, 360
    xmin, xmax, ymin, ymax = 0.5, 1.0, 1.0, 4.0  # log10 qps
    X = lambda r: L + (r - xmin) / (xmax - xmin) * (R - L)
    Y = lambda qps: BOT - (math.log10(qps) - ymin) / (ymax - ymin) * (BOT - TOP)
    body = []
    for e in range(1, 5):
        y = Y(10 ** e)
        body.append('<line class="gr" x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>' % (L, y, R, y))
        body.append(text(L - 8, y + 4, thousands(10 ** e, es), "tk", "end"))
    for k in range(6):
        r = 0.5 + k * 0.1
        body.append('<line class="ax" x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>' % (X(r), BOT, X(r), BOT + 5))
        body.append(text(X(r), BOT + 18, num(r, es, 1), "tk", "middle"))
    body.append('<line class="ax" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (L, BOT, R, BOT))
    body.append('<line stroke="%s" stroke-width="1" stroke-dasharray="3 3" x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>' % (MUTED, X(0.95), TOP, X(0.95), BOT))
    body.append(text(X(0.95) - 4, TOP + 10, num(0.95, es), "tk", "end"))
    body.append(text((L + R) / 2, BOT + 38, T("recall@100", "recall@100"), "sm", "middle"))
    body.append('<text class="sm" x="14" y="%.1f" text-anchor="middle" transform="rotate(-90 14 %.1f)">%s</text>'
                % ((TOP + BOT) / 2, (TOP + BOT) / 2, esc(T("preguntas por segundo (escala logarítmica)", "queries per second (log scale)"))))
    ends = []
    for key in ("glass", "hnsw", "ivfpq", "ivf", "annoy", "lsh"):
        s = data["chart"][key]
        pts = [(r, q) for r, q in s["frontier"] if r >= xmin]
        col = SERIES_COLORS[key]
        # a staircase, not a straight interpolation: for a recall level x, the best a configuration can do
        # is the fastest run whose recall is >= x, so between two runs the curve stays flat at the next one.
        # Below the first frontier run that run still qualifies, so the curve starts flat at the left edge
        # (stopping at the first run left graph curves "cut" at 0.74 or 0.81, where their cheapest tested
        # setting already lands). It ends at the highest recall the implementation reached.
        steps = [(xmin, pts[0][1]), pts[0]]
        for (r0, _), (r1, q1) in zip(pts, pts[1:]):
            steps += [(r0, q1), (r1, q1)]
        body.append('<polyline fill="none" stroke="%s" stroke-width="2" stroke-linejoin="round" points="%s"/>'
                    % (col, " ".join("%.1f,%.1f" % (X(r), Y(q)) for r, q in steps)))
        last = pts[-1]
        body.append('<circle cx="%.1f" cy="%.1f" r="3.5" fill="%s" stroke="#131315" stroke-width="1.5"/>' % (X(last[0]), Y(last[1]), col))
        ends.append([Y(last[1]), key, col, s["label_es" if es else "label_en"]])
    # direct labels at the right end, dodged so they never overlap
    ends.sort()
    for i in range(1, len(ends)):
        if ends[i][0] - ends[i - 1][0] < 14:
            ends[i][0] = ends[i - 1][0] + 14
    for y, key, col, name in ends:
        body.append('<line stroke="%s" stroke-width="2" x1="%d" y1="%.1f" x2="%d" y2="%.1f"/>' % (col, R + 8, y, R + 20, y))
        body.append(text(R + 24, y + 4, name, "sm"))
    # legend row (identity never by colour alone: the same names sit at the line ends)
    lx, ly = L, H - 16
    for key in ("glass", "hnsw", "ivfpq", "ivf", "annoy", "lsh"):
        s = data["chart"][key]
        name = {"glass": "Glass", "hnsw": "hnswlib", "ivfpq": "Faiss IVF-PQ", "ivf": "Faiss IVF", "annoy": "Annoy", "lsh": "PUFFINN"}[key]
        body.append('<line stroke="%s" stroke-width="2.4" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (SERIES_COLORS[key], lx, ly - 4, lx + 16, ly - 4))
        body.append(text(lx + 21, ly, name, "tk"))
        lx += 21 + len(name) * 6.2 + 22
    t = data["table"]
    v = lambda name: t[name]["0.95"]["qps"]
    aria = ("Gráfica de líneas con el recall arriba de cien, de 0,5 a 1, en el eje horizontal, y las preguntas por segundo en escala "
            "logarítmica, de 10 a 10 000, en el vertical, con una línea discontinua en recall 0,95. Seis curvas en escalones que bajan hacia "
            "la derecha, porque más recall cuesta velocidad; la del hashing acaba antes, en 0,99, el recall más alto que alcanza. De más rápida a más lenta con recall 0,95: el grafo comprimido Glass, %s preguntas por "
            "segundo; el grafo hnswlib, %s; las listas invertidas con cuantización por producto de Faiss, %s; las listas invertidas de "
            "Faiss, %s; el árbol Annoy, %s; y el hashing PUFFINN, %s." if es else
            "Line chart with recall at one hundred, from 0.5 to 1, on the horizontal axis and queries per second on a log scale, from 10 to "
            "10,000, on the vertical one, with a dashed line at recall 0.95. Six stepped curves falling to the right, because more recall costs "
            "speed; the hashing one stops early, at 0.99, the highest recall it reaches. "
            "From fastest to slowest at recall 0.95: the compressed graph Glass, %s queries per second; the graph hnswlib, %s; Faiss's "
            "inverted lists with product quantization, %s; Faiss's inverted lists, %s; the Annoy tree, %s; and PUFFINN hashing, %s.") % tuple(
        thousands(v(n), es) for n in ("glass", "hnswlib", "ivfpqfs(faiss)", "ivf(faiss)", "annoy", "puffinn"))
    return svg(W, H, aria, "\n".join(body))


if __name__ == "__main__":
    figs = {
        "linea-de-tiempo": fig_linea_de_tiempo,
        "dos-decisiones": fig_dos_decisiones,
        "lsh": fig_lsh,
        "ivf": fig_ivf,
        "pq": fig_pq,
        "vibe-recall": fig_vibe,
    }
    for name, f in figs.items():
        for es, suffix in ((True, ".svg"), (False, ".en.svg")):
            with open(os.path.join(OUT, name + suffix), "w") as fh:
                fh.write(f(es))
    for es, suffix in ((True, ".svg"), (False, ".en.svg")):
        out, hops = fig_hnsw(es)
        with open(os.path.join(OUT, "hnsw" + suffix), "w") as fh:
            fh.write(out)
    print("hnsw hops per layer (2, 1, 0):", hops)
    print("LSH candidate probability, b=10, L=20:", {t: round(lsh_found(t), 4) for t in (30, 60, 90)})
