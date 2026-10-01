"""BLOG-10 — Figures for the blog post `arboles-b`.
Run from this directory: python3 make_svgs.py ../../../public/blog/arboles-b
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

`anatomia` and `particion` are diagrams of a toy tree with at most 4 keys per node; the states
in `particion` are the real trace of the post's Python code inserting 10, 20, 30, 40, 50, 25,
35, 60, 70. `binario-contra-b` is data: the page counts per level of pedidos_pkey are read
from `mediciones.json` (pageinspect on Postgres 18.6, see the header comment of the post)."""
import json, os, sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)
HERE = os.path.dirname(os.path.abspath(__file__))
M = json.load(open(os.path.join(HERE, "mediciones.json"), encoding="utf-8"))

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; LINE = "#3b3b3e"
WARN = "#e8a24c"; BG = "#131315"
FONT = "ui-sans-serif, system-ui, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .bx {{ fill: none; stroke: {MUTED}; stroke-width: 1; }}
  .bx.m {{ stroke: {ACC}; fill: rgba(78,222,163,0.12); }}
  .bx.w {{ stroke: {WARN}; fill: rgba(232,162,76,0.12); }}
  .bx.g {{ stroke: {LINE}; }}
  .bx.f {{ stroke: {ACC}; fill: {ACC}; }}
  .bx.s {{ stroke: none; fill: {LINE}; }}
  .lb {{ font-size: 12.5px; font-weight: 600; }}
  .sb {{ font-size: 11px; fill: {MUTED}; }}
  .tx {{ font-size: 11.5px; }}
  .tx.d {{ fill: {MUTED}; }}
  .mo {{ font-family: {MONO}; font-size: 11.5px; }}
  .mo.k {{ fill: {BG}; font-weight: 700; }}
  .m {{ fill: {ACC}; }}
  .w {{ fill: {WARN}; }}
  .sep {{ stroke: {GRID}; stroke-width: 1; }}
  .ar {{ fill: none; stroke: {MUTED}; stroke-width: 1; marker-end: url(#a); }}
  .ar.m {{ stroke: {ACC}; stroke-width: 1.6; marker-end: url(#am); }}
  .ar.w {{ stroke: {WARN}; stroke-width: 1.4; marker-end: url(#aw); }}
  .ed {{ stroke: {LINE}; stroke-width: 1; }}
  .gl {{ stroke: {GRID}; stroke-width: 1; }}
  .pt {{ fill: none; stroke: {ACC}; stroke-width: 1.5; stroke-linejoin: round; }}
  .tri {{ fill: rgba(232,162,76,0.06); stroke: {WARN}; stroke-width: 1; }}
  .lv {{ stroke: {LINE}; stroke-width: 1; stroke-dasharray: 2 3; }}
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


def lines(x, y, rows, cls="tx", anchor=None, lh=15):
    return [text(x, y + i * lh, r, cls, anchor) for i, r in enumerate(rows)]


def arrow(pts, cls="ar"):
    d = "M" + " L".join("%.1f,%.1f" % p for p in pts)
    return '<path class="%s" d="%s"/>' % (cls, d)


def line(x1, y1, x2, y2, cls="ed"):
    return '<line class="%s" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (cls, x1, y1, x2, y2)


def write(name, es_svg, en_svg):
    for suffix, content in ((".svg", es_svg), (".en.svg", en_svg)):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(content)


def num(v, es):
    """Thousands with a space in Spanish, a comma in English (the blog's convention)."""
    s = "{:,}".format(int(v)).replace(",", " ")
    return s if es else s.replace(" ", ",")


CW, NH = 22, 22   # key cell width, node height


def node(x, y, keys, cls="", hot=None, cw=CW):
    """A B-tree node: a row of key cells. Returns (svg parts, child anchor xs, width).
    `cls` styles the outline; keys in `hot` get a filled cell (`f`) or a tinted one (`m`/`w`)."""
    hot = hot or {}
    w = len(keys) * cw
    out = [box(x, y, w, NH, cls, 3)]
    for i, k in enumerate(keys):
        cx = x + i * cw
        if i:
            out.append(line(cx, y, cx, y + NH, "ed"))
        h = hot.get(k)
        if h == "f":
            out.append(box(cx + 2, y + 2, cw - 4, NH - 4, "f", 2))
        elif h:
            out.append(box(cx + 2, y + 2, cw - 4, NH - 4, h, 2))
        out.append(text(cx + cw / 2, y + NH / 2 + 4, str(k), "mo k" if h == "f" else "mo", "middle"))
    anchors = [x + i * cw for i in range(len(keys) + 1)]
    return out, anchors, w


# ─── 1. anatomia ─────────────────────────────────────────────────────────────────────────────

def fig_anatomia(es):
    L = {
        True: dict(
            lv=[["raíz"], ["nivel 2"], ["hojas,", "todas a la misma", "profundidad"]],
            page=["cada nodo es una página:", "aquí caben 4 claves;", "en Postgres, unas 400"],
            find="buscar 45: una página por nivel",
            i1="entre 30 y 60", i2="entre 40 y 50", here="aquí está",
            aria="Un árbol B de tres niveles con 33 claves, como mucho cuatro por nodo. La raíz tiene las claves "
                 "30 y 60 y tres hijos: [10, 20], [40, 50] y [70, 85]. Cada uno de ellos tiene tres hojas, nueve en "
                 "total, todas a la misma profundidad: [3, 5, 8], [12, 15, 18], [22, 25, 28], [33, 36], [42, 45, 48], "
                 "[52, 55, 58], [62, 66], [73, 77, 81] y [88, 92, 96]. Está marcado el camino para buscar el 45: en "
                 "la raíz, 45 está entre 30 y 60, así que se baja por el hijo del medio; en [40, 50], está entre 40 y "
                 "50, así que se baja otra vez por el del medio; y en la hoja [42, 45, 48] está el 45. Tres páginas, "
                 "una por nivel. Una nota dice que cada nodo es una página, que aquí caben cuatro claves y en "
                 "Postgres unas 400."),
        False: dict(
            lv=[["root"], ["level 2"], ["leaves,", "all at the", "same depth"]],
            page=["each node is a page:", "4 keys fit here;", "about 400 in Postgres"],
            find="finding 45: one page per level",
            i1="between 30 and 60", i2="between 40 and 50", here="here it is",
            aria="A three-level B-tree with 33 keys, at most four per node. The root holds the keys 30 and 60 and "
                 "has three children: [10, 20], [40, 50] and [70, 85]. Each of them has three leaves, nine in total, "
                 "all at the same depth: [3, 5, 8], [12, 15, 18], [22, 25, 28], [33, 36], [42, 45, 48], [52, 55, 58], "
                 "[62, 66], [73, 77, 81] and [88, 92, 96]. The path to find 45 is marked: at the root, 45 is between "
                 "30 and 60, so the search goes down the middle child; at [40, 50] it is between 40 and 50, so it "
                 "goes down the middle child again; and the leaf [42, 45, 48] holds 45. Three pages, one per level. "
                 "A note says each node is a page, that four keys fit here and about 400 in Postgres."),
    }[es]
    W, H = 760, 232
    Y0, Y1, Y2 = 44, 112, 180
    X0 = 100
    leaves = [[3, 5, 8], [12, 15, 18], [22, 25, 28], [33, 36], [42, 45, 48], [52, 55, 58],
              [62, 66], [73, 77, 81], [88, 92, 96]]
    mids = [[10, 20], [40, 50], [70, 85]]
    root = [30, 60]
    b = []
    for (rows, y) in zip(L["lv"], (Y0, Y1, Y2)):
        b += lines(0, y + 15, rows, "sb", lh=13)
    b.append(text(0, 14, L["find"], "tx m"))

    # leaves, left to right, small gaps inside a subtree and a wider one between subtrees
    lx, x = [], X0
    for i, keys in enumerate(leaves):
        lx.append(x)
        x += len(keys) * CW + (20 if i % 3 == 2 else 9)
    leaf_tops = []
    for i, keys in enumerate(leaves):
        on = i == 4
        parts, _, w = node(lx[i], Y2, keys, "m" if on else "", {45: "f"} if on else None)
        b += parts
        leaf_tops.append(lx[i] + w / 2)
        if on:
            b.append(text(lx[i] + w / 2, Y2 + NH + 15, L["here"], "sb m", "middle"))

    mid_anchor_sets = []
    for j, keys in enumerate(mids):
        span_l, span_r = lx[3 * j], lx[3 * j + 2] + len(leaves[3 * j + 2]) * CW
        w = len(keys) * CW
        mx = (span_l + span_r) / 2 - w / 2
        on = j == 1
        parts, anchors, _ = node(mx, Y1, keys, "m" if on else "")
        b += parts
        mid_anchor_sets.append((mx + w / 2, anchors))
        for c, a in enumerate(anchors):
            tgt = leaf_tops[3 * j + c]
            hot = on and c == 1
            b.append(arrow([(a, Y1 + NH), (tgt, Y2 - 2)], "ar m" if hot else "ar"))
        if on:
            b.append(text(mx + w + 10, Y1 + NH / 2 + 4, L["i2"], "sb m"))

    w = len(root) * CW
    rx = mid_anchor_sets[1][0] - w / 2
    parts, anchors, _ = node(rx, Y0, root, "m")
    b += parts
    for c, a in enumerate(anchors):
        tgt = mid_anchor_sets[c][0]
        hot = c == 1
        b.append(arrow([(a, Y0 + NH), (tgt, Y1 - 2)], "ar m" if hot else "ar"))
    b.append(text(rx + w + 10, Y0 + NH / 2 + 4, L["i1"], "sb m"))
    # the page note, to the left of the root
    nx = rx - 28
    b.append(arrow([(nx + 4, Y0 + NH / 2), (rx - 4, Y0 + NH / 2)]))
    b += lines(nx, Y0 - 2, L["page"], "sb", "end", lh=13)
    return svg(W, H, L["aria"], b)


# ─── 2. binario-contra-b ─────────────────────────────────────────────────────────────────────

def fig_binario(es):
    t = M["arbol_pedidos_pkey"]
    L = {
        True: dict(
            t1="Árbol binario", s1="3 000 000 de claves, un nodo por página",
            t2="Árbol B: el índice de pedidos.id", s2="3 000 000 de claves, cientos por página",
            r=["1 página, %d entradas" % t["entradas_raiz"],
               "%d páginas, unas %d entradas" % (t["internas"] - 1, round(t["entradas_por_interna_media"])),
               "%s hojas, %d claves" % (num(t["hojas"], True), t["entradas_por_hoja"])],
            mem=["Las %d páginas de los dos niveles" % t["internas"], "de arriba ocupan 240 KB y no",
                 "salen de la memoria."],
            b1="22 niveles: 22 lecturas", b2="3 niveles: 3 lecturas, 1 de disco", lv3="nivel 3",
            note="Misma escala vertical: cada fila es un nivel, y cada nivel, una página que leer.",
            aria="Dos árboles con los mismos 3 millones de claves, a la misma escala vertical: cada fila es un "
                 "nivel. A la izquierda, un árbol binario con un nodo por página, dibujado como un triángulo alto y "
                 "estrecho de 22 filas, con el camino de una búsqueda que baja zigzagueando hasta abajo: 22 niveles, "
                 "22 lecturas. A la derecha, el índice real de pedidos.id, ancho y bajo: una raíz de 29 entradas, 29 "
                 "páginas internas de unas 284 entradas y 8 197 hojas de 367 claves. Tres niveles, tres lecturas, de "
                 "las que sólo la hoja sale del disco, porque las 30 páginas de los dos niveles de arriba ocupan 240 "
                 "KB y no salen de la memoria."),
        False: dict(
            t1="Binary tree", s1="3,000,000 keys, one node per page",
            t2="B-tree: the index on pedidos.id", s2="3,000,000 keys, hundreds per page",
            r=["1 page, %d entries" % t["entradas_raiz"],
               "%d pages, about %d entries" % (t["internas"] - 1, round(t["entradas_por_interna_media"])),
               "%s leaves, %d keys" % (num(t["hojas"], False), t["entradas_por_hoja"])],
            mem=["The %d pages of the top two" % t["internas"], "levels take 240 KB and never",
                 "leave memory."],
            b1="22 levels: 22 reads", b2="3 levels: 3 reads, 1 from disk", lv3="level 3",
            note="Same vertical scale: each row is a level, and each level is a page to read.",
            aria="Two trees holding the same 3 million keys, at the same vertical scale: each row is a level. On "
                 "the left, a binary tree with one node per page, drawn as a tall, narrow triangle of 22 rows, with "
                 "the path of one search zigzagging all the way down: 22 levels, 22 reads. On the right, the real "
                 "index on pedidos.id, wide and short: a root with 29 entries, 29 internal pages of about 284 entries "
                 "and 8,197 leaves of 367 keys. Three levels, three reads, of which only the leaf comes from disk, "
                 "because the 30 pages of the top two levels take 240 KB and never leave memory."),
    }[es]
    W, H, S, Y = 760, 372, 12, 58
    b = [text(0, 14, L["t1"], "lb"), text(0, 30, L["s1"], "sb"),
         text(372, 14, L["t2"], "lb"), text(372, 30, L["s2"], "sb")]
    # binary tree: a triangle of 22 levels with one search path
    ax, hwb, n = 165, 150, 22
    base = Y + (n - 1) * S
    b.append('<path class="tri" d="M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f Z"/>' % (ax, Y - 6, ax - hwb, base + 6, ax + hwb, base + 6))
    bits = "101100111010011011100"
    pts, pos = [], 0.5
    for i in range(n):
        y = Y + i * S
        hw = hwb * (y - Y + 6) / (base - Y + 12)
        if i:
            b.append(line(ax - hw, y, ax + hw, y, "lv"))
        pts.append((ax + (pos - 0.5) * 2 * hw, y))
        if i < n - 1:
            step = 0.5 ** (i + 2)
            pos += step if bits[i] == "1" else -step
    b.append('<path class="pt" d="M%s"/>' % " L".join("%.1f,%.1f" % p for p in pts))
    for (x, y) in pts:
        b.append('<circle cx="%.1f" cy="%.1f" r="2.6" fill="%s"/>' % (x, y, ACC))
    b.append(text(ax, base + 30, L["b1"], "lb w", "middle"))

    # B-tree: three rows at the same spacing
    bx0, bw = 372, 186
    b.append(box(bx0 + bw / 2 - 6, Y - 4.5, 12, 9, "m", 1.5))
    k = t["internas"] - 1
    gw = bw / k
    for i in range(k):
        b.append(box(bx0 + i * gw + 0.75, Y + S - 4.5, gw - 1.5, 9, "m", 1))
    b.append(box(bx0, Y + 2 * S - 4.5, bw, 9, "", 1))
    for i in range(1, 118):
        x = bx0 + i * bw / 118
        b.append(line(x, Y + 2 * S - 4, x, Y + 2 * S + 4, "ed"))
    for i, r in enumerate(L["r"]):
        b.append(text(bx0 + bw + 14, Y + i * S + 4, r, "sb"))
    # memory bracket over the two upper rows
    bk = bx0 - 8
    b.append('<path class="ar m" style="marker-end:none" d="M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f L%.1f,%.1f"/>'
             % (bk + 4, Y - 5, bk, Y - 5, bk, Y + S + 5, bk + 4, Y + S + 5))
    b += lines(bx0, Y + 2 * S + 34, L["mem"], "tx m", lh=15)
    b.append(text(bx0 + bw / 2, base + 30, L["b2"], "lb m", "middle"))
    # the B-tree ends at the third row; mark that level across the binary tree too
    y3 = Y + 2 * S
    b.append(line(54, y3, bx0 - 14, y3, "lv"))
    b.append(text(0, y3 + 4, L["lv3"], "sb"))
    b.append(text(0, H - 6, L["note"], "sb"))
    return svg(W, H, L["aria"], b)


# ─── 3. particion ────────────────────────────────────────────────────────────────────────────

def fig_particion(es):
    L = {
        True: dict(
            h=["inicio: 10, 20, 30, 40", "entra el 50", "entran 25, 35 y 60", "entra el 70"],
            c=[["La hoja, que también es", "la raíz, está llena:", "4 claves, el máximo."],
               ["No cabe: la hoja se parte", "en dos y el 30 sube a una", "raíz nueva. El árbol crece", "por arriba."],
               ["Caben en sus hojas sin", "partir nada. La de la", "derecha vuelve a estar", "llena."],
               ["Se parte la hoja de la", "derecha y el 50 sube a", "la raíz, que ahora tiene", "tres hijos."]],
            aria="Cuatro estados de un árbol B con como mucho cuatro claves por nodo. Uno: una sola hoja, que también "
                 "es la raíz, con 10, 20, 30 y 40; está llena. Dos: entra el 50 y no cabe, así que la hoja se parte en "
                 "[10, 20] y [40, 50] y el 30 sube a una raíz nueva; el árbol crece por arriba. Tres: entran 25, 35 y "
                 "60, que caben en sus hojas sin partir nada: [10, 20, 25] y [35, 40, 50, 60], que vuelve a estar "
                 "llena. Cuatro: entra el 70, la hoja de la derecha se parte en [35, 40] y [60, 70], y el 50 sube a la "
                 "raíz, que queda [30, 50] con tres hijos."),
        False: dict(
            h=["start: 10, 20, 30, 40", "50 arrives", "25, 35 and 60 arrive", "70 arrives"],
            c=[["The leaf, which is also", "the root, is full:", "4 keys, the maximum."],
               ["It does not fit: the leaf", "splits in two and 30 moves", "up to a new root. The tree", "grows at the top."],
               ["They fit in their leaves", "without splitting anything.", "The right one is full", "again."],
               ["The right leaf splits and", "50 moves up to the root,", "which now has three", "children."]],
            aria="Four states of a B-tree with at most four keys per node. One: a single leaf, which is also the "
                 "root, holding 10, 20, 30 and 40; it is full. Two: 50 arrives and does not fit, so the leaf splits "
                 "into [10, 20] and [40, 50] and 30 moves up to a new root; the tree grows at the top. Three: 25, 35 "
                 "and 60 arrive and fit in their leaves without splitting anything: [10, 20, 25] and [35, 40, 50, 60], "
                 "which is full again. Four: 70 arrives, the right leaf splits into [35, 40] and [60, 70], and 50 "
                 "moves up to the root, which becomes [30, 50] with three children."),
    }[es]
    W, H, PW = 760, 236, 190
    YR, YL, cw = 50, 112, 19
    b = []

    def tree(px, root, leaves, root_cls="", root_hot=None, leaf_cls=None, leaf_hot=None, gap=10):
        widths = [len(k) * cw for k in leaves]
        total = sum(widths) + gap * (len(leaves) - 1)
        x = px + (PW - 12 - total) / 2
        tops = []
        for i, keys in enumerate(leaves):
            parts, _, w = node(x, YL, keys, (leaf_cls or {}).get(i, ""), leaf_hot, cw)
            b.extend(parts)
            tops.append(x + w / 2)
            x += w + gap
        if root:
            w = len(root) * cw
            rx = px + (PW - 12) / 2 - w / 2
            parts, anchors, _ = node(rx, YR, root, root_cls, root_hot, cw)
            b.extend(parts)
            for a, tgt in zip(anchors, tops):
                b.append(arrow([(a, YR + NH), (tgt, YL - 2)]))

    for i in range(4):
        px = i * PW
        b.append(text(px, 14, "%d · %s" % (i + 1, L["h"][i]), "lb" if i == 0 else "lb m"))
        b += lines(px, 160, L["c"][i], "tx d", lh=15)
        if i:
            b.append(line(px - 8, 4, px - 8, H - 4, "sep"))
    # 1: one full leaf, also the root
    node_parts, _, w = node((PW - 12) / 2 - 2 * cw, YL - 31, [10, 20, 30, 40], "w", None, cw)
    b.extend(node_parts)
    # 2: split, 30 moves up to a new root
    tree(PW, [30], [[10, 20], [40, 50]], "m", {30: "m"}, {0: "w", 1: "w"}, {50: "m"})
    # 3: 25, 35, 60 fit
    tree(2 * PW, [30], [[10, 20, 25], [35, 40, 50, 60]], "", None, {1: "w"}, {25: "m", 35: "m", 60: "m"})
    # 4: the right leaf splits, 50 moves up
    tree(3 * PW, [30, 50], [[10, 20, 25], [35, 40], [60, 70]], "m", {50: "m"}, {1: "w", 2: "w"}, {70: "m"}, gap=8)
    return svg(W, H, L["aria"], b)



# ─── 4. b-contra-bmas ────────────────────────────────────────────────────────────────────────

def fig_bmas(es):
    L = {
        True: dict(
            t1="Árbol B", s1="cada clave está una sola vez, en algún nivel",
            t2="Árbol B+", s2="todas las claves en las hojas, y las hojas enlazadas",
            postes="sólo postes", rng="rango de 25 a 55: páginas visitadas, en orden",
            raiz="raíz", hoja="hoja %d",
            v1=["busca 25", "nada", "30", "40 50", "60: fin"], v2=["busca 25", "30", "40 50 · 60: fin"],
            aria="Las mismas ocho claves en un árbol B y en un árbol B+, y el recorrido de las claves entre 25 y "
                 "55. En el árbol B, la raíz tiene 30 y 60, y las hojas, [10, 20], [40, 50] y [70, 85]. Para leer el "
                 "rango hay que visitar cinco páginas: la raíz, la hoja 1, que no tiene nada, la raíz otra vez a por "
                 "el 30, la hoja 2 a por el 40 y el 50, y la raíz otra vez, donde el 60 ya se pasa. En el árbol B+, "
                 "la raíz sólo tiene postes, 40 y 70, y las hojas, [10, 20, 30], [40, 50, 60] y [70, 85], enlazadas "
                 "de izquierda a derecha. El mismo rango visita tres páginas: la raíz, la hoja 1 a por el 30 y, "
                 "siguiendo el enlace, la hoja 2 a por el 40 y el 50, donde el 60 ya se pasa."),
        False: dict(
            t1="B-tree", s1="each key lives once, at some level",
            t2="B+tree", s2="every key in the leaves, and the leaves linked",
            postes="signposts only", rng="range 25 to 55: pages visited, in order",
            raiz="root", hoja="leaf %d",
            v1=["looks for 25", "nothing", "30", "40 50", "60: stop"], v2=["looks for 25", "30", "40 50 · 60: stop"],
            aria="The same eight keys in a B-tree and in a B+tree, and the scan of the keys between 25 and 55. In "
                 "the B-tree, the root holds 30 and 60, and the leaves [10, 20], [40, 50] and [70, 85]. Reading the "
                 "range visits five pages: the root, leaf 1, which has nothing, the root again for 30, leaf 2 for 40 "
                 "and 50, and the root again, where 60 is already past the end. In the B+tree, the root holds only "
                 "signposts, 40 and 70, and the leaves [10, 20, 30], [40, 50, 60] and [70, 85], linked left to right. "
                 "The same range visits three pages: the root, leaf 1 for 30 and, following the link, leaf 2 for 40 "
                 "and 50, where 60 is already past the end."),
    }[es]
    W, H, YR, YL = 760, 262, 60, 132
    PX2 = 400
    b = [text(0, 14, L["t1"], "lb"), text(0, 30, L["s1"], "sb"),
         text(PX2, 14, L["t2"], "lb"), text(PX2, 30, L["s2"], "sb"),
         line(380, 4, 380, H - 4, "sep")]
    hot = {30: "m", 40: "m", 50: "m"}

    def tree(px, root, leaves, centers, root_cls, linked):
        tops = []
        for keys, c in zip(leaves, centers):
            w = len(keys) * CW
            parts, _, _ = node(px + c - w / 2, YL, keys, "", hot)
            b.extend(parts)
            tops.append((px + c - w / 2, px + c + w / 2))
        w = len(root) * CW
        parts, anchors, _ = node(px + 180 - w / 2, YR, root, root_cls, None if linked else hot)
        b.extend(parts)
        for a, (l, r) in zip(anchors, tops):
            b.append(arrow([(a, YR + NH), ((l + r) / 2, YL - 2)]))
        if linked:
            for (l1, r1), (l2, r2) in zip(tops, tops[1:]):
                b.append(arrow([(r1 + 2, YL + NH / 2), (l2 - 2, YL + NH / 2)], "ar m"))
            b.append(text(px + 180 + w / 2 + 10, YR + NH / 2 + 4, L["postes"], "sb"))

    tree(0, [30, 60], [[10, 20], [40, 50], [70, 85]], [60, 180, 300], "", False)
    tree(PX2, [40, 70], [[10, 20, 30], [40, 50, 60], [70, 85]], [55, 180, 305], "g", True)

    def strip(px, names, notes, cls):
        bw, gap, y = 56, 15, 206
        b.append(text(px, y - 14, L["rng"], "sb"))
        for i, (n, v) in enumerate(zip(names, notes)):
            x = px + i * (bw + gap)
            b.append(box(x, y, bw, 22, cls, 3))
            b.append(text(x + bw / 2, y + 15, n, "tx", "middle"))
            b.append(text(x, y + 38, v, "sb m" if v[:1].isdigit() else "sb"))
            if i:
                b.append(arrow([(x - gap + 1, y + 11), (x - 2, y + 11)], "ar"))

    r, h = L["raiz"], L["hoja"]
    strip(0, [r, h % 1, r, h % 2, r], L["v1"], "w")
    strip(PX2, [r, h % 1, h % 2], L["v2"], "m")
    return svg(W, H, L["aria"], b)


# ─── 5. postgres-contra-innodb ───────────────────────────────────────────────────────────────

CLIENTE_4242 = [398, 987, 3496, 5156, 9502, 11378, 15119, 17354, 18712, 21043]   # pages, real ctids
PAG_1234567 = 9077


def tri(cx, ytop, ybot, hw, cls="bx"):
    return '<path class="%s" d="M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f Z"/>' % (cls, cx, ytop, cx - hw, ybot, cx + hw, ybot)


def fig_pg_innodb(es):
    L = {
        True: dict(
            t1="Postgres: los índices apuntan a la tabla", s1="la tabla va aparte, en el orden en que llegan las filas",
            t2="InnoDB: la tabla es el árbol", s2="ordenada por la clave primaria, con las filas en las hojas",
            ix1="índice de id", ix2="índice de cliente_id", heap="tabla pedidos: 22 059 páginas",
            e1="1234567 → página 9077", e2="4242 → 10 direcciones",
            pk="clave primaria", rows="hojas: las filas enteras", e3="4242 → 10 id",
            again=["con cada id, otra vez", "desde la raíz de la tabla"],
            f1="por id: 3 + 1 = 4 páginas", f2="por cliente_id: 3 + 10 = 13",
            f3="por id: 3 páginas, y la fila ya está", f4="por cliente_id: 3 + 10 × 3",
            aria="Dos formas de guardar una tabla con índices. A la izquierda, Postgres: la tabla de pedidos va "
                 "aparte, 22 059 páginas en el orden en que llegaron las filas, y cada índice es un árbol cuyas hojas "
                 "guardan direcciones. El índice de id lleva al pedido 1 234 567, en la página 9077: tres páginas del "
                 "índice y una de la tabla, cuatro. El índice de cliente_id lleva a los diez pedidos del cliente 4242, "
                 "repartidos por diez páginas distintas de la tabla: tres más diez, trece. A la derecha, InnoDB: la "
                 "tabla es el árbol de la clave primaria, con las filas enteras en las hojas, y buscar por id son tres "
                 "páginas con la fila ya dentro. El índice de cliente_id guarda en sus hojas los diez id, y con cada "
                 "uno hay que volver a bajar por el árbol de la tabla desde la raíz: tres más diez veces tres."),
        False: dict(
            t1="Postgres: indexes point into the table", s1="the table lives apart, in the order rows arrived",
            t2="InnoDB: the table is the tree", s2="ordered by primary key, with the rows in the leaves",
            ix1="index on id", ix2="index on cliente_id", heap="pedidos table: 22,059 pages",
            e1="1234567 → page 9077", e2="4242 → 10 addresses",
            pk="primary key", rows="leaves: the whole rows", e3="4242 → 10 ids",
            again=["with each id, again", "from the table's root"],
            f1="by id: 3 + 1 = 4 pages", f2="by cliente_id: 3 + 10 = 13",
            f3="by id: 3 pages, and the row is there", f4="by cliente_id: 3 + 10 × 3",
            aria="Two ways of storing a table with indexes. On the left, Postgres: the orders table lives apart, "
                 "22,059 pages in the order the rows arrived, and each index is a tree whose leaves hold addresses. "
                 "The index on id leads to order 1,234,567, on page 9077: three index pages and one table page, four. "
                 "The index on cliente_id leads to the ten orders of customer 4242, spread over ten different table "
                 "pages: three plus ten, thirteen. On the right, InnoDB: the table is the primary-key tree, with the "
                 "whole rows in its leaves, and a lookup by id is three pages with the row already inside. The index "
                 "on cliente_id holds the ten ids in its leaves, and for each one the search goes down the table's "
                 "tree again from the root: three plus ten times three."),
    }[es]
    W, H, PX2 = 760, 318, 404
    b = [text(0, 14, L["t1"], "lb"), text(0, 30, L["s1"], "sb"),
         text(PX2, 14, L["t2"], "lb"), text(PX2, 30, L["s2"], "sb"),
         line(388, 4, 388, H - 4, "sep")]
    # Postgres: two index trees over a heap of pages
    for cx, name, entry, cls in ((80, L["ix1"], L["e1"], "m"), (272, L["ix2"], L["e2"], "w")):
        b.append(tri(cx, 52, 112, 72, "bx " + cls))
        b.append(text(cx, 106, name, "sb", "middle"))
        b.append(text(cx, 128, entry, "mo " + cls, "middle"))
    cols, rows_, pw, ph, gx = 24, 2, 12.5, 12.5, 2.5
    hx, hy = 2, 196
    def page_xy(pg):
        k = int(pg / 22059 * cols * rows_)
        return hx + (k % cols) * (pw + gx), hy + (k // cols) * (ph + gx)
    hot_pg = {page_xy(PAG_1234567): "f"}
    for pg in CLIENTE_4242:
        hot_pg.setdefault(page_xy(pg), "w")
    for r in range(rows_):
        for c in range(cols):
            x, y = hx + c * (pw + gx), hy + r * (ph + gx)
            h = hot_pg.get((x, y))
            b.append(box(x, y, pw, ph, {"f": "f", "w": "w"}.get(h, "g"), 2))
    b.append(text(hx, hy + 2 * (ph + gx) + 14, L["heap"], "sb"))
    x, y = page_xy(PAG_1234567)
    b.append(arrow([(80, 134), (x + pw / 2, y - 3)], "ar m"))
    for pg in CLIENTE_4242:
        x, y = page_xy(pg)
        b.append(arrow([(272, 134), (x + pw / 2, y - 3)], "ar w"))
    b.append(text(0, H - 26, L["f1"], "tx m"))
    b.append(text(0, H - 8, L["f2"], "tx w"))
    # InnoDB: a secondary tree and the clustered primary-key tree
    sx, kx = PX2 + 52, PX2 + 250
    b.append(tri(sx, 52, 112, 50, "bx w"))
    b.append(text(sx, 106, L["ix2"].replace("índice de ", "").replace("index on ", ""), "sb", "middle"))
    b.append(text(sx, 128, L["e3"], "mo w", "middle"))
    b.append(tri(kx, 52, 196, 102, "bx m"))
    b.append(text(kx - 40, 188, L["pk"], "sb", "middle"))
    for i in range(14):
        b.append(box(kx - 100 + i * 14.3, 200, 12, 12, "m", 2))
    b.append(text(kx, 230, L["rows"], "sb", "middle"))
    b.append('<path class="ar w" d="M%.1f,%.1f Q%.1f,%.1f %.1f,%.1f"/>' % (sx + 30, 136, sx + 70, 190, kx - 8, 56))
    b += lines(sx - 40, 168, L["again"], "sb w", lh=13)
    b.append(arrow([(kx + 4, 60), (kx + 30, 196)], "ar m"))
    b.append(text(PX2, H - 26, L["f3"], "tx m"))
    b.append(text(PX2, H - 8, L["f4"], "tx w"))
    return svg(W, H, L["aria"], b)


# ─── 6. linea-de-tiempo ──────────────────────────────────────────────────────────────────────

def fig_linea(es):
    ev = [  # (year, es, en, family)
        (1962, ("árbol AVL", "binario equilibrado"), ("AVL tree", "balanced binary"), False),
        (1970, ("árbol B", "Bayer y McCreight"), ("B-tree", "Bayer and McCreight"), True),
        (1972, ("rojinegro", "un árbol B binario"), ("red-black", "a binary B-tree"), True),
        (1973, ("VSAM, de IBM", "árbol B+"), ("IBM's VSAM", "B+tree"), True),
        (1979, ("«ubicuo»", "reseña de Comer"), ("“ubiquitous”", "Comer's survey"), True),
        (1981, ("árbol B-link", "Lehman y Yao"), ("B-link tree", "Lehman and Yao"), True),
        (1990, ("lista con saltos", "Pugh"), ("skip list", "Pugh"), False),
        (1996, ("árbol LSM", "para escribir"), ("LSM tree", "for writing"), False),
        (2013, ("ART, Bw-tree", "para memoria"), ("ART, Bw-tree", "for memory"), False),
        (2018, ("índices aprendidos", "Kraska y otros"), ("learned indexes", "Kraska et al."), False),
    ]
    L = {
        True: dict(k1="familia del árbol B", k2="alternativas",
                   aria="Línea de tiempo, no a escala, con diez hitos. En verde, la familia del árbol B: 1970, el "
                        "árbol B de Bayer y McCreight; 1972, el rojinegro, un árbol B escrito con nodos binarios; "
                        "1973, VSAM de IBM, con el árbol B+; 1979, la reseña de Comer que lo llama ubicuo; 1981, el "
                        "árbol B-link de Lehman y Yao. En naranja, las alternativas: 1962, el árbol AVL; 1990, la "
                        "lista con saltos de Pugh; 1996, el árbol LSM, para escribir; 2013, ART y Bw-tree, para "
                        "memoria; 2018, los índices aprendidos de Kraska y otros."),
        False: dict(k1="the B-tree family", k2="alternatives",
                    aria="Timeline, not to scale, with ten milestones. In green, the B-tree family: 1970, the B-tree "
                         "of Bayer and McCreight; 1972, the red-black tree, a B-tree written with binary nodes; 1973, "
                         "IBM's VSAM, with the B+tree; 1979, Comer's survey calling it ubiquitous; 1981, the B-link "
                         "tree of Lehman and Yao. In orange, the alternatives: 1962, the AVL tree; 1990, Pugh's skip "
                         "list; 1996, the LSM tree, for writing; 2013, ART and Bw-tree, for memory; 2018, the learned "
                         "indexes of Kraska et al."),
    }[es]
    W, H, Y = 760, 150, 84
    b = [line(8, Y, W - 8, Y, "ed")]
    step = (W - 124) / (len(ev) - 1)
    for i, (yr, tes, ten, fam) in enumerate(ev):
        x = 62 + i * step
        t = tes if es else ten
        c = "m" if fam else "w"
        b.append('<circle cx="%.1f" cy="%d" r="4.5" fill="%s"/>' % (x, Y, ACC if fam else WARN))
        up = i % 2 == 0
        b.append(line(x, Y + (-6 if up else 6), x, Y + (-16 if up else 16), "ed"))
        ty = Y - 46 if up else Y + 30
        b.append(text(x, ty, str(yr), "lb " + c, "middle"))
        b.append(text(x, ty + 14, t[0], "tx", "middle"))
        b.append(text(x, ty + 27, t[1], "sb", "middle"))
    b.append('<circle cx="%d" cy="10" r="4.5" fill="%s"/>' % (W - 250, ACC))
    b.append(text(W - 240, 14, L["k1"], "sb"))
    b.append('<circle cx="%d" cy="10" r="4.5" fill="%s"/>' % (W - 100, WARN))
    b.append(text(W - 90, 14, L["k2"], "sb"))
    return svg(W, H, L["aria"], b)

for name, fn in (("anatomia", fig_anatomia), ("binario-contra-b", fig_binario), ("particion", fig_particion),
                 ("b-contra-bmas", fig_bmas), ("postgres-contra-innodb", fig_pg_innodb), ("linea-de-tiempo", fig_linea)):
    write(name, fn(True), fn(False))
print("ok:", OUT)
