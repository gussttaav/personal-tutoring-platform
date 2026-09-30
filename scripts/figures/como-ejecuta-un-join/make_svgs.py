"""BLOG-09 — Figures for the blog post `como-ejecuta-un-join`.
Run from this directory: python3 make_svgs.py ../../../public/blog/como-ejecuta-un-join
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

`tres-algoritmos` and `filtro-dinamico` are diagrams; the row-group counts in the second are the
real ones of the DuckDB file (65 groups in lineas_pedido, 3 of them overlapping the September
range; 32 in pedidos, all of them overlapping the Soria range). `cruce` is data: every point is
read from `mediciones.json`, which holds the medians measured on Postgres 18.6 (see the header
comment of the post for how)."""
import json, math, os, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; LINE = "#3b3b3e"
WARN = "#e8a24c"; BLUE = "#6fb1e8"; PINK = "#e87ab8"
FONT = "ui-sans-serif, system-ui, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .bx {{ fill: none; stroke: {MUTED}; stroke-width: 1; }}
  .bx.m {{ stroke: {ACC}; fill: rgba(78,222,163,0.12); }}
  .bx.w {{ stroke: {WARN}; fill: rgba(232,162,76,0.12); }}
  .bx.g {{ stroke: {LINE}; }}
  .bx.f {{ stroke: {ACC}; fill: {ACC}; }}
  .lb {{ font-size: 12.5px; font-weight: 600; }}
  .sb {{ font-size: 11px; fill: {MUTED}; }}
  .tx {{ font-size: 11.5px; }}
  .tx.d {{ fill: {MUTED}; }}
  .mo {{ font-family: {MONO}; font-size: 11px; }}
  .hd {{ font-size: 10.5px; fill: {MUTED}; letter-spacing: 0.1em; }}
  .m {{ fill: {ACC}; }}
  .w {{ fill: {WARN}; }}
  .sep {{ stroke: {GRID}; stroke-width: 1; }}
  .ar {{ fill: none; stroke: {MUTED}; stroke-width: 1.2; marker-end: url(#a); }}
  .ar.m {{ stroke: {ACC}; marker-end: url(#am); }}
  .ar.w {{ stroke: {WARN}; marker-end: url(#aw); }}
  .ar.t {{ stroke-width: 0.9; }}
  .mt {{ stroke: {LINE}; stroke-width: 1; stroke-dasharray: 2 2; }}
  .mt.m {{ stroke: {ACC}; }}
  .ax {{ stroke: {MUTED}; stroke-width: 1; }}
  .gl {{ stroke: {GRID}; stroke-width: 1; }}
  .tr {{ fill: none; stroke-width: 2; stroke-linejoin: round; stroke-linecap: round; }}
  .vl {{ stroke-width: 1.2; stroke-dasharray: 4 3; }}
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
    return '<rect class="bx %s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%g"/>' % (cls, x, y, w, h, rx)


def text(x, y, s, cls="tx", anchor=None):
    a = ' style="text-anchor:%s"' % anchor if anchor else ""
    return '<text class="%s" x="%.1f" y="%.1f"%s>%s</text>' % (cls, x, y, a, esc(s))


def cell(x, y, w, h, label, cls=""):
    """A small box with a centred monospace label (a row of a table)."""
    tcls = "mo m" if cls == "m" else "mo"
    return box(x, y, w, h, cls, 3) + "\n" + text(x + w / 2, y + h / 2 + 3.8, label, tcls, "middle")


def labelled(x, y, w, h, title, sub=None, cls=""):
    out = [box(x, y, w, h, cls, 6)]
    tcls = {"m": "lb m", "w": "lb w"}.get(cls, "lb")
    if sub:
        out.append(text(x + w / 2, y + h / 2 - 2, title, tcls, "middle"))
        out.append(text(x + w / 2, y + h / 2 + 12, sub, "sb", "middle"))
    else:
        out.append(text(x + w / 2, y + h / 2 + 4, title, tcls, "middle"))
    return "\n".join(out)


def arrow(pts, cls="ar"):
    d = "M" + " L".join("%.1f,%.1f" % p for p in pts)
    return '<path class="%s" d="%s"/>' % (cls, d)


def write(name, es_svg, en_svg):
    for suffix, content in ((".svg", es_svg), (".en.svg", en_svg)):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(content)


def num(v, es):
    """Thousands with a space (the blog's convention in both languages' figures), decimals by locale."""
    if isinstance(v, int) or float(v).is_integer():
        s = "{:,}".format(int(v)).replace(",", " ")
        return s if es else s.replace(" ", ",")
    s = "%g" % v
    return s.replace(".", ",") if es else s


# ─── 1. tres-algoritmos ──────────────────────────────────────────────────────────────────────

def fig_tres(es):
    L = {
        True: dict(
            t=["Nested loop con índice", "Hash join", "Merge join"],
            s=["para cada cliente, buscar sus pedidos", "construir con la pequeña, recorrer la grande",
               "dos listas ordenadas, dos punteros"],
            clientes="clientes", pedidos="pedidos", indice="índice", madrid="clientes de Madrid",
            tabla="tabla hash", construir="construir", sondear="sondear", barra="pedidos, de principio a fin",
            ids="pedidos.id", lin="líneas.pedido_id",
            b1=["n búsquedas en el índice", "una lectura aleatoria por fila"],
            b2=["n + m operaciones", "cada tabla se lee una vez, en orden"],
            b3=["n + m, si ya vienen ordenadas", "avanza el puntero del valor menor"],
            g=["gana si salen pocas filas del filtro", "gana si hay que cruzar mucho", "gana si el orden ya está pagado"],
            aria="Tres diagramas, uno por algoritmo. Nested loop con índice: una lista de clientes; para el cliente 42, "
                 "una flecha baja por un índice en forma de árbol y de él salen cinco flechas a páginas dispersas de la "
                 "tabla de pedidos. n búsquedas en el índice y una lectura aleatoria por fila; gana si salen pocas filas "
                 "del filtro. Hash join: los clientes de Madrid se guardan en una tabla hash, y la tabla de pedidos se "
                 "recorre de principio a fin, consultando la tabla hash por cada pedido. n más m operaciones, cada tabla "
                 "se lee una vez y en orden; gana si hay que cruzar mucho. Merge join: dos columnas ordenadas, los id de "
                 "pedidos y los pedido_id de las líneas, con un puntero en cada una apuntando al valor 3 y líneas que unen "
                 "los valores iguales. n más m si ya vienen ordenadas; gana si el orden ya está pagado."),
        False: dict(
            t=["Nested loop with an index", "Hash join", "Merge join"],
            s=["for each customer, look up their orders", "build from the small one, scan the big one",
               "two sorted lists, two pointers"],
            clientes="customers", pedidos="orders", indice="index", madrid="Madrid customers",
            tabla="hash table", construir="build", sondear="probe", barra="orders, start to finish",
            ids="pedidos.id", lin="lineas.pedido_id",
            b1=["n index lookups", "one random read per row"],
            b2=["n + m operations", "each table read once, in order"],
            b3=["n + m, if already sorted", "advance the smaller key's pointer"],
            g=["wins when few rows pass the filter", "wins when there is a lot to match", "wins when the order is already paid for"],
            aria="Three diagrams, one per algorithm. Nested loop with an index: a list of customers; for customer 42, an "
                 "arrow goes down a tree-shaped index and five arrows fan out from it to scattered pages of the orders "
                 "table. n index lookups and one random read per row; it wins when few rows pass the filter. Hash join: "
                 "the Madrid customers go into a hash table, and the orders table is scanned from start to finish, "
                 "probing the hash table for every order. n plus m operations, each table read once and in order; it wins "
                 "when there is a lot to match. Merge join: two sorted columns, the order ids and the pedido_id of each line, "
                 "with a pointer on each at the value 3 and lines joining equal values. n plus m if already sorted; it "
                 "wins when the order is already paid for."),
    }[es]
    PX, PW = [0, 262, 524], 236
    b = []
    for i, px in enumerate(PX):
        b.append(text(px, 14, L["t"][i], "lb"))
        b.append(text(px, 30, L["s"][i], "sb"))
        b.append(text(px, 192, L["b%d" % (i + 1)][0], "tx"))
        b.append(text(px, 207, L["b%d" % (i + 1)][1], "tx d"))
        b.append(text(px, 232, L["g"][i], "tx m"))
    for x in (249, 511):
        b.append('<line class="sep" x1="%d" y1="4" x2="%d" y2="236"/>' % (x, x))

    # panel 1: nested loop with an index
    px = PX[0]
    b.append(text(px, 52, L["clientes"], "sb"))
    for i, v in enumerate(["17", "42", "108", "…"]):
        b.append(cell(px, 60 + i * 24, 44, 18, v, "m" if v == "42" else ""))
    b.append('<path class="bx" d="M%.1f,62 L%.1f,114 L%.1f,114 Z"/>' % (px + 100, px + 74, px + 126))
    b.append(text(px + 100, 128, L["indice"], "sb", "middle"))
    b.append(arrow([(px + 44, 93), (px + 82, 93)], "ar m"))
    b.append(text(px + 152, 52, L["pedidos"], "sb"))
    hot = {(0, 1), (3, 0), (1, 3), (4, 4), (2, 5)}
    for r in range(6):
        for c in range(5):
            x, y = px + 152 + c * 16, 60 + r * 16
            b.append(box(x, y, 12, 12, "f" if (c, r) in hot else "g", 2))
    for c, r in sorted(hot):
        b.append(arrow([(px + 116, 100), (px + 150 + c * 16, 66 + r * 16)], "ar m t"))

    # panel 2: hash join
    px = PX[1]
    b.append(text(px, 52, L["madrid"], "sb"))
    for i, v in enumerate(["4", "19", "…"]):
        b.append(cell(px, 60 + i * 24, 44, 18, v))
    b.append(arrow([(px + 44, 93), (px + 98, 93)]))
    b.append(text(px + 49, 86, L["construir"], "sb"))
    b.append(text(px + 170, 67, L["tabla"], "sb"))
    fill = [2, 0, 1, 3, 1, 2]
    for j, k in enumerate(fill):
        y = 58 + j * 15
        b.append(box(px + 100, y, 64, 12, "g", 2))
        for s in range(k):
            b.append(box(px + 104 + s * 14, y + 2.5, 10, 7, "m", 1.5))
    for s in range(12):
        b.append(box(px + s * 19.5, 156, 17, 12, "g", 2))
    b.append(arrow([(px + 2, 176), (px + 232, 176)], "ar w"))
    b.append(text(px + 90, 150, L["barra"], "sb", "middle"))
    b.append(arrow([(px + 212, 154), (px + 168, 124)], "ar w"))
    b.append(text(px + 196, 118, L["sondear"], "sb", "middle"))

    # panel 3: merge join
    px = PX[2]
    lx, rx = px + 20, px + 140
    b.append(text(lx, 52, L["ids"], "sb"))
    b.append(text(rx, 52, L["lin"], "sb"))
    left = [1, 2, 3, 4, 5]
    right = [1, 2, 2, 3, 3, 4]
    ly = {v: 58 + i * 20 for i, v in enumerate(left)}
    ry = [58 + i * 17 for i in range(len(right))]
    for v in left:
        b.append(cell(lx, ly[v], 40, 15, str(v), "m" if v == 3 else ""))
    for i, v in enumerate(right):
        b.append(cell(rx, ry[i], 40, 14, str(v), "m" if v == 3 else ""))
    for i, v in enumerate(right):
        cls = "mt m" if v == 3 else "mt"
        b.append('<line class="%s" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (cls, lx + 40, ly[v] + 7.5, rx, ry[i] + 7))
    b.append(arrow([(px + 2, ly[3] + 7.5), (lx - 3, ly[3] + 7.5)], "ar m"))
    b.append(text(px + 2, ly[3] - 3, "i", "mo m"))
    b.append(arrow([(rx + 72, ry[3] + 7), (rx + 43, ry[3] + 7)], "ar m"))
    b.append(text(rx + 66, ry[3] - 3, "j", "mo m"))
    return svg(760, 240, L["aria"], b)


# ─── 3. filtro-dinamico ──────────────────────────────────────────────────────────────────────

def fig_filtro(es):
    L = {
        True: dict(
            h1="LÍNEAS DE LOS PEDIDOS DE SEPTIEMBRE", h2="PEDIDOS DE LOS CLIENTES DE SORIA",
            b1=("pedidos de septiembre", "82 116 filas"), b2=("clientes de Soria", "339 filas"),
            ht=("tabla hash", "el lado pequeño"),
            f1=("pedido_id entre 2 917 885 y 3 000 000", "y un filtro Bloom con los 82 116 id"),
            f2=("cliente_id entre 116 y 197 499", "casi todo el rango de clientes"),
            l1="lineas_pedido, en orden de pedido_id: 65 grupos de filas",
            r1="se leen 3 grupos: 249 458 de 7 498 570 líneas",
            l2="pedidos, en orden de fecha: en cada grupo hay clientes de 1 a 200 000",
            r2="se leen los 32 grupos",
            aria="Dos casos del filtro que el hash join de DuckDB pasa al escaneo de la tabla grande. Arriba, las "
                 "líneas de los pedidos de septiembre: la tabla hash con los 82 116 pedidos de septiembre produce el "
                 "filtro pedido_id entre 2 917 885 y 3 000 000, más un filtro Bloom. Debajo, los 65 grupos de filas de "
                 "lineas_pedido, guardada en orden de pedido_id: sólo los 3 últimos se cruzan con el rango y se leen; "
                 "los otros 62 se descartan por su mínimo y su máximo. Se leen 249 458 de 7 498 570 líneas. Abajo, los "
                 "pedidos de los clientes de Soria: la tabla hash con 339 clientes produce el filtro cliente_id entre "
                 "116 y 197 499. Los pedidos están en orden de fecha y cada uno de sus 32 grupos contiene clientes de 1 "
                 "a 200 000, así que el rango se cruza con los 32 y se leen todos."),
        False: dict(
            h1="LINES OF THE SEPTEMBER ORDERS", h2="ORDERS OF THE CUSTOMERS IN SORIA",
            b1=("September orders", "82,116 rows"), b2=("Soria customers", "339 rows"),
            ht=("hash table", "the small side"),
            f1=("pedido_id between 2,917,885 and 3,000,000", "plus a Bloom filter of the 82,116 ids"),
            f2=("cliente_id between 116 and 197,499", "almost the whole customer range"),
            l1="lineas_pedido, stored in pedido_id order: 65 row groups",
            r1="3 groups read: 249,458 of 7,498,570 lines",
            l2="orders, stored in date order: every group holds customers 1 to 200,000",
            r2="all 32 groups read",
            aria="Two cases of the filter that DuckDB's hash join hands to the scan of the big table. Top, the lines of "
                 "the September orders: the hash table with the 82,116 September orders yields the filter pedido_id "
                 "between 2,917,885 and 3,000,000, plus a Bloom filter. Below it, the 65 row groups of lineas_pedido, stored "
                 "in pedido_id order: only the last 3 overlap the range and are read; the other 62 are skipped on their "
                 "minimum and maximum. 249,458 of 7,498,570 lines are read. Bottom, the orders of the customers in Soria: "
                 "the hash table with 339 customers yields the filter cliente_id between 116 and 197,499. Orders are "
                 "stored by date and each of their 32 groups holds customers 1 to 200,000, so the range overlaps all 32 "
                 "and every one is read."),
    }[es]
    b = []

    def block(y0, head, src, filt, groups, hot, cls, left, right):
        b.append(text(0, y0 + 12, head, "hd"))
        b.append(labelled(0, y0 + 22, 150, 40, *src))
        b.append(arrow([(150, y0 + 42), (176, y0 + 42)]))
        b.append(labelled(178, y0 + 22, 120, 40, *L["ht"]))
        b.append(arrow([(298, y0 + 42), (324, y0 + 42)], "ar " + cls))
        b.append(labelled(326, y0 + 22, 300, 40, *filt, cls=cls))
        pitch = 760.0 / groups
        gy = y0 + 84
        for g in range(groups):
            b.append(box(g * pitch + 1, gy, pitch - 3, 20, cls if g in hot else "g", 2))
        hx = (min(hot) * pitch + (max(hot) + 1) * pitch) / 2
        b.append(arrow([(626, y0 + 42), (hx if hx > 640 else 700, y0 + 42), (hx, gy - 3)] if hx > 640 else
                       [(476, y0 + 62), (476, gy - 3)], "ar " + cls))
        b.append(text(0, gy + 36, left, "tx d"))
        b.append(text(760, gy + 36, right, "tx " + cls, "end"))

    block(0, L["h1"], L["b1"], L["f1"], 65, set(range(62, 65)), "m", L["l1"], L["r1"])
    block(150, L["h2"], L["b2"], L["f2"], 32, set(range(32)), "w", L["l2"], L["r2"])
    return svg(760, 276, L["aria"], b)


# ─── 2. cruce ────────────────────────────────────────────────────────────────────────────────

REGIMES = (("ssd", WARN), ("sistema", BLUE), ("postgres", ACC))


def crossover(points):
    """First N at which the nested loop stops winning: the ratio nl/hash crosses 1, interpolated in log-log."""
    pts = [(n, nl / hj) for n, nl, hj in points if nl is not None]
    for (n0, r0), (n1, r1) in zip(pts, pts[1:]):
        if r0 < 1 <= r1:
            t = (0 - math.log(r0)) / (math.log(r1) - math.log(r0))
            return math.exp(math.log(n0) + t * (math.log(n1) - math.log(n0)))
    return None


def fig_cruce(es, M):
    L = {
        True: dict(
            name={"ssd": "en el SSD", "sistema": "en la caché del sistema", "postgres": "en la caché de Postgres"},
            y={0.1: "10 veces más rápido", 1: "igual", 10: "10 veces más lento", 100: "100 veces más lento"},
            ytitle="EL ÍNDICE (NESTED LOOP) FRENTE AL HASH JOIN", xtitle="clientes que pasan el filtro",
            sw4="Postgres cambia aquí", sw4b="random_page_cost = 4", sw11="con 1,1",
            cross="cruce real",
            aria="Gráfica con escala logarítmica en los dos ejes. En horizontal, los clientes que pasan el filtro, de "
                 "1 a 200 000; en vertical, cuántas veces más lento o más rápido es el nested loop con índice que el hash "
                 "join, de 10 veces más rápido a 100 veces más lento. Tres líneas, una por situación, suben de izquierda "
                 "a derecha y cruzan la línea de «igual» en sitios distintos. En el SSD, hacia los 80 clientes; con 30 000, "
                 "el índice es 65 veces más lento. En la caché del sistema, hacia los 11 000; con pocos clientes, el "
                 "índice es unas 16 veces más rápido. En la caché de Postgres, hacia los 36 000; con los 200 000 "
                 "clientes, el índice es 2 veces más lento. Una línea vertical gris en 673 clientes marca dónde cambia "
                 "Postgres de algoritmo con random_page_cost igual a 4, la misma en las tres situaciones; otra rosa, en "
                 "26 161, dónde lo haría con 1,1. En el eje horizontal hay marcas para Soria, 339 clientes, y Madrid, "
                 "28 804."),
        False: dict(
            name={"ssd": "on the SSD", "sistema": "in the OS cache", "postgres": "in Postgres's cache"},
            y={0.1: "10 times faster", 1: "even", 10: "10 times slower", 100: "100 times slower"},
            ytitle="THE INDEX (NESTED LOOP) AGAINST THE HASH JOIN", xtitle="customers that pass the filter",
            sw4="Postgres switches here", sw4b="random_page_cost = 4", sw11="with 1.1",
            cross="real crossover",
            aria="Chart with a logarithmic scale on both axes. Horizontally, the customers that pass the filter, from 1 "
                 "to 200,000; vertically, how many times slower or faster the nested loop with an index is than the hash "
                 "join, from 10 times faster to 100 times slower. Three lines, one per situation, rise from left to right "
                 "and cross the even line at different points. On the SSD, around 80 customers; at 30,000 the index is 65 "
                 "times slower. In the OS cache, around 11,000; with few customers the index is about 16 times faster. In "
                 "Postgres's cache, around 36,000; with all 200,000 customers the index is 2 times slower. A grey vertical "
                 "line at 673 customers marks where Postgres switches algorithm with random_page_cost equal to 4, the same "
                 "in all three situations; a pink one at 26,161, where it would switch with 1.1. The horizontal axis has "
                 "marks for Soria, 339 customers, and Madrid, 28,804."),
    }[es]
    X0, X1, Y0, Y1 = 122, 590, 34, 262          # plot box
    NMIN, NMAX, RMIN, RMAX = 1, 200000, 0.04, 120

    def X(n):
        return X0 + (math.log10(n) - math.log10(NMIN)) / (math.log10(NMAX) - math.log10(NMIN)) * (X1 - X0)

    def Y(r):
        return Y1 - (math.log10(r) - math.log10(RMIN)) / (math.log10(RMAX) - math.log10(RMIN)) * (Y1 - Y0)

    b = [text(0, 12, L["ytitle"], "hd")]
    for r, lab in L["y"].items():
        b.append('<line class="gl" x1="%d" y1="%.1f" x2="%d" y2="%.1f"%s/>'
                 % (X0, Y(r), X1, Y(r), ' style="stroke:%s"' % LINE if r == 1 else ""))
        b.append(text(X0 - 8, Y(r) + 4, lab, "sb" if r != 1 else "tx", "end"))
    for n in (1, 10, 100, 1000, 10000, 100000):
        b.append('<line class="ax" x1="%.1f" y1="%d" x2="%.1f" y2="%d"/>' % (X(n), Y1, X(n), Y1 + 4))
        b.append(text(X(n), Y1 + 17, num(n, es), "sb", "middle"))
    b.append('<line class="ax" x1="%d" y1="%d" x2="%d" y2="%d"/>' % (X0, Y1, X1, Y1))
    b.append(text((X0 + X1) / 2, Y1 + 62, L["xtitle"], "sb", "middle"))
    for name, n in (("Soria", M["soria"]), ("Madrid", M["madrid"])):
        b.append('<path d="M%.1f,%d l-4,7 l8,0 z" fill="%s"/>' % (X(n), Y1 + 22, TXT))
        b.append(text(X(n), Y1 + 42, name, "tx", "middle"))
    # the planner's switch points
    # the default's label hangs from the top; the 1.1 one sits at the bottom, clear of the SSD line's label
    for key, col, lab, y in (("4", MUTED, (L["sw4"], L["sw4b"]), Y0 + 6), ("1.1", PINK, (L["sw11"],), Y1 - 8)):
        n = M["cambio"][key]
        b.append('<line class="vl" x1="%.1f" y1="%d" x2="%.1f" y2="%d" style="stroke:%s"/>' % (X(n), Y0 - 4, X(n), Y1, col))
        for i, s in enumerate(lab):
            b.append('<text class="sb" x="%.1f" y="%d" style="fill:%s">%s</text>' % (X(n) + 5, y + i * 13, col, esc(s)))
    # one line per regime, labelled at its right end, with its crossover marked on the "even" line
    for key, col in REGIMES:
        pts = [(n, nl / hj) for n, nl, hj in M["cruce"][key] if nl is not None]
        poly = " ".join("%.1f,%.1f" % (X(n), Y(r)) for n, r in pts)
        b.append('<polyline class="tr" stroke="%s" points="%s"/>' % (col, poly))
        b.append("".join('<circle cx="%.1f" cy="%.1f" r="2.6" fill="%s"/>' % (X(n), Y(r), col) for n, r in pts))
        c = crossover(M["cruce"][key])
        b.append('<circle cx="%.1f" cy="%.1f" r="4.5" fill="none" stroke="%s" stroke-width="1.5"/>' % (X(c), Y(1), col))
        n_end, r_end = pts[-1]
        b.append('<text class="tx" x="%.1f" y="%.1f" style="fill:%s">%s</text>' % (X(n_end) + 8, Y(r_end) + 4, col, esc(L["name"][key])))
    return svg(760, Y1 + 70, L["aria"], b)


if __name__ == "__main__":
    write("tres-algoritmos", fig_tres(True), fig_tres(False))
    write("filtro-dinamico", fig_filtro(True), fig_filtro(False))
    M = json.load(open(os.path.join(HERE, "mediciones.json"), encoding="utf-8"))
    write("cruce", fig_cruce(True, M), fig_cruce(False, M))
