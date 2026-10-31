"""BLOG-21 — Figures for the blog post `memoria-de-agentes` (agentic memory). Diagrams, except
`cobertura-y-uso`, whose points are Tables 7 and 8 of Bao et al. (arXiv 2610.30755v1), copied below
as they are printed: semantic-evidence coverage and conditional reader utilisation, in %.
Run from this directory: python3 make_svgs.py ../../../public/blog/memoria-de-agentes
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

Every figure's aria-label is the `alt` of its <img> in content/blog/{es,en}/memoria-de-agentes.mdx,
word for word: change one, change the other.

Talleres Ruiz is INVENTED (like Albarán). Its dates must match the article's header comment:
agreement noted on 10 March (60 days), cancelled in a conversation on 18 June, annual renewal
charged on 15 July, question asked on 10 September. 15 Jul + 30 days = 14 Aug; + 60 days = 13 Sep."""
import sys, os

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; LINE = "#3b3b3e"
WARN = "#e8a24c"; BAD = "#ffb4ab"; SURF = "#131315"
FONT = "ui-sans-serif, system-ui, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .bx {{ fill: none; stroke: {MUTED}; stroke-width: 1; }}
  .bx.m {{ stroke: {ACC}; fill: rgba(78,222,163,0.08); }}
  .bx.w {{ stroke: {WARN}; fill: rgba(232,162,76,0.10); }}
  .bx.x {{ stroke: {BAD}; fill: rgba(255,180,171,0.10); }}
  .bx.g {{ stroke: {LINE}; }}
  .bx.d {{ stroke: {MUTED}; stroke-dasharray: 3 3; }}
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


def arrow(pts, cls="ar"):
    d = "M" + " L".join("%.1f,%.1f" % p for p in pts)
    return '<path class="%s" d="%s"/>' % (cls, d)


def dec(v, es):
    """One or two decimals with a comma in Spanish, a point in English."""
    s = ("%.2f" % v).rstrip("0").rstrip(".") if v != int(v) else "%d" % v
    return s.replace(".", ",") if es else s


def write(name, es_svg, en_svg):
    for suffix, content in ((".svg", es_svg), (".en.svg", en_svg)):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(content)


# ─── 1. dos-memorias ──────────────────────────────────────────────────────────────────────────

ARIA_TWO = {
    True: "Las mismas tres conversaciones de Lucía con el asistente, guardadas de dos formas. A la izquierda, "
          "las conversaciones: el 10 de marzo, Talleres Ruiz tiene 60 días para pedir el reembolso de la "
          "renovación anual por un acuerdo con comercial; el 18 de junio, el acuerdo de los 60 días se acaba y "
          "desde la renovación de julio vuelven a las condiciones normales; el 10 de septiembre, la pregunta de "
          "si el reembolso de la renovación cobrada el 15 de julio está en plazo. Arriba, una memoria de hechos: "
          "guarda dos frases sueltas y sin fecha, 60 días por el acuerdo comercial y vuelve a las condiciones "
          "normales de su plan; la búsqueda devuelve sólo la primera y la respuesta es sí, hasta el 13 de "
          "septiembre, que es falsa. Abajo, el historial en bruto: guarda los mensajes con su fecha; la búsqueda "
          "devuelve los de marzo y junio, y la respuesta es no, el plazo de 30 días venció el 14 de agosto, que "
          "es la correcta.",
    False: "The same three conversations between Lucía and the assistant, stored in two ways. On the left, the "
           "conversations: on 10 March, Talleres Ruiz has 60 days to ask for a refund of the annual renewal "
           "under an agreement with sales; on 18 June, the 60-day agreement is over and from the July renewal "
           "they are back on the normal terms; on 10 September, the question of whether a refund of the "
           "renewal charged on 15 July is in time. On top, a memory of facts: it keeps two loose, undated "
           "sentences, 60 days under the sales agreement and back on the normal terms of its plan; the search "
           "returns only the first one and the answer is yes, until 13 September, which is wrong. Below, the "
           "raw history: it keeps the messages with their dates; the search returns the March and June ones, "
           "and the answer is no, the 30-day window closed on 14 August, which is right.",
}


def fig_two(es):
    L = {True: dict(
            conv="CONVERSACIONES", facts="MEMORIA DE HECHOS", raw="HISTORIAL EN BRUTO",
            c1=("10 mar", ["«Talleres Ruiz tiene 60 días", "para pedir el reembolso de", "la renovación anual: acuerdo", "con comercial.»"]),
            c2=("18 jun", ["«Lo de los 60 días de Ruiz", "se acaba: desde la renovación", "de julio, condiciones normales.»"]),
            c3=("10 sep", ["«Ruiz pide el reembolso de la", "renovación del 15 de julio.", "¿Está en plazo?»"]),
            extract="extraer", keep=["guardar", "tal cual"], search="busca", question="la pregunta",
            f1="Talleres Ruiz: 60 días de reembolso", f1b="(acuerdo comercial)",
            f2="Talleres Ruiz vuelve a las", f2b="condiciones normales de su plan",
            nodate="sin fecha · sin relación entre ellas",
            a1=["«Sí: 60 días, hasta", "el 13 de septiembre.»"],
            r1="10 mar · «…tiene 60 días…»", r2="18 jun · «…60 días… se acaba»",
            more="… y los demás mensajes",
            a2=["«No: sin el acuerdo son", "30 días, y vencieron el", "14 de agosto.»"]),
         False: dict(
            conv="CONVERSATIONS", facts="MEMORY OF FACTS", raw="RAW HISTORY",
            c1=("10 Mar", ["“Talleres Ruiz has 60 days", "to ask for a refund of the", "annual renewal: a deal", "with sales.”"]),
            c2=("18 Jun", ["“Ruiz's 60 days are over:", "from the July renewal,", "normal terms.”"]),
            c3=("10 Sep", ["“Ruiz wants a refund of the", "15 July renewal. Is it", "in time?”"]),
            extract="extract", keep=["store", "as is"], search="search", question="the question",
            f1="Talleres Ruiz: 60-day refund window", f1b="(sales agreement)",
            f2="Talleres Ruiz is back on the", f2b="normal terms of its plan",
            nodate="no dates · nothing links them",
            a1=["“Yes: 60 days, until", "13 September.”"],
            r1="10 Mar · “…has 60 days…”", r2="18 Jun · “…60 days are over”",
            more="… and every other message",
            a2=["“No: without the deal it", "is 30 days, and they ran", "out on 14 August.”"])}[es]
    b = []
    # conversations column
    b.append(text(20, 20, L["conv"], "hd"))
    CW = 182
    ys = [32, 114, 214]
    for (d, rows), y, cls in zip((L["c1"], L["c2"], L["c3"]), ys, ("", "", "w")):
        h = 22 + 14 * len(rows)
        b.append(box(20, y, CW, h, cls))
        b.append(text(30, y + 16, d, "hd"))
        b.append(lines(30, y + 32, rows))
    TX, TW = 272, 230
    # top lane: memory of facts
    b.append(text(TX, 20, L["facts"], "hd"))
    b.append(box(TX, 32, TW, 44, "", rx=4))
    b.append(text(TX + 10, 50, L["f1"], "tx"))
    b.append(text(TX + 10, 65, L["f1b"], "tx d"))
    b.append(box(TX, 84, TW, 44, "d", rx=4))
    b.append(text(TX + 10, 102, L["f2"], "tx d"))
    b.append(text(TX + 10, 117, L["f2b"], "tx d"))
    b.append(text(TX + TW / 2, 144, L["nodate"], "sb"))
    # both earlier conversations feed both memories
    BX = 214
    b.append('<path d="M%d,70 H%d V172 H%d" fill="none" stroke="%s"/>' % (CW + 22, BX, CW + 22, MUTED))
    b.append(arrow([(BX, 80), (TX - 4, 80)]))
    b.append(text((BX + TX) / 2, 72, L["extract"], "sb"))
    # bottom lane: raw history
    RY = 180
    b.append('<line x1="%d" y1="160" x2="750" y2="160" stroke="%s"/>' % (TX, GRID))
    b.append(text(TX, RY - 6, L["raw"], "hd"))
    b.append(box(TX, RY + 4, TW, 24, "m", rx=4))
    b.append(text(TX + 10, RY + 20, L["r1"], "mo"))
    b.append(box(TX, RY + 34, TW, 24, "m", rx=4))
    b.append(text(TX + 10, RY + 50, L["r2"], "mo"))
    b.append(box(TX, RY + 64, TW, 24, "g", rx=4))
    b.append(text(TX + 10, RY + 80, L["more"], "tx d"))
    b.append(arrow([(BX, 172), (BX, RY + 16), (TX - 4, RY + 16)]))
    b.append(lines(BX + 4, RY + 32, L["keep"], "sb", "start", 12))
    # answers
    AX, AW = 590, 160
    b.append(arrow([(TX + TW + 2, 54), (AX - 4, 54)], "ar x"))
    b.append(text((TX + TW + AX) / 2, 46, L["search"], "sb"))
    b.append(box(AX, 32, AW, 46, "x"))
    b.append(lines(AX + 10, 51, L["a1"], "tx x"))
    b.append(arrow([(TX + TW + 2, RY + 31), (AX - 4, RY + 31)], "ar m"))
    b.append(text((TX + TW + AX) / 2, RY + 23, L["search"], "sb"))
    b.append(box(AX, RY + 4, AW, 58, "m"))
    b.append(lines(AX + 10, RY + 23, L["a2"], "tx m"))
    # the question triggers both searches
    qx = 546
    b.append('<path d="M%d,%d V%d H%d V%d" fill="none" stroke="%s" stroke-width="1.2"/>'
             % (110, ys[2] + 64, 296, qx, 58, WARN))
    b.append('<circle cx="%d" cy="54" r="3" fill="%s"/>' % (qx, WARN))
    b.append('<circle cx="%d" cy="%d" r="3" fill="%s"/>' % (qx, RY + 31, WARN))
    b.append(text(qx + 6, 290, L["question"], "sb w", "start"))
    return svg(760, 304, ARIA_TWO[es], b)


# ─── 2. ciclo-de-memoria ──────────────────────────────────────────────────────────────────────

ARIA_CYCLE = {
    True: "El ciclo de una memoria en cuatro decisiones, entre la conversación y el modelo. Escribir: qué se "
          "guarda de cada conversación, todo o sólo hechos extraídos o resúmenes. Guardar: en qué forma, "
          "fragmentos de texto, hechos sueltos, notas enlazadas, un grafo o varios niveles. Leer: cómo se "
          "encuentra lo necesario, por parecido, con recencia e importancia, con un reordenador o con un agente "
          "que busca. Lo que se lee entra en el contexto del modelo, que responde, y la respuesta vuelve a la "
          "conversación. Mantener actúa sobre lo guardado: añadir, actualizar, borrar o no hacer nada, "
          "consolidar y olvidar.",
    False: "The cycle of a memory as four decisions, between the conversation and the model. Write: what to "
           "keep from each conversation, everything or only extracted facts or summaries. Store: in what form, "
           "text fragments, loose facts, linked notes, a graph or several tiers. Read: how to find what is "
           "needed, by similarity, with recency and importance, with a reranker or with an agent that "
           "searches. What is read goes into the model's context, the model answers, and the answer goes back "
           "into the conversation. Maintain acts on what is stored: add, update, delete or do nothing, "
           "consolidate and forget.",
}


def fig_cycle(es):
    L = {True: dict(conv="Conversación",
                    steps=[("ESCRIBIR", "qué se guarda", ["todo, tal cual", "hechos extraídos", "resúmenes"]),
                           ("GUARDAR", "en qué forma", ["fragmentos de texto", "hechos, notas, grafo", "niveles"]),
                           ("LEER", "cómo se encuentra", ["parecido", "+ recencia, importancia", "reordenador, agente"])],
                    model="Modelo", model2="lee y responde",
                    keep="MANTENER", keep2="sobre lo guardado",
                    ops="añadir · actualizar · borrar · nada · consolidar · olvidar",
                    back="cada respuesta es otro mensaje"),
         False: dict(conv="Conversation",
                     steps=[("WRITE", "what to keep", ["everything, as is", "extracted facts", "summaries"]),
                            ("STORE", "in what form", ["text fragments", "facts, notes, graph", "tiers"]),
                            ("READ", "how to find it", ["similarity", "+ recency, importance", "reranker, agent"])],
                     model="Model", model2="reads, answers",
                     keep="MAINTAIN", keep2="what is stored",
                     ops="add · update · delete · nothing · consolidate · forget",
                     back="every answer is one more message")}[es]
    b = []
    y, h = 28, 112
    b.append(labelled(20, y + 30, 100, 52, L["conv"], None))
    xs = [144, 302, 460]
    for x, (title, sub, rows) in zip(xs, L["steps"]):
        b.append(box(x, y, 142, h, "m" if title in ("GUARDAR", "STORE") else ""))
        b.append(text(x + 71, y + 20, title, "hd", "middle"))
        b.append(text(x + 71, y + 36, sub, "sb"))
        b.append(lines(x + 12, y + 62, ["· " + r for r in rows], "tx"))
    b.append(labelled(626, y + 30, 114, 52, L["model"], L["model2"], "w"))
    b.append(arrow([(122, y + 56), (141, y + 56)]))
    for x in xs:
        b.append(arrow([(x + 144, y + 56), (x + 156 if x < 460 else 623, y + 56)]))
    # maintain, acting on the store
    my = 186
    b.append(box(205, my, 336, 48, "d"))
    b.append(text(223, my + 20, L["keep"], "hd"))
    b.append(text(223 + (90 if es else 92), my + 20, L["keep2"], "sb", "start"))
    b.append(text(373, my + 37, L["ops"], "tx", "middle"))
    b.append(arrow([(364, my - 2), (364, y + h + 4)], "ar m"))
    b.append(arrow([(382, y + h + 4), (382, my - 2)], "ar m"))
    # the answer feeds the conversation again
    b.append(arrow([(683, y + 84), (683, 258), (70, 258), (70, y + 84)]))
    b.append(text(683 - 8, 252, L["back"], "sb", "end"))
    return svg(760, 272, ARIA_CYCLE[es], b)


# ─── 3. linea-de-tiempo ───────────────────────────────────────────────────────────────────────

# (year, month, level, es label, en label); level > 0 above the axis (systems), < 0 below
# (frameworks, benchmarks and products). Labels run right of their stem, so an event inside a
# label's span must sit on a LOWER level than that label, or its stem would cross the text.
EVENTS = [
    (2023, 4, 3, "Generative Agents", "Generative Agents"),
    (2023, 5, 2, "MemoryBank", "MemoryBank"),
    (2023, 10, 1, "MemGPT", "MemGPT"),
    (2025, 1, 4, "Zep", "Zep"),
    (2025, 2, 3, "A-MEM", "A-MEM"),
    (2025, 4, 2, "Mem0", "Mem0"),
    (2025, 5, 1, "MemOS", "MemOS"),
    (2025, 8, 3, "Memory-R1", "Memory-R1"),
    (2026, 8, 2, "ReFind", "ReFind"),
    (2026, 10, 1, "Raw-RAG", "Raw-RAG"),
    (2023, 9, -1, "CoALA", "CoALA"),
    (2024, 2, -1, "LoCoMo", "LoCoMo"),
    (2024, 2, -2, "ChatGPT recuerda", "ChatGPT memory"),
    (2024, 10, -1, "LongMemEval", "LongMemEval"),
    (2025, 7, -4, "MemoryAgentBench", "MemoryAgentBench"),
    (2025, 8, -3, "Claude busca chats", "Claude searches chats"),
    (2025, 9, -2, "herramienta de memoria", "memory tool"),
    (2026, 5, -1, "MEME", "MEME"),
]

ARIA_TIME = {
    True: "Línea de tiempo de 2023 a 2026. Encima del eje, los sistemas de memoria: Generative Agents en abril "
          "de 2023, MemoryBank en mayo, MemGPT en octubre; Zep en enero de 2025, A-MEM en febrero, Mem0 en "
          "abril, MemOS en mayo, Memory-R1 en agosto; ReFind en agosto de 2026 y Raw-RAG en octubre. Debajo, "
          "marcos, bancos de pruebas y productos: CoALA en septiembre de 2023; LoCoMo y la memoria de ChatGPT "
          "en febrero de 2024, LongMemEval en octubre; MemoryAgentBench en julio de 2025, la búsqueda de chats "
          "de Claude en agosto y la herramienta de memoria de la API de Anthropic en septiembre; MEME en mayo de "
          "2026.",
    False: "Timeline from 2023 to 2026. Above the axis, memory systems: Generative Agents in April 2023, "
           "MemoryBank in May, MemGPT in October; Zep in January 2025, A-MEM in February, Mem0 in April, MemOS "
           "in May, Memory-R1 in August; ReFind in August 2026 and Raw-RAG in October. Below, frameworks, "
           "benchmarks and products: CoALA in September 2023; LoCoMo and ChatGPT's memory in February 2024, "
           "LongMemEval in October; MemoryAgentBench in July 2025, Claude's chat search in August and the "
           "memory tool in Anthropic's API in September; MEME in May 2026.",
}


def fig_time(es):
    L = {True: dict(up="SISTEMAS DE MEMORIA", down="MARCOS, BANCOS DE PRUEBAS Y PRODUCTOS"),
         False: dict(up="MEMORY SYSTEMS", down="FRAMEWORKS, BENCHMARKS AND PRODUCTS")}[es]
    X0, X1 = 40, 730
    AY = 140

    def X(y, m):
        return X0 + (X1 - X0) * ((y - 2023) * 12 + (m - 1) + 0.5) / 48

    b = []
    b.append(text(20, 18, L["up"], "hd"))
    b.append(text(20, 286, L["down"], "hd"))
    b.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.5"/>' % (X0, AY, X1, AY, MUTED))
    for yr in range(2023, 2027):
        x = X(yr, 1) - (X1 - X0) / 96
        b.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%d" stroke="%s"/>' % (x, AY - 5, x, AY + 5, MUTED))
        b.append(text(x + 4, AY + 16, str(yr), "sb", "start"))
    for yr, mo, lvl, les, len_ in EVENTS:
        x = X(yr, mo)
        label = les if es else len_
        hi = label in ("Raw-RAG",)
        if lvl > 0:
            ty = AY - 18 - 28 * (lvl - 1)
            b.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%.1f" stroke="%s"/>' % (x, AY, x, ty + 4, ACC if hi else LINE))
            b.append(text(x + 4, ty, label, "tx m" if hi else "tx", "start"))
        else:
            ty = AY + 34 + 28 * (-lvl - 1)
            b.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%.1f" stroke="%s"/>' % (x, AY, x, ty - 11, LINE))
            b.append(text(x + 4, ty, label, "tx", "start"))
        b.append('<circle cx="%.1f" cy="%d" r="3.5" fill="%s" stroke="%s" stroke-width="2"/>'
                 % (x, AY, ACC if hi else TXT, SURF))
    return svg(760, 296, ARIA_TIME[es], b)


# ─── 4. cobertura-y-uso ───────────────────────────────────────────────────────────────────────

# Bao et al. 2026, Table 7 (MemoryAgentBench, LLM-judged) and Table 8 (MEME, deterministic checks).
MAB = [("MemU", 19.07, 89.37), ("MemMachine", 21.54, 84.30), ("EverMemOS", 25.11, 80.00),
       ("MemOS", 34.48, 85.85), ("EMem", 34.72, 89.71), ("Mem0", 40.03, 82.39), ("Raw-RAG", 45.29, 84.43)]
MEME = [("MemU", 35.69, 84.20), ("EverMemOS", 47.64, 76.86), ("EMem", 50.08, 86.55),
        ("MemOS", 62.12, 66.67), ("Mem0", 63.22, 65.51), ("MemMachine", 70.37, 82.66), ("Raw-RAG", 76.35, 73.76)]

ARIA_COV = {
    True: "Dos gráficos de puntos, uno por banco de pruebas, con un punto por sistema de memoria. El eje "
          "horizontal es la cobertura, el porcentaje de preguntas para las que el sistema recupera evidencia "
          "suficiente, y el vertical, el uso, el porcentaje de esas preguntas que el lector acierta. En "
          "MemoryAgentBench, la cobertura va del 19,07 % de MemU al 45,29 % de Raw-RAG, y el uso, sólo del 80 % "
          "de EverMemOS al 89,71 % de EMem; Raw-RAG queda en 84,43 %. En MEME, la cobertura va del 35,69 % de "
          "MemU al 76,35 % de Raw-RAG, y el uso, del 65,51 % de Mem0 al 86,55 % de EMem; Raw-RAG queda en "
          "73,76 %. En los dos, Raw-RAG es el punto más a la derecha sin ser el más alto.",
    False: "Two dot charts, one per benchmark, with one dot per memory system. The horizontal axis is "
           "coverage, the percentage of questions for which the system retrieves sufficient evidence, and the "
           "vertical axis is utilisation, the percentage of those questions the reader gets right. On "
           "MemoryAgentBench, coverage runs from 19.07% for MemU to 45.29% for Raw-RAG, and utilisation only "
           "from 80% for EverMemOS to 89.71% for EMem; Raw-RAG sits at 84.43%. On MEME, coverage runs from "
           "35.69% for MemU to 76.35% for Raw-RAG, and utilisation from 65.51% for Mem0 to 86.55% for EMem; "
           "Raw-RAG sits at 73.76%. On both, Raw-RAG is the rightmost dot without being the highest.",
}

# label offsets (dx, dy, anchor) so names don't collide; keyed by (panel, system)
OFFS = {
    ("mab", "MemU"): (8, 4, "start"), ("mab", "MemMachine"): (8, 12, "start"),
    ("mab", "EverMemOS"): (8, 4, "start"), ("mab", "MemOS"): (-8, 4, "end"),
    ("mab", "EMem"): (8, 4, "start"), ("mab", "Mem0"): (8, 4, "start"), ("mab", "Raw-RAG"): (-8, -10, "end"),
    ("meme", "MemU"): (8, 4, "start"), ("meme", "EverMemOS"): (8, 4, "start"), ("meme", "EMem"): (8, 4, "start"),
    ("meme", "MemOS"): (-8, -6, "end"), ("meme", "Mem0"): (8, 12, "start"),
    ("meme", "MemMachine"): (-8, -8, "end"), ("meme", "Raw-RAG"): (-8, 16, "end"),
}


def fig_cov(es):
    L = {True: dict(x="cobertura: preguntas con evidencia suficiente (%)", y="uso: aciertos con ella (%)"),
         False: dict(x="coverage: questions with sufficient evidence (%)", y="utilisation: right with it (%)")}[es]
    b = []
    panels = (("mab", "MemoryAgentBench", MAB, 20, 15, 50, 76, 94),
              ("meme", "MEME", MEME, 395, 30, 80, 62, 92))
    for key, title, data, ox, xmin, xmax, ymin, ymax in panels:
        PX0, PX1, PY0, PY1 = ox + 40, ox + 345, 40, 236

        def X(v):
            return PX0 + (PX1 - PX0) * (v - xmin) / (xmax - xmin)

        def Y(v):
            return PY1 - (PY1 - PY0) * (v - ymin) / (ymax - ymin)

        b.append(text(ox, 18, title.upper(), "hd"))
        ystep = 4 if key == "mab" else 10
        for t in range(int(ymin + (ystep - ymin % ystep) % ystep), int(ymax) + 1, ystep):
            b.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="%s"/>' % (PX0, Y(t), PX1, Y(t), GRID))
            b.append(text(PX0 - 6, Y(t) + 4, str(t), "sb", "end"))
        for t in range(int(xmin) + (10 - int(xmin) % 10) % 10, int(xmax) + 1, 10):
            b.append(text(X(t), PY1 + 16, str(t), "sb"))
        b.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s"/>' % (PX0, PY1, PX1, PY1, LINE))
        for name, cov, use in data:
            hi = name == "Raw-RAG"
            b.append('<circle cx="%.1f" cy="%.1f" r="%d" fill="%s" stroke="%s" stroke-width="2"/>'
                     % (X(cov), Y(use), 6 if hi else 5, ACC if hi else MUTED, SURF))
            dx, dy, anc = OFFS[(key, name)]
            b.append(text(X(cov) + dx, Y(use) + dy, name, "tx m" if hi else "tx", anc))
    b.append(text(380, 276, L["x"], "sb"))
    b.append(text(60, 32, L["y"], "sb", "start"))
    b.append(text(435, 32, L["y"], "sb", "start"))
    return svg(760, 286, ARIA_COV[es], b)


# ─── 5. memoria-en-capas ──────────────────────────────────────────────────────────────────────

ARIA_LAYERS = {
    True: "La memoria del asistente de Albarán en cuatro capas, de arriba abajo. Primera, las instrucciones y "
          "los procedimientos: un archivo de texto que el equipo revisa y que el asistente lee siempre. "
          "Segunda, el historial en bruto: todos los mensajes, con fecha y autor, la fuente de verdad, en la "
          "que se busca y se reordena. Tercera, un índice derivado: resúmenes y hechos extraídos que sirven "
          "para encontrar y apuntan al mensaje original, nunca lo sustituyen. Cuarta, fuera de la memoria: el "
          "estado que manda, como los planes, los cobros y los acuerdos comerciales, en sus sistemas, que el "
          "asistente consulta con una herramienta. A la derecha, el modelo lee las cuatro.",
    False: "Albarán's assistant memory in four layers, from top to bottom. First, instructions and procedures: "
           "a text file the team reviews and the assistant always reads. Second, the raw history: every "
           "message, with date and author, the source of truth, which is searched and reranked. Third, a "
           "derived index: summaries and extracted facts that help find things and point to the original "
           "message, never replace it. Fourth, outside the memory: the state that governs, such as plans, "
           "charges and sales agreements, in their own systems, which the assistant queries with a tool. On "
           "the right, the model reads all four.",
}


def fig_layers(es):
    L = {True: dict(
            rows=[("Instrucciones y procedimientos", "un archivo que el equipo revisa; se lee siempre", ""),
                  ("Historial en bruto", "cada mensaje, con fecha y autor: la fuente de verdad", "m"),
                  ("Índice derivado", "resúmenes y hechos para encontrar; apuntan al original", "d"),
                  ("Estado que manda", "planes, cobros, acuerdos: en sus sistemas, no en la memoria", "w")],
            how=["en el prompt", "buscar + reordenar", "buscar", "herramienta"],
            model="Modelo", model2="lee las cuatro", out="FUERA DE LA MEMORIA"),
         False: dict(
            rows=[("Instructions and procedures", "a file the team reviews; always read", ""),
                  ("Raw history", "every message, with date and author: the source of truth", "m"),
                  ("Derived index", "summaries and facts to find things; they point to the original", "d"),
                  ("State that governs", "plans, charges, agreements: in their systems, not in memory", "w")],
            how=["in the prompt", "search + rerank", "search", "tool"],
            model="Model", model2="reads all four", out="OUTSIDE THE MEMORY")}[es]
    b = []
    y0, h, gap = 20, 40, 10
    for i, (title, sub, cls) in enumerate(L["rows"]):
        y = y0 + i * (h + gap) + (14 if i == 3 else 0)
        b.append(box(20, y, 500, h, cls))
        tcls = {"m": "lb m", "w": "lb w"}.get(cls, "lb")
        b.append(text(34, y + 17, title, tcls, "start"))
        b.append(text(34, y + 32, sub, "sb", "start"))
        if i == 2:  # derived index points to the raw history
            b.append(arrow([(470, y), (470, y - gap + 2)], "ar m"))
        b.append(arrow([(522, y + h / 2), (618, y + h / 2)], "ar w" if cls == "w" else "ar"))
        b.append(text(570, y + h / 2 - 5, L["how"][i], "sb"))
    b.append(text(20, y0 + 3 * (h + gap) + 8, L["out"], "hd"))
    b.append(labelled(622, 20, 118, 194, L["model"], L["model2"], ""))
    return svg(760, 236, ARIA_LAYERS[es], b)


if __name__ == "__main__":
    write("dos-memorias", fig_two(True), fig_two(False))
    write("ciclo-de-memoria", fig_cycle(True), fig_cycle(False))
    write("linea-de-tiempo", fig_time(True), fig_time(False))
    write("cobertura-y-uso", fig_cov(True), fig_cov(False))
    write("memoria-en-capas", fig_layers(True), fig_layers(False))
    span = lambda d, i: max(r[i] for r in d) - min(r[i] for r in d)
    print("MAB coverage span %.2f, utilisation span %.2f" % (span(MAB, 1), span(MAB, 2)))
    print("MEME coverage span %.2f, utilisation span %.2f" % (span(MEME, 1), span(MEME, 2)))
