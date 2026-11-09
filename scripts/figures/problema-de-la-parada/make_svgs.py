"""BLOG-24 — Figures for the blog post `problema-de-la-parada`. All diagrams; the only numbers are
the Busy Beaver values in `frontera`, from the bbchallenge paper (arXiv 2509.12337) and the sources
listed in the post's header comment.
Run from this directory: python3 make_svgs.py ../../../public/blog/problema-de-la-parada
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

Every figure's aria-label is the `alt` of its <img> in content/blog/{es,en}/problema-de-la-parada.mdx,
word for word: change one, change the other."""
import sys, os

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
  .bx.x {{ stroke: {BAD}; fill: rgba(255,180,171,0.10); }}
  .bx.g {{ stroke: {LINE}; }}
  .bx.d {{ stroke: {MUTED}; stroke-dasharray: 3 3; }}
  .bx.o {{ fill: {SURF}; }}
  .lb {{ font-size: 12px; font-weight: 600; text-anchor: middle; }}
  .sb {{ font-size: 10.5px; fill: {MUTED}; text-anchor: middle; }}
  .tx {{ font-size: 11px; }}
  .hd {{ font-size: 10px; fill: {MUTED}; letter-spacing: 0.1em; }}
  .m {{ fill: {ACC}; }}
  .w {{ fill: {WARN}; }}
  .x {{ fill: {BAD}; }}
  .ln {{ fill: none; stroke: {MUTED}; stroke-width: 1.2; }}
  .ln.m {{ stroke: {ACC}; }}
  .ln.w {{ stroke: {WARN}; }}
  .ln.x {{ stroke: {BAD}; }}
  .ar {{ fill: none; stroke: {MUTED}; stroke-width: 1.2; marker-end: url(#a); }}
  .ar.m {{ stroke: {ACC}; marker-end: url(#am); }}
  .ar.w {{ stroke: {WARN}; marker-end: url(#aw); }}
  .ar.x {{ stroke: {BAD}; marker-end: url(#ax); }}
</style>"""

DEFS = "<defs>" + "".join(
    f'<marker id="{i}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
    f'<path d="M0,0.5 L7.5,4 L0,7.5 z" fill="{c}"/></marker>'
    for i, c in (("a", MUTED), ("am", ACC), ("aw", WARN), ("ax", BAD))) + "</defs>"


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def svg(w, h, aria, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img"\n'
            ' aria-label="%s">\n%s\n%s\n%s\n</svg>\n'
            % (w, h, w, h, esc(aria).replace('"', "&quot;"), STYLE, DEFS, "\n".join(body)))


def box(x, y, w, h, cls="", rx=6):
    return '<rect class="bx %s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%d"/>' % (cls, x, y, w, h, rx)


def text(x, y, s, cls="tx", anchor=None):
    a = ' style="text-anchor:%s"' % anchor if anchor else ""
    return '<text class="%s" x="%.1f" y="%.1f"%s>%s</text>' % (cls, x, y, a, esc(s))


def lines(x, y, rows, cls="tx", anchor=None, step=14):
    return "\n".join(text(x, y + i * step, r, cls, anchor) for i, r in enumerate(rows))


def labelled(x, y, w, h, title, sub=None, cls=""):
    out = [box(x, y, w, h, cls)]
    tcls = {"m": "lb m", "w": "lb w", "x": "lb x"}.get(cls, "lb")
    if sub:
        out.append(text(x + w / 2, y + h / 2 - 2, title, tcls))
        out.append(text(x + w / 2, y + h / 2 + 12, sub, "sb"))
    else:
        out.append(text(x + w / 2, y + h / 2 + 4, title, tcls))
    return "\n".join(out)


def path(pts, cls="ln"):
    d = "M" + " L".join("%.1f,%.1f" % p for p in pts)
    return '<path class="%s" d="%s"/>' % (cls, d)


def arrow(pts, cls="ar"):
    return path(pts, cls)


def write(name, es_svg, en_svg):
    for suffix, content in ((".svg", es_svg), (".en.svg", en_svg)):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(content)


# ─── 1. diagonal ──────────────────────────────────────────────────────────────────────────────

ARIA_DIAG = {
    True: "Una tabla con cinco programas en las filas y los mismos cinco programas como entradas en las "
          "columnas. Cada casilla dice si el programa de la fila termina con esa entrada o se queda "
          "ejecutándose para siempre. Las casillas de la diagonal, en las que cada programa recibe su propio "
          "código, están destacadas. Debajo, una fila más, la de paradoja, que en cada columna hace lo "
          "contrario de lo que dice la diagonal: donde la diagonal termina, paradoja no termina, y al revés. "
          "Por eso paradoja se distingue de cada fila de la tabla en al menos una casilla y no puede ser "
          "ninguna de ellas.",
    False: "A table with five programs in the rows and the same five programs as inputs in the columns. Each "
           "cell says whether the program in the row halts on that input or runs forever. The cells on the "
           "diagonal, where each program receives its own code, are highlighted. Below, one more row, "
           "paradox's, which in each column does the opposite of what the diagonal says: where the diagonal "
           "halts, paradox runs forever, and the other way round. That is why paradox differs from every row "
           "of the table in at least one cell and cannot be any of them.",
}

# True = halts. Any pattern works; what matters is the diagonal.
TABLE = [
    [True, False, True, True, False],
    [False, False, True, False, True],
    [True, True, True, False, False],
    [False, True, False, False, True],
    [True, False, False, True, True],
]


def fig_diagonal(es):
    L = {True: dict(halt="termina", loop="∞", prog="PROGRAMA", inp="ENTRADA: SU CÓDIGO", par="paradoja",
                    note=["paradoja(pₖ) hace lo", "contrario que pₖ(pₖ):", "no coincide con", "ninguna fila"]),
         False: dict(halt="halts", loop="∞", prog="PROGRAM", inp="INPUT: ITS CODE", par="paradox",
                     note=["paradox(pₖ) does the", "opposite of pₖ(pₖ):", "it matches", "no row"])}[es]
    x0, y0, cw, ch = 190, 52, 80, 30
    b = []
    b.append(text(x0 + 2.5 * cw, 26, L["inp"], "hd", "middle"))
    b.append(text(40, 26, L["prog"], "hd", "start"))
    for j in range(5):
        b.append(text(x0 + j * cw + cw / 2, 44, "p%s" % "₁₂₃₄₅"[j], "lb"))
    for i, row in enumerate(TABLE):
        y = y0 + i * ch
        b.append(text(150, y + ch / 2 + 4, "p%s" % "₁₂₃₄₅"[i], "lb"))
        for j, v in enumerate(row):
            diag = i == j
            b.append(box(x0 + j * cw + 2, y + 2, cw - 4, ch - 4, "m" if diag else "g", 4))
            b.append(text(x0 + j * cw + cw / 2, y + ch / 2 + 4, L["halt"] if v else L["loop"],
                          "lb m" if diag else "tx", None if diag else "middle"))
    yp = y0 + 5 * ch + 22
    b.append(path([(40, yp - 11), (x0 + 5 * cw, yp - 11)], "ln"))
    b.append(text(150, yp + ch / 2 + 4, L["par"], "lb w"))
    for j in range(5):
        v = not TABLE[j][j]
        b.append(box(x0 + j * cw + 2, yp + 2, cw - 4, ch - 4, "w", 4))
        b.append(text(x0 + j * cw + cw / 2, yp + ch / 2 + 4, L["halt"] if v else L["loop"], "lb w"))
        # from the diagonal cell down to the cell of paradoja that flips it
        b.append(arrow([(x0 + j * cw + cw - 8, y0 + j * ch + ch - 2), (x0 + j * cw + cw - 8, yp)], "ar w"))
    b.append(lines(600, 120, L["note"], "tx w"))
    return svg(760, 268, ARIA_DIAG[es], b)


# ─── 2. trilema ───────────────────────────────────────────────────────────────────────────────

ARIA_TRI = {
    True: "Un triángulo con una propiedad en cada vértice: general, que funciona con cualquier programa; "
          "total, que siempre contesta sí o no; y exacto, que nunca se equivoca. En el centro, en rojo, el "
          "procedimiento que tiene las tres, que el teorema prohíbe. Cada lado une dos propiedades y renuncia "
          "a la tercera. Entre general y exacto, renunciando a contestar siempre: ejecutar el programa, los "
          "analizadores que dicen posible error y los límites de tiempo. Entre total y exacto, renunciando a "
          "la generalidad: los lenguajes en los que todo programa termina, como Lean, y el verificador de "
          "eBPF. Entre general y total, renunciando a la exactitud: los tests, el fuzzing y quien adivina.",
    False: "A triangle with one property at each corner: general, it works on any program; total, it always "
           "answers yes or no; and exact, it is never wrong. In the middle, in red, the procedure that "
           "has all three, which the theorem rules out. Each side joins two properties and gives up the "
           "third. Between general and exact, giving up always answering: running the program, analysers "
           "that say possible error, and time limits. Between total and exact, giving up generality: "
           "languages in which every program halts, such as Lean, and the eBPF verifier. Between general and "
           "total, giving up exactness: tests, fuzzing and whoever guesses.",
}


def fig_trilema(es):
    L = {True: dict(g=("General", "cualquier programa"), t=("Total", "siempre contesta sí o no"),
                    e=("Exacto", "nunca se equivoca"), c1="las tres", c2="a la vez", c3="no existe",
                    left=("SIN EXACTITUD", ["tests, fuzzing,", "quien adivina"]),
                    right=("SIN CONTESTAR SIEMPRE", ["ejecutar el programa,", "«posible error»,",
                                                     "límites de tiempo"]),
                    bottom=("SIN GENERALIDAD", "lenguajes en los que todo termina (Lean), verificador de eBPF")),
         False: dict(g=("General", "any program"), t=("Total", "always answers yes or no"),
                     e=("Exact", "never wrong"), c1="all three", c2="at once", c3="does not exist",
                     left=("NOT EXACT", ["tests, fuzzing,", "whoever guesses"]),
                     right=("DOES NOT ALWAYS ANSWER", ["running the program,", "“possible error”,",
                                                       "time limits"]),
                     bottom=("NOT GENERAL", "languages in which everything halts (Lean), the eBPF verifier"))}[es]
    T, BL, BR = (380, 62), (210, 300), (550, 300)
    b = []
    b.append('<path class="ln" d="M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f Z" style="stroke:%s"/>'
             % (T + BL + BR + (LINE,)))
    # sides, coloured by what they keep
    b.append(path([T, BL], "ln w"))
    b.append(path([T, BR], "ln m"))
    b.append(path([BL, BR], "ln m"))
    b.append(labelled(T[0] - 80, T[1] - 30, 160, 44, L["g"][0], L["g"][1], "o"))
    b.append(labelled(BL[0] - 100, BL[1] - 4, 170, 44, L["t"][0], L["t"][1], "o"))
    b.append(labelled(BR[0] - 70, BR[1] - 4, 170, 44, L["e"][0], L["e"][1], "o"))
    cx, cy = 380, 205
    b.append(box(cx - 52, cy - 26, 104, 52, "x", 8))
    b.append(text(cx, cy - 8, L["c1"], "lb x"))
    b.append(text(cx, cy + 6, L["c2"], "lb x"))
    b.append(text(cx, cy + 20, L["c3"], "sb"))
    # left side: general + total, gives up exactness
    b.append(text(150, 150, L["left"][0], "hd w", "end"))
    b.append(lines(150, 166, L["left"][1], "tx", "end"))
    # right side: general + exact, gives up always answering
    b.append(text(610, 150, L["right"][0], "hd m", "start"))
    b.append(lines(610, 166, L["right"][1], "tx", "start"))
    # bottom: total + exact, gives up generality
    b.append(text(380, 372, L["bottom"][0], "hd m", "middle"))
    b.append(text(380, 388, L["bottom"][1], "tx", "middle"))
    b.append(path([(158, 162), (285, 182)], "ln w"))
    b.append(path([(602, 162), (475, 182)], "ln m"))
    b.append(path([(380, 360), (380, 302)], "ln m"))
    return svg(760, 400, ARIA_TRI[es], b)


# ─── 3. certificado ───────────────────────────────────────────────────────────────────────────

ARIA_CERT = {
    True: "Dos cajas unidas por una flecha. A la izquierda, el buscador: recibe el programa e intenta "
          "encontrar un certificado, como una función de ranking o una demostración. Puede tardar mucho, "
          "puede no encontrarlo nunca y puede proponer uno incorrecto, y por eso puede ser una persona, una "
          "heurística o cualquier otro método. Le pasa su propuesta a la derecha, al comprobador: un programa "
          "pequeño que siempre termina y que acepta o rechaza el certificado. Si lo acepta, la conclusión es "
          "segura aunque el buscador no sea de fiar. Si lo rechaza, el buscador vuelve a intentarlo o la "
          "respuesta es no lo sé.",
    False: "Two boxes joined by an arrow. On the left, the searcher: it takes the program and tries to find a "
           "certificate, such as a ranking function or a proof. It may take a long time, may never find one "
           "and may propose a wrong one, which is why it can be a person, a heuristic or any other method. It "
           "passes its proposal to the right, to the checker: a small program that always halts and accepts "
           "or rejects the certificate. If it accepts, the conclusion is certain even if the searcher cannot "
           "be trusted. If it rejects, the searcher tries again or the answer is I don't know.",
}


def fig_certificado(es):
    L = {True: dict(prog="programa", s="Buscador", s2="persona, heurística, lo que sea",
                    sn=["puede tardar mucho,", "no encontrarlo nunca", "o proponer uno malo"],
                    cert="certificado propuesto", cert2="ranking, demostración",
                    c="Comprobador", c2="pequeño, siempre termina", ok="acepta", ok2="conclusión segura",
                    no="rechaza", no2="otra vez, o «no lo sé»", hd1="PUEDE FALLAR", hd2="DE FIAR"),
         False: dict(prog="program", s="Searcher", s2="a person, a heuristic, anything",
                     sn=["may take a long time,", "never find one", "or propose a bad one"],
                     cert="proposed certificate", cert2="ranking function, proof",
                     c="Checker", c2="small, always halts", ok="accepts", ok2="certain conclusion",
                     no="rejects", no2="again, or “I don't know”", hd1="MAY FAIL", hd2="TRUSTED")}[es]
    b = []
    b.append(text(10, 102, L["prog"], "tx", "start"))
    b.append(arrow([(68, 98), (98, 98)]))
    b.append(text(102, 50, L["hd1"], "hd w", "start"))
    b.append(labelled(102, 64, 200, 68, L["s"], L["s2"], "w"))
    b.append(lines(202, 150, L["sn"], "sb"))
    b.append(arrow([(304, 98), (420, 98)], "ar"))
    b.append(text(362, 88, L["cert"], "sb"))
    b.append(text(362, 116, L["cert2"], "sb"))
    b.append(text(424, 50, L["hd2"], "hd m", "start"))
    b.append(labelled(424, 64, 170, 68, L["c"], L["c2"], "m"))
    b.append(arrow([(596, 80), (620, 80), (620, 58), (636, 58)], "ar m"))
    b.append(text(642, 54, L["ok"], "lb m", "start"))
    b.append(text(642, 68, L["ok2"], "sb", "start"))
    # rejected: back to the searcher
    b.append(arrow([(509, 134), (509, 205), (202, 205), (202, 194)], "ar w"))
    b.append(text(519, 168, L["no"], "lb w", "start"))
    b.append(text(519, 182, L["no2"], "sb", "start"))
    return svg(760, 230, ARIA_CERT[es], b)


# ─── 4. frontera ──────────────────────────────────────────────────────────────────────────────

ARIA_FRONT = {
    True: "Un eje horizontal, no a escala, con el número de estados de una máquina de Turing. De 1 a 5 "
          "estados, en verde, los valores del castor atareado que se conocen: 1, 6, 21, 107 y 47 176 870, "
          "este último demostrado en Coq en 2024. En 6 estados, en naranja, empieza lo desconocido: "
          "Antihydra, un problema del tipo de Collatz. Más a la derecha, máquinas que se paran si y sólo si "
          "es falsa una conjetura: la de Erdős con 15 estados, la de Goldbach con 27 y la hipótesis de "
          "Riemann con 744. En 643 estados, en rojo, una máquina de la que la teoría de conjuntos habitual, "
          "ZFC, no puede demostrar si se para.",
    False: "A horizontal axis, not to scale, with the number of states of a Turing machine. From 1 to 5 "
           "states, in green, the busy beaver values that are known: 1, 6, 21, 107 and 47,176,870, the last "
           "one proved in Coq in 2024. At 6 states, in orange, the unknown begins: Antihydra, a Collatz-like "
           "problem. Further right, machines that halt if and only if a conjecture is false: Erdős's with 15 "
           "states, Goldbach's with 27 and the Riemann hypothesis with 744. At 643 states, in red, a machine "
           "for which the usual set theory, ZFC, cannot prove whether it halts.",
}


def fig_frontera(es):
    L = {True: dict(axis="NÚMERO DE ESTADOS (NO A ESCALA)", known="SE CONOCE BB(n)", open="ABIERTO",
                    zfc="FUERA DE ZFC", bb5="47 176 870", bb5b="Coq, 2024", anti="Antihydra",
                    anti2="tipo Collatz", erd="Erdős", gold="Goldbach", riem="Riemann",
                    z1="ZFC no puede", z2="demostrar si se para"),
         False: dict(axis="NUMBER OF STATES (NOT TO SCALE)", known="BB(n) IS KNOWN", open="OPEN",
                     zfc="BEYOND ZFC", bb5="47,176,870", bb5b="Coq, 2024", anti="Antihydra",
                     anti2="Collatz-like", erd="Erdős", gold="Goldbach", riem="Riemann",
                     z1="ZFC cannot prove", z2="whether it halts")}[es]
    ay = 120
    xs = {1: 40, 2: 85, 3: 130, 4: 175, 5: 240, 6: 330, 15: 420, 27: 500, 643: 610, 744: 700}
    b = []
    b.append(path([(40, ay), (300, ay)], "ln m"))
    b.append(path([(300, ay), (575, ay)], "ln w"))
    b.append(path([(575, ay), (735, ay)], "ln x"))
    b.append(text(150, 30, L["known"], "hd m", "middle"))
    b.append(text(440, 30, L["open"], "hd w", "middle"))
    b.append(text(660, 30, L["zfc"], "hd x", "middle"))
    for n, x in xs.items():
        cls = "m" if n <= 5 else ("x" if n >= 643 else "w")
        b.append('<circle cx="%.1f" cy="%.1f" r="4" class="%s"/>' % (x, ay, cls))
        b.append(text(x, ay + 22, str(n), "lb " + cls))
    for n, v in ((1, "1"), (2, "6"), (3, "21"), (4, "107")):
        b.append(text(xs[n], ay - 14, v, "tx", "middle"))
    b.append(text(xs[5], ay - 28, L["bb5"], "lb m"))
    b.append(text(xs[5], ay - 14, L["bb5b"], "sb"))
    b.append(text(xs[6], ay - 28, L["anti"], "lb w"))
    b.append(text(xs[6], ay - 14, L["anti2"], "sb"))
    b.append(text(xs[15], ay - 14, L["erd"], "tx", "middle"))
    b.append(text(xs[27], ay - 14, L["gold"], "tx", "middle"))
    b.append(text(xs[744], ay - 14, L["riem"], "tx", "middle"))
    b.append(text(xs[643], ay + 44, L["z1"], "sb x"))
    b.append(text(xs[643], ay + 58, L["z2"], "sb x"))
    b.append(text(390, 212, L["axis"], "hd", "middle"))
    return svg(760, 230, ARIA_FRONT[es], b)


if __name__ == "__main__":
    write("diagonal", fig_diagonal(True), fig_diagonal(False))
    write("trilema", fig_trilema(True), fig_trilema(False))
    write("certificado", fig_certificado(True), fig_certificado(False))
    write("frontera", fig_frontera(True), fig_frontera(False))
