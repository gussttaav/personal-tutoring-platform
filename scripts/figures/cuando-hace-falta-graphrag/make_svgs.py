"""BLOG-08 — Figures for the blog post `cuando-hace-falta-graphrag`. Mostly diagrams; two things
are computed or measured, and both are exactly what the article quotes:

  - `ppr-4812` runs Personalized PageRank (restart probability 0.5, HippoRAG's value) with node
    specificity on the toy graph below and ranks the passages by the summed probability of the
    phrases each one contains, as HippoRAG does. The graph is invented; the ranking is computed.
  - `coste-por-pregunta` plots the average token cost per question from GraphRAG-Bench
    (Xiang et al., ICLR 2026, tables 6 and 7, novel dataset), copied verbatim into COST below.

The Albarán numbers (900 tickets, 340 / 260 / 180 / 120, the 310 that say «reembolso», the 20 the
assistant read, the 23 Team plan customers) are invented and the article says so; if one changes,
change it in the body too.

Run from this directory: python3 make_svgs.py ../../../public/blog/cuando-hace-falta-graphrag
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

`donde-vive-la-respuesta` and `tres-grafos` are the SAME drawing (`fig_donde()`): the closing one
adds, under each panel, the tool that answers that kind of question."""
import sys, os
from collections import defaultdict

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; LINE = "#3b3b3e"
WARN = "#e8a24c"; BAD = "#ffb4ab"; SURF = "#131315"
# Categorical fills for the four refund causes. The three hues are validated for the dark surface
# (dataviz validate_palette.js --mode dark --surface #131315: lightness band, chroma, CVD and
# normal-vision separation all pass); «otros» is the gray fold, on purpose.
C_RECT, C_SUBIDA, C_DUP, C_OTROS = "#22a672", "#c47d2b", "#5b8ce0", "#55565c"
INK = "#0e0e10"  # text set inside a colored fill
FONT = "ui-sans-serif, system-ui, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .bx {{ fill: none; stroke: {MUTED}; stroke-width: 1; }}
  .bx.m {{ stroke: {ACC}; fill: rgba(78,222,163,0.08); }}
  .bx.w {{ stroke: {WARN}; fill: rgba(232,162,76,0.08); }}
  .bx.x {{ fill: none; stroke: {BAD}; stroke-dasharray: 3 3; }}
  .bx.g {{ stroke: {LINE}; }}
  .lb {{ font-size: 12px; font-weight: 600; text-anchor: middle; }}
  .sb {{ font-size: 10.5px; fill: {MUTED}; text-anchor: middle; }}
  .tx {{ font-size: 11px; }}
  .tx.d {{ fill: {MUTED}; }}
  .mo {{ font-family: {MONO}; font-size: 10.5px; }}
  .hd {{ font-size: 10px; fill: {MUTED}; letter-spacing: 0.1em; }}
  .in {{ font-size: 10.5px; font-weight: 600; fill: {INK}; text-anchor: middle; }}
  .hl {{ paint-order: stroke; stroke: {SURF}; stroke-width: 4px; stroke-linejoin: round; }}
  .m {{ fill: {ACC}; }}
  .w {{ fill: {WARN}; }}
  .x {{ fill: {BAD}; }}
  .ar {{ fill: none; stroke: {MUTED}; stroke-width: 1.2; marker-end: url(#a); }}
  .ar.m {{ stroke: {ACC}; marker-end: url(#am); }}
  .ar.w {{ stroke: {WARN}; marker-end: url(#aw); }}
  .ed {{ stroke: {LINE}; stroke-width: 1.2; }}
  .ed.m {{ stroke: {ACC}; stroke-width: 1.4; }}
  .ed.x {{ stroke: {BAD}; stroke-dasharray: 3 3; }}
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


def box(x, y, w, h, cls="", rx=6):
    return '<rect class="bx %s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%d"/>' % (cls, x, y, w, h, rx)


def text(x, y, s, cls="tx", anchor=None):
    a = ' style="text-anchor:%s"' % anchor if anchor else ""
    return '<text class="%s" x="%.1f" y="%.1f"%s>%s</text>' % (cls, x, y, a, esc(s))


def lines(x, y, rows, cls="tx", lh=14, anchor=None):
    """Multi-line text; each row is a string or a list of (fragment, extra-class) spans."""
    out = []
    for i, r in enumerate(rows):
        if isinstance(r, str):
            out.append(text(x, y + i * lh, r, cls, anchor))
        else:
            a = ' style="text-anchor:%s"' % anchor if anchor else ""
            spans = "".join('<tspan class="%s">%s</tspan>' % (c, esc(f)) if c else esc(f) for f, c in r)
            out.append('<text class="%s" x="%.1f" y="%.1f"%s>%s</text>' % (cls, x, y + i * lh, a, spans))
    return "\n".join(out)


def labelled(x, y, w, h, title, sub=None, cls=""):
    out = [box(x, y, w, h, cls)]
    tcls = {"m": "lb m", "w": "lb w"}.get(cls, "lb")
    if sub:
        out.append(text(x + w / 2, y + h / 2 - 2, title, tcls))
        out.append(text(x + w / 2, y + h / 2 + 12, sub, "sb"))
    else:
        out.append(text(x + w / 2, y + h / 2 + 4, title, tcls))
    return "\n".join(out)


def arrow(pts, cls="ar"):
    d = "M" + " L".join("%.1f,%.1f" % p for p in pts)
    return '<path class="%s" d="%s"/>' % (cls, d)


def hbar(x, y, w, h, fill, round_end=True):
    """A horizontal bar anchored at x: square at the baseline, 4 px rounded data-end."""
    r = min(4.0, w / 2, h / 2) if round_end else 0
    if w <= 0:
        return ""
    return ('<path d="M%.2f,%.2f H%.2f Q%.2f,%.2f %.2f,%.2f V%.2f Q%.2f,%.2f %.2f,%.2f H%.2f Z" fill="%s"/>'
            % (x, y, x + w - r, x + w, y, x + w, y + r, y + h - r, x + w, y + h, x + w - r, y + h, x, fill))


def mix(fg, bg, a):
    """`fg` at opacity `a` over `bg`, as an opaque hex, so edges drawn under a node stay hidden."""
    f = [int(fg[i:i + 2], 16) for i in (1, 3, 5)]
    g = [int(bg[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join("%02x" % round(a * x + (1 - a) * y) for x, y in zip(f, g))


def num(n, es):
    """Thousands with a space in Spanish (the blog's convention), a comma in English."""
    s = "{:,}".format(n)
    return s.replace(",", " ") if es else s


def write(name, es_svg, en_svg):
    for suffix, content in ((".svg", es_svg), (".en.svg", en_svg)):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(content)


# ─── 1/7. donde-vive-la-respuesta · tres-grafos ──────────────────────────────────────────────

DONDE = {
    True: dict(
        heads=["EN UN FRAGMENTO", "EN UNA CADENA", "EN EL CONJUNTO", "EN LAS RELACIONES"],
        qs=[["¿Qué plazo de reembolso", "tiene el plan Equipo?"],
            ["¿El cliente de la 4812", "tiene derecho a reembolso?"],
            ["¿Por qué nos piden", "reembolsos este trimestre?"],
            ["¿Cuántos clientes del plan", "Equipo esperan el arreglo", "de la 3.2?"]],
        where=["un documento", "dos o tres, encadenados", "cientos, todos a la vez", "un recuento sobre datos"],
        tools=[("RAG híbrido", "sin grafo"), ("Agente o memoria", "el grafo como memoria"),
               ("Mapa de comunidades", "el grafo como mapa"), ("Una consulta", "el grafo que ya tienes")],
        plan="plan Equipo", bug="fallo 3.2",
        aria="Cuatro paneles, uno por sitio donde puede estar la respuesta a una pregunta de Albarán. En "
             "un fragmento: ¿qué plazo de reembolso tiene el plan Equipo?; la responde un documento. En una "
             "cadena: ¿el cliente de la 4812 tiene derecho a reembolso?; hacen falta dos o tres documentos "
             "encadenados. En el conjunto: ¿por qué nos piden reembolsos este trimestre?; hacen falta cientos "
             "de documentos a la vez. En las relaciones: ¿cuántos clientes del plan Equipo esperan el arreglo "
             "de la 3.2?; la respuesta es un recuento sobre datos: los clientes unidos a la vez al plan y "
             "al fallo.",
        aria_tools=" Debajo de cada panel, la herramienta que la responde: RAG híbrido, sin grafo; un agente o "
                   "una memoria asociativa, el grafo como memoria; un mapa de comunidades, el grafo como mapa; "
                   "una consulta, el grafo que ya tienes."),
    False: dict(
        heads=["IN ONE CHUNK", "IN A CHAIN", "IN THE WHOLE", "IN THE RELATIONS"],
        qs=[["What refund window does", "the Team plan have?"],
            ["Is the customer on 4812", "entitled to a refund?"],
            ["Why are customers asking", "for refunds this quarter?"],
            ["How many Team plan", "customers are waiting for", "the 3.2 fix?"]],
        where=["one document", "two or three, chained", "hundreds, all at once", "a count over data"],
        tools=[("Hybrid RAG", "no graph"), ("Agent or memory", "the graph as memory"),
               ("Community map", "the graph as a map"), ("A query", "the graph you already have")],
        plan="Team plan", bug="3.2 bug",
        aria="Four panels, one for each place the answer to an Albarán question can live. In one chunk: what "
             "refund window does the Team plan have?; one document answers it. In a chain: is the customer "
             "on 4812 entitled to a refund?; it takes two or three chained documents. In the whole: why are "
             "customers asking for refunds this quarter?; it takes hundreds of documents at once. In the "
             "relations: how many Team plan customers are waiting for the 3.2 fix?; the answer is a count "
             "over data: the customers linked both to the plan and to the bug.",
        aria_tools=" Under each panel, the tool that answers it: hybrid RAG, no graph; an agent or an "
                   "associative memory, the graph as memory; a community map, the graph as a map; a query, "
                   "the graph you already have."),
}

# Panel 3's mosaic: 9 / 7 / 5 / 3 of 24 cells, the 340 / 260 / 180 / 120 split scaled to 24.
MOSAIC = "RSRDRSORDSRRSDSORRDSRSDO"


def fig_donde(es, closing):
    L = DONDE[es]
    PW, G = 177, 14.3
    CW, CH, CG = 20, 14, 7  # doc cells: 6 x 4
    b = []
    y_ill = 22
    for k in range(4):
        x0 = k * (PW + G)
        b.append(text(x0, 12, L["heads"][k], "hd"))
        b.append(box(x0, y_ill, PW, 96, "g"))
        gx, gy = x0 + (PW - (6 * CW + 5 * CG)) / 2, y_ill + (96 - (4 * CH + 3 * CG)) / 2
        cell = lambda i, j: (gx + j * (CW + CG), gy + i * (CH + CG))
        if k < 3:
            for i in range(4):
                for j in range(6):
                    x, y = cell(i, j)
                    if k == 2:
                        c = {"R": C_RECT, "S": C_SUBIDA, "D": C_DUP, "O": C_OTROS}[MOSAIC[i * 6 + j]]
                        b.append('<rect x="%.1f" y="%.1f" width="%d" height="%d" rx="2" fill="%s"/>' % (x, y, CW, CH, c))
                    else:
                        b.append('<rect x="%.1f" y="%.1f" width="%d" height="%d" rx="2" fill="none" stroke="%s"/>'
                                 % (x, y, CW, CH, LINE))
            if k == 0:
                x, y = cell(1, 3)
                b.append('<rect x="%.1f" y="%.1f" width="%d" height="%d" rx="2" fill="rgba(78,222,163,0.35)" stroke="%s"/>'
                         % (x, y, CW, CH, ACC))
            if k == 1:
                chain = [(0, 1), (2, 2), (1, 4)]
                d = " L".join("%.1f,%.1f" % (cell(i, j)[0] + CW / 2, cell(i, j)[1] + CH / 2) for i, j in chain)
                b.append('<path d="M%s" fill="none" stroke="%s" stroke-width="1.4"/>' % (d, ACC))
                for i, j in chain:
                    x, y = cell(i, j)
                    b.append('<rect x="%.1f" y="%.1f" width="%d" height="%d" rx="2" fill="#1b2a24" stroke="%s"/>'
                             % (x, y, CW, CH, ACC))
        else:
            # a small declared graph: customers linked to the plan and to the bug; the ones linked to
            # both are the ones the query counts
            px, py = x0 + 32, y_ill + 36
            qx, qy = x0 + PW - 32, y_ill + 36
            mid = x0 + PW / 2
            both = [(mid - 30, y_ill + 72), (mid, y_ill + 72), (mid + 30, y_ill + 72)]
            only = [(px, y_ill + 80, px, py), (qx, y_ill + 80, qx, qy)]
            for cx, cy in both:
                for nx, ny in ((px, py), (qx, qy)):
                    b.append('<line class="ed m" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (nx, ny, cx, cy))
            for cx, cy, nx, ny in only:
                b.append('<line class="ed" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (nx, ny, cx, cy))
            for cx, cy in both:
                b.append('<circle cx="%.1f" cy="%.1f" r="5" fill="#1b2a24" stroke="%s"/>' % (cx, cy, ACC))
            for cx, cy, _, _ in only:
                b.append('<circle cx="%.1f" cy="%.1f" r="5" fill="%s" stroke="%s"/>' % (cx, cy, SURF, MUTED))
            for nx, ny in ((px, py), (qx, qy)):
                b.append('<circle cx="%.1f" cy="%.1f" r="7" fill="%s" stroke="%s"/>' % (nx, ny, SURF, TXT))
            b.append(text(x0 + 10, y_ill + 18, L["plan"], "sb", "start"))
            b.append(text(x0 + PW - 10, y_ill + 18, L["bug"], "sb", "end"))
        yq = y_ill + 96 + 18
        b.append(lines(x0 + 2, yq, L["qs"][k], "tx", 14))
        b.append(text(x0 + 2, yq + 14 * 3 + 6, L["where"][k], "tx d"))
    h = y_ill + 96 + 18 + 14 * 3 + 12
    aria = L["aria"]
    if closing:
        yt = h + 10
        for k in range(4):
            x0 = k * (PW + G)
            b.append(arrow([(x0 + PW / 2, yt - 6), (x0 + PW / 2, yt + 8)], "ar m"))
            b.append(labelled(x0, yt + 10, PW, 44, *L["tools"][k], cls="m" if k else ""))
        h = yt + 56
        aria += L["aria_tools"]
    return svg(750, h, aria, b)


# ─── 2. muestra-y-conjunto ───────────────────────────────────────────────────────────────────

CAUSES = [C_RECT, C_SUBIDA, C_DUP, C_OTROS]
ROWS = [(340, 260, 180, 120), (18, 112, 164, 16), (1, 7, 11, 1)]


def fig_muestra(es):
    L = {
        True: dict(legend=["rectificativas en PDF, versión 3.2", "subida del plan Básico",
                           "cobros duplicados", "otros"],
                   rows=[("Las 900 del trimestre", "lo que hay"),
                         ("Las 310 que dicen «reembolso»", "lo que se parece a la pregunta"),
                         ("Las 20 que leyó el asistente", "con lo que respondió")],
                   aria="Tres barras apiladas con las incidencias del trimestre en las que un cliente pide "
                        "dinero o la baja, por causa. Las 900 del trimestre: 340 por las rectificativas en PDF "
                        "de la versión 3.2, 260 por la subida del plan Básico, 180 por cobros duplicados y 120 "
                        "por otros motivos. Las 310 que contienen la palabra reembolso: 18, 112, 164 y 16. Las "
                        "20 que leyó el asistente: 1, 7, 11 y 1. La causa más frecuente del trimestre casi no "
                        "aparece en lo que leyó."),
        False: dict(legend=["credit notes to PDF, version 3.2", "Basic plan price rise",
                            "double charges", "other"],
                    rows=[("All 900 this quarter", "what there is"),
                          ("The 310 that say “refund”", "what looks like the question"),
                          ("The 20 the assistant read", "what it answered with")],
                    aria="Three stacked bars with the quarter's tickets in which a customer asks for money back "
                         "or to cancel, by cause. All 900 this quarter: 340 about credit notes to PDF in version "
                         "3.2, 260 about the Basic plan price rise, 180 about double charges and 120 about other "
                         "things. The 310 that contain the word refund: 18, 112, 164 and 16. The 20 the "
                         "assistant read: 1, 7, 11 and 1. The quarter's most common cause barely appears in what "
                         "it read."),
    }[es]
    b = []
    # legend: swatch + text-token label, one row
    lx = 0
    for c, lab in zip(CAUSES, L["legend"]):
        b.append('<rect x="%.1f" y="4" width="10" height="10" rx="2" fill="%s"/>' % (lx, c))
        b.append(text(lx + 15, 13, lab, "tx"))
        lx += 15 + len(lab) * 5.7 + 22
    X0, BW, BH, PITCH, y0 = 232, 516, 22, 50, 40
    for r, (counts, (title, sub)) in enumerate(zip(ROWS, L["rows"])):
        y = y0 + r * PITCH
        b.append(text(0, y + 9, title, "lb", "start"))
        b.append(text(0, y + 24, sub, "sb", "start"))
        total = float(sum(counts))
        x = X0
        for i, (n, c) in enumerate(zip(counts, CAUSES)):
            w = BW * n / total
            last = i == len(counts) - 1
            seg_w = w - (0 if last else 2)  # 2 px surface gap between segments
            b.append(hbar(x, y, seg_w, BH, c, round_end=last))
            if seg_w >= 12 + 6.2 * len(str(n)):
                b.append(text(x + seg_w / 2, y + 15, str(n), "in"))
            x += w
    h =y0 + 2 * PITCH + BH + 4
    return svg(750, h, L["aria"], b)


# ─── 3. texto-a-grafo ────────────────────────────────────────────────────────────────────────

def fig_texto_grafo(es):
    L = {
        True: dict(
            hd="INCIDENCIA 5120 · 25 DE SEPTIEMBRE",
            txt=[[("Ferretería Ortega S.L.", "m"), (" (", ""), ("plan Equipo", "m"),
                  ("). Desde la actualización a la ", ""), ("3.2", "m"), (", las facturas ", ""),
                  ("rectificativas", "m")],
                 [("salen en PDF con el total del IVA mal. Si no se arregla antes del cierre del trimestre, se ", ""),
                  ("darán de baja", "m"), (".", "")]],
            llm="un modelo de lenguaje la lee y extrae",
            h1="TRIPLETAS", h2="EL GRAFO, JUNTO A LO QUE YA HABÍA",
            triples=["(incidencia 5120, abierta por, Ferretería Ortega S.L.)",
                     "(Ferretería Ortega S.L., tiene, plan Equipo)",
                     "(incidencia 5120, afecta a, versión 3.2)",
                     "(versión 3.2, rompe, rectificativas en PDF)",
                     "(Ferretería Ortega S.L., amenaza con, la baja)"],
            n4812="incidencia 4812", nfo="Ferretería Ortega", nfosl="Ferretería Ortega S.L.",
            n5120="incidencia 5120", npe="plan Equipo", n32="versión 3.2",
            same="¿el mismo cliente?", old="ya estaba", new="nuevo",
            aria="Arriba, el texto de la incidencia 5120, del 25 de septiembre: Ferretería Ortega S.L., plan "
                 "Equipo; desde la actualización a la 3.2, las facturas rectificativas salen en PDF con el total "
                 "del IVA mal; si no se arregla antes del cierre del trimestre, se darán de baja. Un modelo de "
                 "lenguaje la lee y extrae cinco tripletas: la incidencia 5120 abierta por Ferretería Ortega S.L.; "
                 "Ferretería Ortega S.L. tiene el plan Equipo; la incidencia 5120 afecta a la versión 3.2; la "
                 "versión 3.2 rompe las rectificativas en PDF; Ferretería Ortega S.L. amenaza con la baja. A la "
                 "derecha, el grafo: la incidencia 4812, que ya estaba, cuelga de un nodo Ferretería Ortega, y la "
                 "5120 de otro nodo, Ferretería Ortega S.L. Los dos llegan al plan Equipo, y entre ellos hay una "
                 "línea discontinua con la pregunta: ¿el mismo cliente?"),
        False: dict(
            hd="TICKET 5120 · 25 SEPTEMBER",
            txt=[[("Ortega Hardware Ltd.", "m"), (" (", ""), ("Team plan", "m"),
                  ("). Since the upgrade to ", ""), ("3.2", "m"), (", their ", ""),
                  ("credit notes", "m"), (" export to PDF", "")],
                 [("with the wrong VAT total. If it is not fixed before the quarter closes, they will ", ""),
                  ("cancel", "m"), (".", "")]],
            llm="a language model reads it and extracts",
            h1="TRIPLES", h2="THE GRAPH, NEXT TO WHAT WAS THERE",
            triples=["(ticket 5120, opened by, Ortega Hardware Ltd.)",
                     "(Ortega Hardware Ltd., has, Team plan)",
                     "(ticket 5120, affects, version 3.2)",
                     "(version 3.2, breaks, credit notes to PDF)",
                     "(Ortega Hardware Ltd., threatens, to cancel)"],
            n4812="ticket 4812", nfo="Ortega Hardware", nfosl="Ortega Hardware Ltd.",
            n5120="ticket 5120", npe="Team plan", n32="version 3.2",
            same="the same customer?", old="already there", new="new",
            aria="Top, the text of ticket 5120, from 25 September: Ortega Hardware Ltd., Team plan; since the "
                 "upgrade to 3.2, their credit notes export to PDF with the wrong VAT total; if it is not fixed "
                 "before the quarter closes, they will cancel. A language model reads it and extracts five "
                 "triples: ticket 5120 opened by Ortega Hardware Ltd.; Ortega Hardware Ltd. has the Team plan; "
                 "ticket 5120 affects version 3.2; version 3.2 breaks credit notes to PDF; Ortega Hardware Ltd. "
                 "threatens to cancel. On the right, the graph: ticket 4812, already there, hangs from a node "
                 "called Ortega Hardware, and 5120 from another node, Ortega Hardware Ltd. Both reach the Team "
                 "plan, and between them a dashed line asks: the same customer?"),
    }[es]
    b = [box(0, 0, 750, 64, "g"), text(12, 16, L["hd"], "hd"), lines(12, 35, L["txt"], "tx", 16)]
    b.append(arrow([(180, 66), (180, 92)]))
    b.append(text(190, 83, L["llm"], "sb", "start"))
    y1 = 110
    b.append(text(0, y1, L["h1"], "hd"))
    b.append(lines(0, y1 + 22, L["triples"], "mo", 20))
    # graph, right half
    gx = 400
    b.append(text(gx, y1, L["h2"], "hd"))

    def node(x, y, w, label, cls=""):
        tc = {"m": "tx m", "": "tx", "g": "tx d"}[cls]
        return box(x, y, w, 26, cls, 5) + "\n" + text(x + w / 2, y + 17, label, tc, "middle")

    A, B, C = gx, gx + 112, gx + 272
    r1, r2, r3 = y1 + 16, y1 + 76, y1 + 136
    wA, wB, wC = 100, 142, 76
    # edges first
    b.append('<line class="ed" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (A + wA, r1 + 13, B, r1 + 13))
    b.append('<line class="ed m" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (A + wA, r2 + 13, B, r2 + 13))
    pe_y = (r1 + r2) / 2
    b.append('<line class="ed" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (B + wB, r1 + 13, C, pe_y + 13))
    b.append('<line class="ed m" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (B + wB, r2 + 13, C, pe_y + 13))
    b.append('<line class="ed m" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (A + wA / 2, r2 + 26, A + wA / 2, r3))
    b.append('<line class="ed x" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (B + 14, r1 + 26, B + 14, r2))
    b.append(text(B + 22, (r1 + r2) / 2 + 17, L["same"], "tx x", "start"))
    b.append(node(A, r1, wA, L["n4812"], "g"))
    b.append(node(B, r1, wB, L["nfo"], "g"))
    b.append(node(A, r2, wA, L["n5120"], "m"))
    b.append(node(B, r2, wB, L["nfosl"], "m"))
    b.append(node(C, pe_y, wC, L["npe"], ""))
    b.append(node(A, r3, wA, L["n32"], "m"))
    # key, under the triples
    ky = y1 + 22 + 5 * 20 + 18
    b.append(box(0, ky - 9, 10, 10, "g", 2)); b.append(text(15, ky, L["old"], "tx d", "start"))
    b.append(box(110, ky - 9, 10, 10, "m", 2)); b.append(text(125, ky, L["new"], "tx d", "start"))
    return svg(750, max(ky, r3 + 26) + 4, L["aria"], b)


# ─── 4. pipeline-mapa ────────────────────────────────────────────────────────────────────────

MAPA = {
    True: dict(
        h1="INDEXAR · UNA VEZ, LEYENDO TODO EL CORPUS", h2="PREGUNTAR · BÚSQUEDA GLOBAL",
        top=[("Documentos", "incidencias, wiki"), ("Trocear", "en fragmentos"),
             ("Extraer", "entidades, relaciones"), ("Grafo", "fusiona duplicados"),
             ("Comunidades", "Leiden, por niveles"), ("Resumir", "una por comunidad")],
        q=("Pregunta", "global"), mp=("Map", "responde y puntúa"), rd=("Reduce", "junta las mejores"),
        same="la misma pregunta, a cada lote de resúmenes", note="sin buscar: lee todos los de un nivel",
        out="respuesta", key="llama al modelo de lenguaje",
        aria="Diagrama de GraphRAG en dos carriles. Arriba, indexar, una vez y leyendo todo el corpus: "
             "documentos, trocear en fragmentos, extraer entidades y relaciones con el modelo de lenguaje, "
             "construir el grafo fusionando duplicados, detectar comunidades con Leiden por niveles y resumir "
             "cada comunidad con el modelo. Abajo, preguntar con la búsqueda global: la misma pregunta va a "
             "cada lote de resúmenes, sin buscar, leyendo todos los de un nivel; en el paso map el modelo "
             "responde y puntúa cada lote; en el paso reduce junta las respuestas mejor puntuadas en la "
             "respuesta final. Los pasos que llaman al modelo están marcados: extraer, resumir, map y reduce."),
    False: dict(
        h1="INDEX · ONCE, READING THE WHOLE CORPUS", h2="ASK · GLOBAL SEARCH",
        top=[("Documents", "tickets, wiki"), ("Chunk", "into fragments"),
             ("Extract", "entities, relations"), ("Graph", "merges duplicates"),
             ("Communities", "Leiden, by level"), ("Summarise", "one per community")],
        q=("Question", "global"), mp=("Map", "answers and scores"), rd=("Reduce", "joins the best"),
        same="the same question, to every batch of summaries", note="no search: reads all of one level",
        out="answer", key="calls the language model",
        aria="Diagram of GraphRAG in two lanes. Top, indexing, once and reading the whole corpus: documents, "
             "chunk into fragments, extract entities and relations with the language model, build the graph "
             "merging duplicates, detect communities with Leiden by level and summarise each community with "
             "the model. Bottom, asking with global search: the same question goes to every batch of "
             "summaries, with no search, reading all of one level; in the map step the model answers and "
             "scores each batch; in the reduce step it joins the best-scored answers into the final answer. "
             "The steps that call the model are marked: extract, summarise, map and reduce."),
}

SW, SH, STEP = 118, 46, 128
Y1, Y2 = 26, 150


def fig_pipeline_mapa(es):
    P = MAPA[es]
    X = [i * STEP for i in range(6)]
    b = [text(0, 14, P["h1"], "hd"), text(0, Y2 - 30, P["h2"], "hd")]
    kw = len(P["key"]) * 5.9  # rough text width, to right-align the key without clipping it
    b.append(box(758 - kw - 18, 4, 12, 12, "w", 3)); b.append(text(758, 14, P["key"], "tx d", "end"))
    llm_top = {2, 5}
    for i, (t, s) in enumerate(P["top"]):
        b.append(labelled(X[i], Y1, SW, SH, t, s, "w" if i in llm_top else ""))
        if i:
            b.append(arrow([(X[i - 1] + SW, Y1 + SH / 2), (X[i] - 2, Y1 + SH / 2)]))
    b.append(labelled(X[0], Y2, SW, SH, *P["q"]))
    b.append(labelled(X[4], Y2, SW, SH, *P["mp"], cls="w"))
    b.append(labelled(X[5], Y2, SW, SH, *P["rd"], cls="w"))
    b.append(arrow([(X[0] + SW, Y2 + SH / 2), (X[4] - 2, Y2 + SH / 2)]))
    b.append(text((X[0] + SW + X[4]) / 2, Y2 + SH / 2 - 6, P["same"], "sb"))
    b.append(text((X[0] + SW + X[4]) / 2, Y2 + SH / 2 + 16, P["note"], "sb"))
    b.append(arrow([(X[4] + SW, Y2 + SH / 2), (X[5] - 2, Y2 + SH / 2)]))
    # summaries feed the map step: orthogonal elbow through the gap between the lanes
    ym = (Y1 + SH + Y2) / 2 + 4
    b.append(arrow([(X[5] + SW / 2, Y1 + SH), (X[5] + SW / 2, ym), (X[4] + SW / 2, ym), (X[4] + SW / 2, Y2 - 2)]))
    yb = Y2 + SH
    b.append(arrow([(X[5] + SW / 2, yb), (X[5] + SW / 2, yb + 18)]))
    b.append(text(X[5] + SW / 2, yb + 32, P["out"], "sb"))
    return svg(758, yb + 38, P["aria"], b)


# ─── 5. ppr-4812 ─────────────────────────────────────────────────────────────────────────────
# The toy index. Each passage lists the triples an OpenIE pass would pull out of it; phrase nodes
# are the triples' ends, edges are the triples (undirected, weight = how many passages state it),
# plus one synonymy edge between the two spellings of the same customer, which is what HippoRAG's
# retrieval encoder adds when two phrases' embeddings are similar enough.

PASSAGES = [
    ("P1", [("4812", "FO"), ("FO", "PE"), ("4812", "REE"), ("FO", "ANUAL")]),
    ("P2", [("REE", "14")]),
    ("P3", [("PE", "30"), ("PE", "REE"), ("30", "ANUAL")]),
    ("P4", [("4821", "PB"), ("4821", "REE")]),
    ("P5", [("4182", "PB"), ("4182", "REE")]),
    ("P6", [("5120", "FOSL"), ("5120", "V32"), ("V32", "RECT")]),
    ("P7", [("PB", "14"), ("PB", "REE")]),
    ("P8", [("V32", "RECT")]),
    ("P9", [("PE", "USU")]),
]
SYNONYMS = [("FO", "FOSL")]
SEEDS = ["4812", "REE"]  # the query's named entities: «4812» and «reembolso»
RESTART = 0.5            # HippoRAG §3.4: probability of restarting at the query nodes


def ppr():
    w = defaultdict(float)
    where = defaultdict(set)
    for pid, triples in PASSAGES:
        for a, c in triples:
            w[(a, c)] += 1; w[(c, a)] += 1
            where[a].add(pid); where[c].add(pid)
    for a, c in SYNONYMS:
        w[(a, c)] += 1; w[(c, a)] += 1
    nodes = sorted(where)
    out = defaultdict(float)
    for (a, _), x in w.items():
        out[a] += x
    # node specificity: each seed weighted by 1 / (passages it appears in), then normalised
    spec = {s: 1.0 / len(where[s]) for s in SEEDS}
    z = sum(spec.values())
    r = {n: spec.get(n, 0.0) / z for n in nodes}
    p = dict(r)
    for _ in range(500):
        q = {n: RESTART * r[n] for n in nodes}
        for (a, c), x in w.items():
            q[c] += (1 - RESTART) * p[a] * x / out[a]
        p = q
    score = {pid: sum(p[n] for n in {v for t in triples for v in t}) for pid, triples in PASSAGES}
    ranking = sorted(score, key=lambda k: -score[k])
    return p, score, ranking


NODE_LABEL = {
    True: {"4812": "4812", "FO": "Ferretería Ortega", "PE": "plan Equipo", "REE": "reembolso",
           "ANUAL": "cobro anual", "14": "14 días", "30": "30 días", "4821": "4821", "PB": "plan Básico",
           "4182": "4182", "5120": "5120", "FOSL": "Ferretería Ortega S.L.", "V32": "versión 3.2",
           "RECT": "rectificativas", "USU": "usuarios"},
    False: {"4812": "4812", "FO": "Ortega Hardware", "PE": "Team plan", "REE": "refund",
            "ANUAL": "annual charge", "14": "14 days", "30": "30 days", "4821": "4821", "PB": "Basic plan",
            "4182": "4182", "5120": "5120", "FOSL": "Ortega Hardware Ltd.", "V32": "version 3.2",
            "RECT": "credit notes", "USU": "users"},
}
PASSAGE_LABEL = {
    True: {"P1": "Incidencia 4812", "P2": "FAQ de reembolsos", "P3": "Condiciones del plan Equipo, §7",
           "P4": "Incidencia 4821", "P5": "Incidencia 4182", "P6": "Incidencia 5120",
           "P7": "Condiciones del plan Básico", "P8": "Notas de la versión 3.2",
           "P9": "Alta de usuarios, plan Equipo"},
    False: {"P1": "Ticket 4812", "P2": "Refunds FAQ", "P3": "Team plan terms, §7",
            "P4": "Ticket 4821", "P5": "Ticket 4182", "P6": "Ticket 5120",
            "P7": "Basic plan terms", "P8": "Version 3.2 release notes",
            "P9": "Adding users, Team plan"},
}
# hand-placed so no edge crosses a label (labels also carry a surface-colored halo, for the near misses)
POS = {"FOSL": (75, 62), "FO": (240, 62), "ANUAL": (400, 62),
       "5120": (75, 140), "4812": (205, 140), "PE": (320, 140), "30": (430, 112),
       "V32": (75, 205), "REE": (225, 225), "USU": (420, 206),
       "RECT": (75, 292), "14": (140, 296), "PB": (280, 296), "4821": (340, 244), "4182": (425, 292)}
LABEL_SIDE = {"FOSL": "above", "FO": "above", "ANUAL": "above", "5120": "right", "4812": "left",
              "PE": "right", "30": "right", "V32": "right", "REE": "left", "USU": "below",
              "RECT": "below", "14": "below", "PB": "below", "4821": "right", "4182": "below"}


def fig_ppr(es):
    p, score, ranking = ppr()
    NL, PL = NODE_LABEL[es], PASSAGE_LABEL[es]
    pmax = max(p.values())
    rad = {n: 4 + 24 * (p[n] / pmax) ** 0.5 for n in p}
    b = [text(0, 12, "PAGERANK PERSONALIZADO DESDE «4812» Y «REEMBOLSO»" if es else
              "PERSONALIZED PAGERANK FROM “4812” AND “REFUND”", "hd"),
         text(490, 12, "PASAJES, POR PUNTUACIÓN" if es else "PASSAGES, BY SCORE", "hd")]
    seen = set()
    for pid, triples in PASSAGES:
        for a, c in triples:
            if (a, c) in seen or (c, a) in seen:
                continue
            seen.add((a, c))
            (x1, y1), (x2, y2) = POS[a], POS[c]
            b.append('<line class="ed" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (x1, y1, x2, y2))
    for a, c in SYNONYMS:
        (x1, y1), (x2, y2) = POS[a], POS[c]
        b.append('<line class="ed x" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (x1, y1, x2, y2))
    for n, (x, y) in POS.items():
        op = 0.12 + 0.6 * (p[n] / pmax) ** 0.5
        seed = n in SEEDS
        b.append('<circle cx="%.1f" cy="%.1f" r="%.1f" fill="%s" stroke="%s" stroke-width="%s"/>'
                 % (x, y, rad[n], mix(ACC, SURF, op), ACC if seed else MUTED, "2" if seed else "0.8"))
        lab, cls, side = NL[n], "tx hl m" if seed else "tx hl", LABEL_SIDE[n]
        if side == "right":
            b.append(text(x + rad[n] + 6, y + 4, lab, cls, "start"))
        elif side == "left":
            b.append(text(x - rad[n] - 6, y + 4, lab, cls, "end"))
        elif side == "above":
            b.append(text(x, y - rad[n] - 6, lab, cls, "middle"))
        else:
            b.append(text(x, y + rad[n] + 13, lab, cls, "middle"))
    # ranking, right
    X0, BW, PITCH, y0 = 490, 150, 30, 30
    smax = score[ranking[0]]
    need = {"P1", "P3"}
    for i, pid in enumerate(ranking):
        y = y0 + i * PITCH
        hit = pid in need
        b.append(text(X0, y + 10, "%d  %s" % (i + 1, PL[pid]), "tx" if hit else "tx d", "start"))
        w = BW * score[pid] / smax
        b.append(hbar(X0 + 14, y + 15, w, 7, C_RECT if hit else "#4a4b50"))
        val = ("%.2f" % score[pid])
        b.append(text(X0 + 14 + w + 6, y + 22, val.replace(".", ",") if es else val, "tx d", "start"))
    h = max(y0 + len(ranking) * PITCH, 332)
    aria = (("Grafo de juguete con quince frases del índice de Albarán, unidas por las relaciones que un modelo "
             "extrajo de nueve pasajes. El PageRank personalizado arranca en las dos frases de la pregunta, "
             "4812 y reembolso, y el tamaño de cada nodo es la probabilidad que acaba teniendo: 4812, reembolso "
             "y Ferretería Ortega son los más grandes, y plan Equipo recibe probabilidad a través de Ferretería "
             "Ortega. Una línea discontinua une Ferretería Ortega y Ferretería Ortega S.L. como sinónimos. A la "
             "derecha, los pasajes ordenados por la suma de la probabilidad de sus frases: ")
            if es else
            ("A toy graph with fifteen phrases from Albarán's index, joined by the relations a model extracted "
             "from nine passages. Personalized PageRank starts at the question's two phrases, 4812 and refund, "
             "and each node's size is the probability it ends with: 4812, refund and Ortega Hardware are the "
             "largest, and the Team plan receives probability through Ortega Hardware. A dashed line joins "
             "Ortega Hardware and Ortega Hardware Ltd. as synonyms. On the right, the passages ranked by the "
             "summed probability of their phrases: "))
    aria += ", ".join("%s %s" % (PL[pid], ("%.2f" % score[pid]).replace(".", ",") if es else "%.2f" % score[pid])
                      for pid in ranking) + "."
    return svg(750, h, aria, b)


# ─── 6. coste-por-pregunta ───────────────────────────────────────────────────────────────────
# GraphRAG-Bench (arXiv:2506.05690v3), tables 6 and 7, "Novel" row: average tokens per question.

COST = [("RAG", 879), ("HIPPO2", 1008), ("RAPTOR", 3441), ("FAST", 4204), ("HIPPO", 7208),
        ("LOCAL", 38707), ("LIGHT", 100832), ("GLOBAL", 331375)]
COST_LABEL = {
    True: {"RAG": "RAG normal", "HIPPO2": "HippoRAG 2", "RAPTOR": "RAPTOR", "FAST": "Fast-GraphRAG",
           "HIPPO": "HippoRAG", "LOCAL": "GraphRAG, búsqueda local", "LIGHT": "LightRAG",
           "GLOBAL": "GraphRAG, búsqueda global"},
    False: {"RAG": "Plain RAG", "HIPPO2": "HippoRAG 2", "RAPTOR": "RAPTOR", "FAST": "Fast-GraphRAG",
            "HIPPO": "HippoRAG", "LOCAL": "GraphRAG, local search", "LIGHT": "LightRAG",
            "GLOBAL": "GraphRAG, global search"},
}


def fig_coste(es):
    NL = COST_LABEL[es]
    X0, BW, BH, PITCH, y0 = 176, 470, 14, 26, 8
    vmax = 350000
    b = []
    n = len(COST)
    yaxis = y0 + n * PITCH
    for t in (0, 100000, 200000, 300000):
        x = X0 + BW * t / vmax
        b.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="1"/>' % (x, y0 - 4, x, yaxis, GRID))
        b.append(text(x, yaxis + 16, num(t, es), "sb"))
    for i, (k, v) in enumerate(COST):
        y = y0 + i * PITCH
        b.append(text(X0 - 10, y + 11, NL[k], "tx", "end"))
        w = BW * v / vmax
        b.append(hbar(X0, y, w, BH, C_RECT))
        b.append(text(X0 + w + 6, y + 11, num(v, es), "tx d", "start"))
    b.append(text(X0 + BW, yaxis + 32, "tokens por pregunta, de media" if es else "tokens per question, on average", "sb", "end"))
    aria = ("Barras horizontales con los tokens que gasta cada método por pregunta, de media, en el conjunto de "
            "novelas de GraphRAG-Bench: " if es else
            "Horizontal bars with the tokens each method spends per question, on average, on GraphRAG-Bench's "
            "novel dataset: ")
    aria += ", ".join("%s %s" % (NL[k], num(v, es)) for k, v in COST) + "."
    return svg(750, yaxis + 38, aria, b)


if __name__ == "__main__":
    write("donde-vive-la-respuesta", fig_donde(True, False), fig_donde(False, False))
    write("tres-grafos", fig_donde(True, True), fig_donde(False, True))
    write("muestra-y-conjunto", fig_muestra(True), fig_muestra(False))
    write("texto-a-grafo", fig_texto_grafo(True), fig_texto_grafo(False))
    write("pipeline-mapa", fig_pipeline_mapa(True), fig_pipeline_mapa(False))
    write("ppr-4812", fig_ppr(True), fig_ppr(False))
    write("coste-por-pregunta", fig_coste(True), fig_coste(False))
    p, score, ranking = ppr()
    print("ppr ranking:", [(pid, round(score[pid], 4)) for pid in ranking])
    print("node p:", sorted(((n, round(v, 4)) for n, v in p.items()), key=lambda t: -t[1]))
