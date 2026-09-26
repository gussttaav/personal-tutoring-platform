"""BLOG-07 — Figures for the blog post `de-rag-a-rag-agentico`. Diagrams, not data: the one
computed thing is the RRF fusion in `dos-busquedas`, whose order is derived here from the two
input rankings with c = 60, exactly as the article states the formula.
Run from this directory: python3 make_svgs.py ../../../public/blog/de-rag-a-rag-agentico
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

Every pipeline figure is the SAME drawing (`pipeline()`), so the article can show one picture
evolving: `pipeline-base` -> `pipeline-fallos` (failure markers) -> `pipeline-reescritura`
(the empty slot in the query lane gets the model's first decision)."""
import sys, os

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; LINE = "#3b3b3e"
WARN = "#e8a24c"; BAD = "#ffb4ab"
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
  .m {{ fill: {ACC}; }}
  .w {{ fill: {WARN}; }}
  .x {{ fill: {BAD}; }}
  .ar {{ fill: none; stroke: {MUTED}; stroke-width: 1.2; marker-end: url(#a); }}
  .ar.m {{ stroke: {ACC}; marker-end: url(#am); }}
  .ar.x {{ stroke: {BAD}; stroke-dasharray: 3 3; marker-end: url(#ax); }}
  .nb {{ fill: #1d1d1f; stroke: {BAD}; stroke-width: 1.2; }}
  .nt {{ font-size: 10.5px; font-weight: 700; fill: {BAD}; text-anchor: middle; }}
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


def box(x, y, w, h, cls=""):
    return '<rect class="bx %s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="6"/>' % (cls, x, y, w, h)


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
    tcls = "lb m" if cls == "m" else "lb"
    if sub:
        out.append(text(x + w / 2, y + h / 2 - 2, title, tcls))
        out.append(text(x + w / 2, y + h / 2 + 12, sub, "sb"))
    else:
        out.append(text(x + w / 2, y + h / 2 + 4, title, tcls))
    return "\n".join(out)


def arrow(pts, cls="ar"):
    d = "M" + " L".join("%.1f,%.1f" % p for p in pts)
    return '<path class="%s" d="%s"/>' % (cls, d)


def write(name, es_svg, en_svg):
    for suffix, content in ((".svg", es_svg), (".en.svg", en_svg)):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(content)


# ─── 1. quien-decide ─────────────────────────────────────────────────────────────────────────

def fig_quien_decide(es):
    L = {
        True: dict(
            cols=["RAG INGENUO", "RAG AVANZADO", "RAG AGÉNTICO"],
            rows=["¿Busca?", "¿Qué busca?", "¿Dónde busca?", "¿Cuándo para?"],
            cells=[["siempre", "siempre", ("si le hace falta", 1)],
                   ["la pregunta, tal cual", ("una reescritura", 1), ("lo que le falta", 1)],
                   ["en un índice", "en un índice", ("elige la fuente", 1)],
                   ["tras una búsqueda", "tras una búsqueda", ("cuando tiene la respuesta", 1)]],
            code="lo fija el código", model="lo decide el modelo",
            aria="Tabla de cuatro filas y tres columnas. Las filas son las cuatro decisiones de una "
                 "búsqueda: si busca, qué busca, dónde busca y cuándo para. En el RAG ingenuo las cuatro "
                 "las fija el código: busca siempre, la pregunta tal cual, en un índice y tras una búsqueda. "
                 "En el RAG avanzado el modelo decide una, qué busca, porque reescribe la consulta. En el "
                 "RAG agéntico el modelo decide las cuatro: busca si le hace falta, busca lo que le falta, "
                 "elige la fuente y para cuando tiene la respuesta."),
        False: dict(
            cols=["NAIVE RAG", "ADVANCED RAG", "AGENTIC RAG"],
            rows=["Search?", "Search for what?", "Search where?", "Stop when?"],
            cells=[["always", "always", ("when it needs to", 1)],
                   ["the question, verbatim", ("a rewrite", 1), ("what is missing", 1)],
                   ["one index", "one index", ("picks the source", 1)],
                   ["after one search", "after one search", ("once it has the answer", 1)]],
            code="fixed by the code", model="decided by the model",
            aria="A table with four rows and three columns. The rows are the four decisions behind a "
                 "search: whether to search, what to search for, where, and when to stop. In naive RAG "
                 "the code fixes all four: always search, the question verbatim, one index, stop after one "
                 "search. In advanced RAG the model makes one, what to search for, because it rewrites the "
                 "query. In agentic RAG the model makes all four: it searches when it needs to, searches "
                 "for what is missing, picks the source and stops once it has the answer."),
    }[es]
    x0, cw, gap, y0, rh, rg = 150, 190, 10, 58, 38, 8
    b = []
    # legend
    b.append(box(150, 4, 14, 14, "g").replace('rx="6"', 'rx="3"')); b.append(text(170, 15, L["code"], "tx d"))
    b.append(box(330, 4, 14, 14, "m").replace('rx="6"', 'rx="3"')); b.append(text(350, 15, L["model"], "tx d"))
    for j, c in enumerate(L["cols"]):
        b.append(text(x0 + j * (cw + gap) + cw / 2, 46, c, "hd", "middle"))
    for i, r in enumerate(L["rows"]):
        y = y0 + i * (rh + rg)
        b.append(text(0, y + rh / 2 + 4, r, "lb", "start"))
        for j, cell in enumerate(L["cells"][i]):
            x = x0 + j * (cw + gap)
            if isinstance(cell, tuple):
                b.append(box(x, y, cw, rh, "m")); b.append(text(x + cw / 2, y + rh / 2 + 4, cell[0], "tx m", "middle"))
            else:
                b.append(box(x, y, cw, rh, "g")); b.append(text(x + cw / 2, y + rh / 2 + 4, cell, "tx d", "middle"))
    return svg(740, y0 + 4 * (rh + rg) - rg + 2, L["aria"], b)


# ─── 2/3/5. the pipeline, three states ───────────────────────────────────────────────────────

PIPE = {
    True: dict(
        h1="INDEXAR · UNA VEZ, POR ADELANTADO", h2="PREGUNTAR · EN CADA CONSULTA",
        docs=("Documentos", "wiki, PDF, incidencias"), chunk=("Trocear", "en fragmentos"),
        emb=("Embeber", "un vector cada uno"), idx=("Índice", "vectores + texto"),
        q=("Pregunta", "tal cual llega"), emb2=("Embeber", "el mismo modelo"),
        search=("Buscar", "los k más cercanos"), prompt=("Prompt", "con los fragmentos"),
        model=("Modelo", "responde y cita"), rw=("Reescribir", "consulta autónoma"),
        bypass="la pregunta también va al prompt", out="respuesta",
        rwnote="ve la pregunta, nunca los resultados",
        fails=["1  la pregunta no se parece a su respuesta", "2  códigos, números y nombres",
               "3  el corte parte la respuesta", "4  el dato para buscar está en un resultado",
               "5  lo encuentra y no lo usa", "6  busca siempre, y siempre responde"],
    ),
    False: dict(
        h1="INDEX · ONCE, AHEAD OF TIME", h2="ASK · ON EVERY QUERY",
        docs=("Documents", "wiki, PDF, tickets"), chunk=("Chunk", "into fragments"),
        emb=("Embed", "one vector each"), idx=("Index", "vectors + text"),
        q=("Question", "as it arrives"), emb2=("Embed", "the same model"),
        search=("Search", "the k nearest"), prompt=("Prompt", "with the chunks"),
        model=("Model", "answers and cites"), rw=("Rewrite", "standalone query"),
        bypass="the question also goes into the prompt", out="answer",
        rwnote="sees the question, never the results",
        fails=["1  the question does not look like its answer", "2  codes, numbers and names",
               "3  the cut splits the answer", "4  the search term is inside a result",
               "5  found it, did not use it", "6  always searches, always answers"],
    ),
}

SW, SH, STEP = 118, 46, 128  # slot width/height and pitch; six slots across 758 px
Y1, Y2 = 26, 150


def pipeline(es, state):
    P = PIPE[es]
    X = [i * STEP for i in range(6)]
    b = [text(0, 14, P["h1"], "hd"), text(0, Y2 - 30, P["h2"], "hd")]
    # indexing lane
    for i, k in enumerate(("docs", "chunk", "emb", "idx")):
        b.append(labelled(X[i], Y1, SW, SH, *P[k]))
        if i:
            b.append(arrow([(X[i - 1] + SW, Y1 + SH / 2), (X[i] - 2, Y1 + SH / 2)]))
    # query lane
    b.append(labelled(X[0], Y2, SW, SH, *P["q"]))
    if state == "rw":
        b.append(labelled(X[1], Y2, SW, SH, *P["rw"], cls="m"))
        b.append(arrow([(X[0] + SW, Y2 + SH / 2), (X[1] - 2, Y2 + SH / 2)]))
        b.append(arrow([(X[1] + SW, Y2 + SH / 2), (X[2] - 2, Y2 + SH / 2)], "ar m"))
        b.append(text(X[1] + SW / 2, Y2 - 6, P["rwnote"], "sb m"))
    else:
        b.append(arrow([(X[0] + SW, Y2 + SH / 2), (X[2] - 2, Y2 + SH / 2)]))
    b.append(labelled(X[2], Y2, SW, SH, *P["emb2"]))
    b.append(labelled(X[3], Y2, SW, SH, *P["search"]))
    b.append(labelled(X[4], Y2, SW, SH, *P["prompt"]))
    b.append(labelled(X[5], Y2, SW, SH, *P["model"]))
    for i in (3, 4, 5):
        b.append(arrow([(X[i - 1] + SW, Y2 + SH / 2), (X[i] - 2, Y2 + SH / 2)]))
    # index feeds search
    b.append(arrow([(X[3] + SW / 2, Y1 + SH), (X[3] + SW / 2, Y2 - 2)]))
    # the question bypasses to the prompt
    yb = Y2 + SH + 22
    b.append('<path class="ar" d="M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f L%.1f,%.1f" stroke-dasharray="3 3"/>'
             % (X[0] + SW / 2, Y2 + SH, X[0] + SW / 2, yb, X[4] + SW / 2, yb, X[4] + SW / 2, Y2 + SH + 2))
    b.append(text((X[0] + X[4] + SW) / 2, yb - 5, P["bypass"], "sb"))
    # answer
    b.append(arrow([(X[5] + SW / 2, Y2 + SH), (X[5] + SW / 2, yb + 6)]))
    b.append(text(X[5] + SW / 2, yb + 20, P["out"], "sb"))
    h = yb + 28
    if state == "fails":
        # (marker number, x, y) at the top-right corner of the box where each failure happens
        spots = [(1, X[0] + SW, Y2), (2, X[3] + SW, Y2), (3, X[1] + SW, Y1),
                 (4, X[3] + SW - 24, Y2), (5, X[5] + SW, Y2), (6, X[0] + SW - 24, Y2)]
        for n, x, y in spots:
            b.append('<circle class="nb" cx="%.1f" cy="%.1f" r="8.5"/>' % (x - 12, y + 2))
            b.append(text(x - 12, y + 5.6, str(n), "nt"))
        ly = h + 10
        for i, f in enumerate(P["fails"]):
            col, row = i % 2, i // 2
            b.append(text(col * 380, ly + row * 17, f, "tx"))
        h = ly + 3 * 17 - 4
    return b, h


PIPE_ARIA = {
    ("base", True): "Diagrama del RAG ingenuo en dos carriles. Arriba, indexar, una vez y por adelantado: "
        "documentos, trocear en fragmentos, embeber cada fragmento en un vector y guardar vectores y texto en "
        "un índice. Abajo, preguntar, en cada consulta: la pregunta tal cual llega, embeberla con el mismo "
        "modelo, buscar en el índice los k fragmentos más cercanos, montar un prompt con la pregunta y los "
        "fragmentos, y el modelo responde y cita. Los dos pasos de embeber están en la misma columna.",
    ("base", False): "Diagram of naive RAG in two lanes. Top, indexing, once and ahead of time: documents, "
        "chunk into fragments, embed each fragment into a vector and store vectors and text in an index. "
        "Bottom, asking, on every query: the question as it arrives, embed it with the same model, search the "
        "index for the k nearest fragments, build a prompt with the question and the fragments, and the model "
        "answers and cites. The two embed steps sit in the same column.",
    ("fails", True): "El mismo diagrama del RAG ingenuo con seis marcas donde falla. 1, en la pregunta: la "
        "pregunta no se parece a su respuesta. 2, en buscar: códigos, números y nombres. 3, en trocear: el "
        "corte parte la respuesta. 4, también en buscar: el dato que hace falta para buscar está en un "
        "resultado. 5, en el modelo: lo encuentra y no lo usa. 6, al principio del carril de la pregunta: busca "
        "siempre, y siempre responde.",
    ("fails", False): "The same naive RAG diagram with six marks where it fails. 1, at the question: the "
        "question does not look like its answer. 2, at search: codes, numbers and names. 3, at chunking: the "
        "cut splits the answer. 4, also at search: the term needed to search is inside a result. 5, at the "
        "model: it finds the passage and does not use it. 6, at the start of the query lane: it always "
        "searches, and always answers.",
    ("rw", True): "El mismo diagrama del RAG ingenuo con una casilla nueva en el carril de la pregunta, entre "
        "la pregunta y embeber, marcada como decisión del modelo: reescribir, que produce una consulta "
        "autónoma. Una nota dice que ve la pregunta, nunca los resultados. El resto del pipeline no cambia.",
    ("rw", False): "The same naive RAG diagram with one new box in the query lane, between the question and "
        "embed, marked as the model's decision: rewrite, which produces a standalone query. A note says it "
        "sees the question, never the results. The rest of the pipeline is unchanged.",
}


# ─── 4. dos-busquedas ────────────────────────────────────────────────────────────────────────

C_RRF = 60
BM25 = ["4812", "4182", "faq", "4821"]
DENSE = ["faq", "4821", "4182", "4812"]
TOPK = 3


def rrf(lists, c=C_RRF):
    score = {}
    for lst in lists:
        for pos, d in enumerate(lst, 1):
            score[d] = score.get(d, 0.0) + 1.0 / (c + pos)
    return sorted(score, key=lambda d: -score[d])


def fig_dos_busquedas(es):
    D = {
        True: {"4812": ("Incidencia 4812", "Ferretería Ortega"), "4821": ("Incidencia 4821", "otro cliente"),
               "4182": ("Incidencia 4182", "otro cliente"), "faq": ("FAQ de reembolsos", "«por lo general, 14 días»")},
        False: {"4812": ("Ticket 4812", "Ortega Hardware"), "4821": ("Ticket 4821", "another customer"),
                "4182": ("Ticket 4182", "another customer"), "faq": ("Refunds FAQ", "“as a rule, 14 days”")},
    }[es]
    L = {
        True: dict(q="«¿El cliente de la incidencia 4812 tiene derecho a reembolso?»",
                   cols=["LÉXICA · BM25", "DENSA · EMBEDDINGS", "FUSIÓN · RRF, c = 60"],
                   cut="al prompt", pos="posiciones", miss="Condiciones del plan Equipo, §7: «30 días»",
                   miss2="no está en ninguna lista: la pregunta no dice «Equipo»",
                   aria="La pregunta «¿El cliente de la incidencia 4812 tiene derecho a reembolso?» buscada "
                        "de dos maneras. La búsqueda léxica, BM25, devuelve en orden la incidencia 4812, la "
                        "4182, las preguntas frecuentes de reembolsos y la 4821. La densa devuelve las "
                        "preguntas frecuentes, la 4821, la 4182 y la 4812 la cuarta. La fusión por rango "
                        "recíproco con c igual a 60 ordena: preguntas frecuentes, incidencia 4812, 4182 y "
                        "4821; las tres primeras pasan al prompt. Debajo, las condiciones del plan Equipo, que "
                        "dan 30 días, no aparecen en ninguna lista porque la pregunta no dice Equipo."),
        False: dict(q="“Is the customer on ticket 4812 entitled to a refund?”",
                    cols=["LEXICAL · BM25", "DENSE · EMBEDDINGS", "FUSION · RRF, c = 60"],
                    cut="to the prompt", pos="ranks", miss="Team plan terms, §7: “30 days”",
                    miss2="in neither list: the question never says “Team”",
                    aria="The question “Is the customer on ticket 4812 entitled to a refund?” searched two "
                         "ways. Lexical search, BM25, returns ticket 4812, ticket 4182, the refunds FAQ and "
                         "ticket 4821, in that order. Dense search returns the FAQ, 4821, 4182 and 4812 fourth. "
                         "Reciprocal rank fusion with c equal to 60 orders them: FAQ, ticket 4812, 4182 and "
                         "4821; the top three go to the prompt. Below, the Team plan terms, which give 30 days, "
                         "appear in neither list because the question never says Team."),
    }[es]
    fused = rrf([BM25, DENSE])
    CW, RH, G = 222, 38, 8
    xs = [0, 244, 488]
    b = [box(0, 0, 748, 30, "g"), text(374, 19.5, L["q"], "tx", "middle")]
    ytop = 62
    for j, col in enumerate(L["cols"]):
        b.append(text(xs[j], ytop - 10, col, "hd"))

    def row(x, y, d, extra=None):
        cls = "m" if d == "4812" else ("w" if d == "faq" else "g")
        t, s = D[d]
        out = [box(x + 22, y, CW - 22, RH, cls)]
        tc = "tx m" if cls == "m" else ("tx w" if cls == "w" else "tx")
        out.append(text(x + 32, y + 16, t, tc))
        out.append(text(x + 32, y + 30, s, "tx d"))
        if extra:
            out.append(text(x + CW - 8, y + 23, extra, "tx d", "end"))
        return "\n".join(out)

    for j, lst in enumerate((BM25, DENSE)):
        for i, d in enumerate(lst):
            y = ytop + i * (RH + G)
            b.append(text(xs[j] + 6, y + 23, str(i + 1), "lb", "start"))
            b.append(row(xs[j], y, d))
    for i, d in enumerate(fused):
        y = ytop + i * (RH + G)
        b.append(text(xs[2] + 6, y + 23, str(i + 1), "lb", "start"))
        ranks = "%d.º + %d.º" % (BM25.index(d) + 1, DENSE.index(d) + 1) if es else \
                "#%d + #%d" % (BM25.index(d) + 1, DENSE.index(d) + 1)
        b.append(row(xs[2], y, d, ranks))
    # top-k cut on the fused list
    yc = ytop + TOPK * (RH + G) - G / 2
    b.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="%s" stroke-dasharray="4 3"/>'
             % (xs[2], yc, xs[2] + CW, yc, ACC))
    bx = xs[2] + CW + 8
    b.append('<path d="M%.1f,%.1f h5 V%.1f h-5" fill="none" stroke="%s"/>' % (bx, ytop, yc - G / 2, ACC))
    b.append('<text class="tx m" transform="translate(%.1f,%.1f) rotate(90)" style="text-anchor:middle">top-%d %s</text>'
             % (bx + 14, (ytop + yc) / 2, TOPK, esc(L["cut"])))
    # the document nobody retrieves
    ym = ytop + 4 * (RH + G) + 20
    b.append(box(0, ym, 748, 40, "x"))
    b.append(text(374, ym + 17, L["miss"], "tx x", "middle"))
    b.append(text(374, ym + 32, L["miss2"], "tx d", "middle"))
    return svg(750, ym + 42, L["aria"], b)


# ─── 6. bucle-agente ─────────────────────────────────────────────────────────────────────────

def fig_bucle(es):
    L = {
        True: dict(q=("Pregunta", None), m=("Modelo", "lee todo lo acumulado"),
                   act=("buscar(consulta, fuente)", "la consulta la escribe él"),
                   src=["incidencias · léxica", "documentación · híbrida", "web"],
                   obs=("Observación", "los fragmentos, al contexto"),
                   ans=("Responder", "con citas, o «no lo sé»"),
                   miss="le falta algo", done="lo tiene", budget="el código sólo fija el presupuesto: 6 vueltas",
                   aria="Diagrama del bucle del RAG agéntico. La pregunta entra en el modelo, que lee todo lo "
                        "acumulado. Si le falta algo, llama a buscar con una consulta que escribe él y una "
                        "fuente que elige entre incidencias, con búsqueda léxica, documentación, con búsqueda "
                        "híbrida, y la web. Los fragmentos vuelven al contexto como observación y el modelo "
                        "decide otra vez. Cuando lo tiene, responde con citas o dice que no lo sabe. El código "
                        "sólo fija el presupuesto, seis vueltas."),
        False: dict(q=("Question", None), m=("Model", "reads everything so far"),
                    act=("search(query, source)", "it writes the query"),
                    src=["tickets · lexical", "documentation · hybrid", "web"],
                    obs=("Observation", "the chunks, into context"),
                    ans=("Answer", "with citations, or “I don't know”"),
                    miss="something missing", done="has it", budget="the code only sets the budget: 6 turns",
                    aria="Diagram of the agentic RAG loop. The question goes into the model, which reads "
                         "everything so far. If something is missing, it calls search with a query it writes "
                         "and a source it picks among tickets, with lexical search, documentation, with hybrid "
                         "search, and the web. The chunks come back into context as an observation and the "
                         "model decides again. When it has what it needs, it answers with citations or says it "
                         "does not know. The code only sets the budget, six turns."),
    }[es]
    b = []
    b.append(labelled(0, 98, 104, 44, *L["q"]))
    b.append(labelled(146, 83, 164, 74, *L["m"], cls="m"))
    b.append(arrow([(104, 120), (144, 120)]))
    b.append(box(372, 24, 186, 48, "")); b.append(text(465, 44, L["act"][0], "mo", "middle"))
    b.append(text(465, 61, L["act"][1], "sb m"))
    for i, s in enumerate(L["src"]):
        b.append(box(598, 6 + i * 32, 150, 26, "g")); b.append(text(673, 23 + i * 32, s, "tx", "middle"))
    b.append(arrow([(558, 48), (596, 48)]))
    b.append(labelled(372, 150, 186, 48, *L["obs"]))
    # model -> action, sources -> observation, observation -> model
    b.append(arrow([(250, 83), (250, 48), (370, 48)], "ar m"))
    b.append(text(258, 40, L["miss"], "sb m", "start"))
    b.append(arrow([(673, 102), (673, 174), (560, 174)]))
    b.append(arrow([(372, 174), (312, 174), (312, 142)]))
    # model -> answer
    b.append(arrow([(200, 157), (200, 214)], "ar m"))
    b.append(text(208, 190, L["done"], "sb m", "start"))
    b.append(labelled(118, 216, 164, 44, *L["ans"]))
    b.append(text(748, 238, L["budget"], "sb", "end"))
    return svg(750, 262, L["aria"], b)


# ─── 7. traza-4812 ───────────────────────────────────────────────────────────────────────────

def fig_traza(es):
    L = {
        True: dict(cols=["PIENSA", "BUSCA", "ENCUENTRA"],
                   t=[
                       (["Necesito el plan del cliente", "y la fecha del cobro."],
                        ("incidencias", [[("«4812»", "")]]),
                        [[("Ferretería Ortega · plan ", ""), ("Equipo", "m")],
                         "cobro anual: 14 de agosto", "pide el reembolso: 2 de septiembre"]),
                       (["Con el plan ya puedo", "buscar su plazo."],
                        ("documentación", [[("«plazo de reembolso", "")], [("plan ", ""), ("Equipo", "m"), (", anual»", "")]]),
                        ["Condiciones del plan Equipo, §7:", "30 días desde el cobro", "(y la FAQ: «por lo general, 14»)"]),
                       (["La regla del plan manda.", "14 ago + 30 días = 13 sep;", "el 2 de septiembre cae dentro."],
                        None,
                        ["Sí: puede pedirlo hasta el", "13 de septiembre. Cita la", "incidencia 4812 y §7."]),
                   ],
                   nosearch="no busca", answer="RESPONDE",
                   aria="Traza del RAG agéntico con la pregunta de la incidencia 4812, en tres vueltas. Vuelta 1: "
                        "piensa que necesita el plan del cliente y la fecha del cobro; busca 4812 en las "
                        "incidencias; encuentra Ferretería Ortega, plan Equipo, cobro anual el 14 de agosto, "
                        "reembolso pedido el 2 de septiembre. Vuelta 2: con el plan ya puede buscar su plazo; "
                        "busca plazo de reembolso plan Equipo anual en la documentación, con la palabra Equipo "
                        "sacada del resultado anterior; encuentra las condiciones del plan Equipo, 30 días desde "
                        "el cobro, y también la FAQ que dice por lo general 14. Vuelta 3: la regla del plan manda; "
                        "14 de agosto más 30 días es el 13 de septiembre y el 2 de septiembre cae dentro; no busca "
                        "y responde que sí, que puede pedirlo hasta el 13 de septiembre, citando la incidencia y "
                        "la sección 7."),
        False: dict(cols=["THINKS", "SEARCHES", "FINDS"],
                    t=[
                        (["I need the customer's plan", "and the charge date."],
                         ("tickets", [[("“4812”", "")]]),
                         [[("Ortega Hardware · ", ""), ("Team", "m"), (" plan", "")],
                          "annual charge: 14 August", "asks for a refund: 2 September"]),
                        (["Now I know the plan, I can", "search for its deadline."],
                         ("documentation", [[("“refund window", "")], [("Team", "m"), (" plan, annual”", "")]]),
                         ["Team plan terms, §7:", "30 days from the charge", "(and the FAQ: “as a rule, 14”)"]),
                        (["The plan's own rule wins.", "14 Aug + 30 days = 13 Sep;", "2 September is inside."],
                         None,
                         ["Yes: they can ask until", "13 September. Cites ticket", "4812 and §7."]),
                    ],
                    nosearch="no search", answer="ANSWERS",
                    aria="Trace of agentic RAG on the ticket 4812 question, in three turns. Turn 1: it thinks it "
                         "needs the customer's plan and the charge date; searches 4812 in the tickets; finds "
                         "Ortega Hardware, Team plan, annual charge on 14 August, refund requested on 2 "
                         "September. Turn 2: now it knows the plan it can search for the deadline; searches "
                         "refund window Team plan annual in the documentation, with the word Team taken from "
                         "the previous result; finds the Team plan terms, 30 days from the charge, and also the "
                         "FAQ saying as a rule 14. Turn 3: the plan's own rule wins; 14 August plus 30 days is 13 "
                         "September and 2 September is inside; no search, and it answers yes, they can ask until "
                         "13 September, citing the ticket and section 7."),
    }[es]
    X = [28, 262, 486]; W = [220, 210, 262]; H = 62; G = 16; y0 = 22
    b = []
    for j, c in enumerate(L["cols"]):
        b.append(text(X[j], 12, c, "hd"))
    for i, (think, search, found) in enumerate(L["t"]):
        y = y0 + i * (H + G)
        b.append(text(6, y + H / 2 + 5, str(i + 1), "lb", "start"))
        b.append(box(X[0], y, W[0], H, "g")); b.append(lines(X[0] + 10, y + 19, think, "tx", 14))
        if search:
            src, q = search
            b.append(box(X[1], y, W[1], H, ""))
            b.append(text(X[1] + 10, y + 18, src + " ←", "tx d"))
            b.append(lines(X[1] + 10, y + 34, q, "mo", 14))
            b.append(arrow([(X[0] + W[0], y + H / 2), (X[1] - 2, y + H / 2)]))
            b.append(arrow([(X[1] + W[1], y + H / 2), (X[2] - 2, y + H / 2)]))
            b.append(box(X[2], y, W[2], H, "")); b.append(lines(X[2] + 10, y + 19, found, "tx", 14))
        else:
            b.append(text(X[1] + W[1] / 2, y + H / 2 - 7, L["nosearch"], "tx d", "middle"))
            b.append(arrow([(X[0] + W[0], y + H / 2), (X[2] - 2, y + H / 2)], "ar m"))
            b.append(box(X[2], y, W[2], H, "m"))
            b.append(lines(X[2] + 10, y + 19, found, "tx m", 14))
    # the hop: "Equipo" in turn 1's result feeds turn 2's query
    y1 = y0 + 19; y2 = y0 + (H + G)
    # routed orthogonally through the gap between rows so it never crosses text
    yg = y0 + H + G / 2
    b.append(arrow([(X[2] + 222, y0 + H), (X[2] + 222, yg), (X[1] + 110, yg), (X[1] + 110, y2 - 2)], "ar m"))
    return svg(750, y0 + 3 * (H + G) - G + 2, L["aria"], b)


# ─── 8. dos-ejes ─────────────────────────────────────────────────────────────────────────────

def fig_dos_ejes(es):
    L = {
        True: dict(x="QUIÉN DECIDE LA BÚSQUEDA", y="QUÉ ENCUENTRA", xl=["el código", "el modelo"],
                   yl=["híbrida", "densa"],
                   cells=[
                       ("RAG híbrido", ["Encuentra la incidencia, no la regla", "de su plan. Responde «no»,",
                                        "segura y falsa."], "w"),
                       ("RAG agéntico híbrido", ["Incidencia por número, regla por plan.",
                                                 "«Sí, hasta el 13 de septiembre.»"], "m"),
                       ("RAG ingenuo", ["No encuentra la incidencia. Cita la", "regla general y no se compromete."], "g"),
                       ("Agente con búsqueda densa", ["Buscaría la regla del plan, pero por", "número puede no dar con la incidencia."], "g"),
                   ],
                   aria="Cuadro de dos por dos. Eje horizontal: quién decide la búsqueda, el código o el modelo. "
                        "Eje vertical: qué encuentra, búsqueda densa o híbrida. RAG ingenuo, código y densa: no "
                        "encuentra la incidencia, cita la regla general y no se compromete. RAG híbrido, código y "
                        "híbrida: encuentra la incidencia pero no la regla de su plan, y responde que no, segura y "
                        "falsa. Agente con búsqueda densa, modelo y densa: buscaría la regla del plan, pero por "
                        "número puede no dar con la incidencia. RAG agéntico híbrido, modelo e híbrida: la "
                        "incidencia por número, la regla por plan, y responde que sí, hasta el 13 de septiembre."),
        False: dict(x="WHO DECIDES THE SEARCH", y="WHAT IT FINDS", xl=["the code", "the model"],
                    yl=["hybrid", "dense"],
                    cells=[
                        ("Hybrid RAG", ["Finds the ticket, not its plan's rule.", "Answers “no”, confident",
                                        "and wrong."], "w"),
                        ("Agentic hybrid RAG", ["Ticket by number, rule by plan.",
                                                "“Yes, until 13 September.”"], "m"),
                        ("Naive RAG", ["Misses the ticket. Cites the general", "rule and will not commit."], "g"),
                        ("Agent with dense search", ["Would look up the plan's rule, but", "may miss the ticket by its number."], "g"),
                    ],
                    aria="A two-by-two grid. Horizontal axis: who decides the search, the code or the model. "
                         "Vertical axis: what it finds, dense or hybrid search. Naive RAG, code and dense: misses "
                         "the ticket, cites the general rule and will not commit. Hybrid RAG, code and hybrid: "
                         "finds the ticket but not its plan's rule, and answers no, confident and wrong. Agent "
                         "with dense search, model and dense: would look up the plan's rule but may miss the "
                         "ticket by its number. Agentic hybrid RAG, model and hybrid: ticket by number, rule by "
                         "plan, and answers yes, until 13 September."),
    }[es]
    x0, y0, cw, ch, g = 96, 40, 316, 96, 10
    b = [text(x0 + cw + g / 2, 12, L["x"], "hd", "middle")]
    for j, t in enumerate(L["xl"]):
        b.append(text(x0 + j * (cw + g) + cw / 2, 31, t, "sb"))
    for i, t in enumerate(L["yl"]):
        b.append(text(x0 - 12, y0 + i * (ch + g) + ch / 2 + 4, t, "sb", "end"))
    b.append('<text class="hd" transform="translate(14,%.1f) rotate(-90)" text-anchor="middle">%s</text>'
             % (y0 + ch + g / 2, esc(L["y"])))
    for k, (title, body, cls) in enumerate(L["cells"]):
        i, j = k // 2, k % 2
        x, y = x0 + j * (cw + g), y0 + i * (ch + g)
        b.append(box(x, y, cw, ch, cls))
        tc = {"m": "lb m", "w": "lb w", "g": "lb"}[cls]
        b.append(text(x + 14, y + 24, title, tc, "start"))
        b.append(lines(x + 14, y + 46, body, "tx" if cls != "g" else "tx d", 15))
    return svg(750, y0 + 2 * ch + g + 2, L["aria"], b)


if __name__ == "__main__":
    write("quien-decide", fig_quien_decide(True), fig_quien_decide(False))
    for state, name in (("base", "pipeline-base"), ("fails", "pipeline-fallos"), ("rw", "pipeline-reescritura")):
        out = []
        for es in (True, False):
            body, h = pipeline(es, state)
            out.append(svg(758, h, PIPE_ARIA[(state, es)], body))
        write(name, *out)
    write("dos-busquedas", fig_dos_busquedas(True), fig_dos_busquedas(False))
    write("bucle-agente", fig_bucle(True), fig_bucle(False))
    write("traza-4812", fig_traza(True), fig_traza(False))
    write("dos-ejes", fig_dos_ejes(True), fig_dos_ejes(False))
    print("fused order:", rrf([BM25, DENSE]))
