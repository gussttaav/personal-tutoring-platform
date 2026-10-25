"""BLOG-20 — Figures for the blog post `cuando-no-hace-falta-buscar` (CAG). Diagrams, not data:
the one computed thing is `coste-acumulado`, whose three curves are derived here from the tariff
the article states (cache read 0.1, cache write 1.25, in units of one ordinary input token) and
Albarán's invented sizes (32 000 tokens of policies, RAG with 4 fragments of 500 tokens).
Run from this directory: python3 make_svgs.py ../../../public/blog/cuando-no-hace-falta-buscar
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

Every figure's aria-label is the `alt` of its <img> in content/blog/{es,en}/cuando-no-hace-falta-
buscar.mdx, word for word: change one, change the other."""
import sys, os

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; LINE = "#3b3b3e"
WARN = "#e8a24c"; BAD = "#ffb4ab"; SURF = "#131315"
# Categorical lines of coste-acumulado, in this order (dataviz validate_palette.js --mode dark
# --surface #131315: lightness band, chroma, CVD and normal-vision separation all pass; the
# deutan pair sits at 8.7, and the uncached line is dashed as well, so identity never rests on hue).
C_SIN, C_CAG, C_RAG = "#c47d2b", "#22a672", "#5b8ce0"
FONT = "ui-sans-serif, system-ui, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .bx {{ fill: none; stroke: {MUTED}; stroke-width: 1; }}
  .bx.m {{ stroke: {ACC}; fill: rgba(78,222,163,0.08); }}
  .bx.w {{ stroke: {WARN}; fill: rgba(232,162,76,0.10); }}
  .bx.x {{ stroke: {BAD}; fill: rgba(255,180,171,0.10); stroke-dasharray: 3 3; }}
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
  .br {{ fill: none; stroke: {MUTED}; stroke-width: 1; }}
  .br.m {{ stroke: {ACC}; }}
  .br.w {{ stroke: {WARN}; }}
  .br.x {{ stroke: {BAD}; }}
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


def bracket(x1, x2, y, down=True, cls="br"):
    """A square bracket spanning x1..x2 whose ticks point toward the thing it labels."""
    t = 5 if down else -5
    return '<path class="%s" d="M%.1f,%.1f V%.1f H%.1f V%.1f"/>' % (cls, x1, y + t, y, x2, y + t)


def num(n, es):
    """Thousands with a space in Spanish (the blog's convention), a comma in English."""
    s = "{:,}".format(n)
    return s.replace(",", " ") if es else s


def write(name, es_svg, en_svg):
    for suffix, content in ((".svg", es_svg), (".en.svg", en_svg)):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(content)


# ─── Albarán's invented numbers (must match the article's header comment) ────────────────────

POLICIES = 32000
GROUPS = [  # (key, tokens), in order of stability: the FAQ, retouched weekly, goes last
    ("planes", 13500), ("facturacion", 8000), ("privacidad", 5500), ("acuerdos", 2000), ("faq", 3000)]
assert sum(t for _, t in GROUPS) == POLICIES
GROUP_NAME = {
    True: {"planes": "Condiciones de los planes", "facturacion": "Facturación y cobros",
           "privacidad": "Privacidad y datos", "acuerdos": "Acuerdos de servicio",
           "faq": "Preguntas frecuentes"},
    False: {"planes": "Plan terms", "facturacion": "Billing and payments",
            "privacidad": "Privacy and data", "acuerdos": "Service agreements", "faq": "FAQ"},
}
READ, WRITE = 0.1, 1.25        # cache read / write, in units of one ordinary input token
RAG_TOKENS = 4 * 500           # four fragments of 500 tokens
N_QUESTIONS = 20


def cumulative():
    """Knowledge tokens paid after n questions, n = 1..N, for the three systems."""
    sin = [POLICIES * n for n in range(1, N_QUESTIONS + 1)]
    cag = [POLICIES * WRITE + POLICIES * READ * (n - 1) for n in range(1, N_QUESTIONS + 1)]
    rag = [RAG_TOKENS * n for n in range(1, N_QUESTIONS + 1)]
    return sin, cag, rag


# ─── 1. prefill-decode ────────────────────────────────────────────────────────────────────────

ARIA_PREFILL = {
    True: "Diagrama de las dos fases de la inferencia sobre una fila de tokens. A la izquierda, el prefill: "
          "los 32 000 tokens de las políticas y los de la pregunta entran a la vez, en una sola pasada, y de "
          "cada token sale, en cada capa, una clave y un valor que se guardan en la caché KV. A la derecha, la "
          "decodificación: la respuesta se escribe de token en token; cada token nuevo lee las claves y los "
          "valores de todos los anteriores y añade los suyos a la caché.",
    False: "Diagram of the two phases of inference over a row of tokens. On the left, the prefill: the 32,000 "
           "tokens of the policies and those of the question go in together, in a single pass, and every "
           "token produces, in every layer, a key and a value that are stored in the KV cache. On the right, "
           "decoding: the answer is written one token at a time; each new token reads the keys and values of "
           "all the earlier ones and adds its own to the cache.",
}


def fig_prefill(es):
    L = {True: dict(h1="LEER · PREFILL", h2="ESCRIBIR · DECODIFICACIÓN",
                    pol="Políticas de Albarán", pol2="32 000 tokens", q="Pregunta",
                    once="todos a la vez, en una sola pasada", step="de uno en uno",
                    kv="CACHÉ KV", kvp="claves y valores de las políticas, en cada capa",
                    kvq="de la pregunta", kvr="uno más por token",
                    reads="cada token nuevo lee todas las claves y valores anteriores"),
         False: dict(h1="READ · PREFILL", h2="WRITE · DECODE",
                     pol="Albarán's policies", pol2="32,000 tokens", q="Question",
                     once="all at once, in a single pass", step="one at a time",
                     kv="KV CACHE", kvp="keys and values of the policies, in every layer",
                     kvq="of the question", kvr="one more per token",
                     reads="each new token reads every earlier key and value")}[es]
    b = []
    # headings
    b.append(text(20, 20, L["h1"], "hd"))
    b.append(text(520, 20, L["h2"], "hd"))
    b.append('<line x1="505" y1="10" x2="505" y2="222" stroke="%s" stroke-dasharray="2 4"/>' % LINE)
    # token row
    y = 44
    b.append(labelled(20, y, 380, 40, L["pol"], L["pol2"], "m"))
    b.append(labelled(408, y, 86, 40, L["q"], None, "w"))
    ans = [520 + i * 44 for i in range(5)]
    for i, x in enumerate(ans):
        b.append(box(x, y + 6, 34, 28, "d" if i == 4 else ""))
        b.append(text(x + 17, y + 24, "t%d" % (i + 1) if i < 4 else "…", "mo", "middle"))
    b.append(bracket(20, 494, y + 52, down=False))
    b.append(text(257, y + 68, L["once"], "sb"))
    b.append(text(630, y + 68, L["step"], "sb"))
    for i in range(3):
        x0 = ans[i] + 34; x1 = ans[i + 1]
        b.append(arrow([(x0 + 1, y + 20), (x1 - 2, y + 20)]))
    # KV cache band
    ky = 160
    b.append(text(20, ky - 8, L["kv"], "hd"))
    for layer in range(4):
        yy = ky + layer * 9
        b.append('<rect x="20" y="%.1f" width="380" height="7" rx="2" fill="rgba(78,222,163,%.2f)"/>'
                 % (yy, 0.55 - layer * 0.1))
        b.append('<rect x="408" y="%.1f" width="86" height="7" rx="2" fill="rgba(232,162,76,%.2f)"/>'
                 % (yy, 0.55 - layer * 0.1))
        for i, x in enumerate(ans[:4]):
            if i < 3:
                b.append('<rect x="%.1f" y="%.1f" width="34" height="7" rx="2" fill="rgba(187,202,191,%.2f)"/>'
                         % (x, yy, 0.45 - layer * 0.08))
            else:
                b.append('<rect x="%.1f" y="%.1f" width="34" height="7" rx="2" fill="none" stroke="%s" '
                         'stroke-dasharray="2 2"/>' % (x, yy, MUTED))
    b.append(text(210, ky + 54, L["kvp"], "sb"))
    b.append(text(451, ky + 54, L["kvq"], "sb"))
    b.append(text(607, ky + 54, L["kvr"], "sb"))
    # t4 reads everything before it, then adds its own row of K and V
    tx = ans[3] + 17
    b.append(arrow([(tx, y + 34), (tx, y + 102), (260, y + 102), (260, ky - 2)], "ar m"))
    b.append(text(268, y + 96, L["reads"], "tx m"))
    b.append(arrow([(tx, y + 102), (tx, ky - 2)], "ar m"))
    return svg(760, 232, ARIA_PREFILL[es], b)


# ─── 2. rag-frente-a-cag ──────────────────────────────────────────────────────────────────────

ARIA_PIPE = {
    True: "Dos diagramas, cada uno en dos carriles: arriba lo que se hace una vez y abajo lo que se hace en "
          "cada pregunta. RAG: una vez, documentos, trocear en fragmentos, embeber cada fragmento e índice; en "
          "cada pregunta, la pregunta, buscar los k fragmentos más cercanos, montar el prompt con la pregunta y "
          "los fragmentos, y el modelo responde. CAG: una vez, los 40 documentos enteros, prefill y caché KV "
          "guardada; en cada pregunta, la caché más la pregunta, el modelo responde, y la caché se recorta "
          "hasta el final de las políticas.",
    False: "Two diagrams, each in two lanes: on top what is done once, below what is done for every question. "
           "RAG: once, documents, split into fragments, embed each fragment, and an index; for every question, "
           "the question, search for the k nearest fragments, build the prompt from the question and the "
           "fragments, and the model answers. CAG: once, the 40 whole documents, prefill, and the stored KV "
           "cache; for every question, the cache plus the question, the model answers, and the cache is "
           "trimmed back to the end of the policies.",
}


def fig_pipes(es):
    L = {True: dict(once="UNA VEZ", each="CADA PREGUNTA",
                    rag1=[("Documentos", None), ("Trocear", "en fragmentos"), ("Embeber", "cada fragmento"),
                          ("Índice", "vectores y texto")],
                    rag2=[("Pregunta", None), ("Buscar", "los k más cercanos"), ("Prompt", "pregunta + fragmentos"),
                          ("Modelo", "responde")],
                    cag1=[("Documentos", "los 40, enteros"), ("Prefill", "32 000 tokens"), ("Caché KV", "guardada")],
                    cag2=[("Caché + pregunta", None), ("Modelo", "responde"), ("Recortar", "hasta las políticas")]),
         False: dict(once="ONCE", each="EVERY QUESTION",
                     rag1=[("Documents", None), ("Split", "into fragments"), ("Embed", "each fragment"),
                           ("Index", "vectors and text")],
                     rag2=[("Question", None), ("Search", "the k nearest"), ("Prompt", "question + fragments"),
                           ("Model", "answers")],
                     cag1=[("Documents", "all 40, whole"), ("Prefill", "32,000 tokens"), ("KV cache", "stored")],
                     cag2=[("Cache + question", None), ("Model", "answers"), ("Trim", "back to the policies")])}[es]
    b = []
    X0, BW, GAP, BH = 172, 124, 22, 40

    def lane(y, items, cls_last="", start=0):
        xs = []
        for i, (t, s) in enumerate(items):
            x = X0 + (i + start) * (BW + GAP)
            cls = "m" if (cls_last and i == len(items) - 1) else ""
            b.append(labelled(x, y, BW, BH, t, s, cls))
            if i:
                b.append(arrow([(x - GAP + 2, y + BH / 2), (x - 3, y + BH / 2)]))
            xs.append(x)
        return xs

    for top, name, l1, l2 in ((14, "RAG", L["rag1"], L["rag2"]), (164, "CAG", L["cag1"], L["cag2"])):
        b.append(text(20, top + 30, name, "lb", "start"))
        b.append(text(60, top + 28, L["once"], "hd"))
        b.append(text(60, top + 28 + 62, L["each"], "hd"))
        xs1 = lane(top + 4, l1, cls_last="m")
        xs2 = lane(top + 66, l2)
        if name == "RAG":
            # index feeds the search
            xi = xs1[3] + BW / 2
            b.append(arrow([(xi, top + 4 + BH), (xi, top + 56), (xs2[1] + BW / 2, top + 56),
                            (xs2[1] + BW / 2, top + 64)], "ar m"))
        else:
            # the stored cache feeds every question, and the trim returns to it
            xc = xs1[2] + BW / 2
            b.append(arrow([(xc, top + 4 + BH), (xc, top + 56), (xs2[0] + BW / 2, top + 56),
                            (xs2[0] + BW / 2, top + 64)], "ar m"))
            xr = xs2[2] + BW / 2
            b.append(arrow([(xr, top + 66 + BH), (xr, top + 66 + BH + 14), (xs2[0] + BW / 2, top + 66 + BH + 14),
                            (xs2[0] + BW / 2, top + 66 + BH + 3)], "ar m"))
    b.append('<line x1="20" y1="150" x2="740" y2="150" stroke="%s"/>' % GRID)
    return svg(760, 300, ARIA_PIPE[es], b)


# ─── 3. orden-del-prefijo ─────────────────────────────────────────────────────────────────────

ARIA_ORDER = {
    True: "Dos barras horizontales con las políticas de Albarán en dos órdenes, cada segmento con su tamaño en "
          "tokens. Arriba, las preguntas frecuentes primero, 3 000 tokens que cambian cada semana, seguidas de "
          "las condiciones de los planes, facturación, privacidad y acuerdos de nivel de servicio: un cambio en "
          "las preguntas frecuentes obliga a recalcular los 32 000 tokens. Abajo, el orden por estabilidad, "
          "con las preguntas frecuentes al final: el mismo cambio sólo recalcula sus 3 000 tokens.",
    False: "Two horizontal bars with Albarán's policies in two orders, each segment labelled with its size in "
           "tokens. On top, the FAQ first, 3,000 tokens that change every week, followed by the plan terms, "
           "billing, privacy and the service level agreements: a change to the FAQ forces all 32,000 tokens to "
           "be recomputed. Below, ordered by stability, with the FAQ last: the same change only recomputes its "
           "3,000 tokens.",
}


def fig_order(es):
    L = {True: dict(a="LAS PREGUNTAS FRECUENTES DELANTE", b="EN ORDEN DE ESTABILIDAD",
                    changes=", cambian cada semana", rec="se recalcula: %s tokens", kept="se lee de la caché"),
         False: dict(a="FAQ FIRST", b="IN ORDER OF STABILITY",
                     changes=", changes weekly", rec="recomputed: %s tokens", kept="read from the cache")}[es]
    names = GROUP_NAME[es]
    X0, W = 60, 640
    k = W / POLICIES
    b = []

    def bar(top, order, title):
        b.append(text(20, top, title, "hd"))
        y = top + 52
        x = X0
        segs = []
        for key in order:
            t = dict(GROUPS)[key]
            w = t * k
            segs.append((key, x, w, t))
            x += w
        changed_at = next(sx for key, sx, _, _ in segs if key == "faq")
        for i, (key, sx, w, t) in enumerate(segs):
            after = sx >= changed_at
            cls = "w" if key == "faq" else ("x" if after else "m")
            b.append(box(sx + 1, y, w - 2, 24, cls, rx=3))
            b.append(text(sx + w / 2, y + 16, num(t, es), "tx", "middle"))
            nm = names[key]
            if key == "acuerdos":      # narrow: on the top level, with a tick down to its segment
                b.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s"/>' % (sx + w / 2, y - 31, sx + w / 2, y - 2, LINE))
                b.append(text(sx + w / 2, y - 34, nm, "sb"))
            elif key == "faq":         # the one that changes: middle level, starting at its segment
                b.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s"/>' % (sx + 6, y - 17, sx + 6, y - 2, WARN))
                b.append(text(sx + 1, y - 20, nm + (L["changes"] if sx == X0 else ""), "sb w", "start"))
            else:
                b.append(text(sx + w / 2, y - 6, nm, "sb"))
        # what the change costs
        recomputed = sum(t for key, sx, _, t in segs if sx >= changed_at)
        b.append(bracket(changed_at + 1, X0 + W - 1, y + 30, cls="br x"))
        b.append(text((changed_at + X0 + W) / 2, y + 48, L["rec"] % num(recomputed, es), "tx x", "middle"))
        if changed_at > X0:
            b.append(bracket(X0 + 1, changed_at - 1, y + 30, cls="br m"))
            b.append(text((X0 + changed_at) / 2, y + 48, L["kept"], "tx m", "middle"))
        fx = next(sx + w / 2 for key, sx, w, _ in segs if key == "faq")
        return fx

    order_a = ["faq", "planes", "facturacion", "privacidad", "acuerdos"]
    order_b = [g for g, _ in GROUPS]
    bar(18, order_a, L["a"])
    bar(142, order_b, L["b"])
    return svg(760, 268, ARIA_ORDER[es], b)


# ─── 4. coste-acumulado ───────────────────────────────────────────────────────────────────────

def aria_cost(es):
    sin, cag, rag = cumulative()
    if es:
        return ("Gráfico de líneas del coste acumulado del conocimiento en las primeras %d preguntas, en tokens de "
                "entrada equivalentes. Todo en el contexto sin caché sube %s por pregunta y llega a %s. CAG empieza "
                "en %s por la escritura de la caché y sube %s por pregunta, hasta %s. RAG con cuatro fragmentos sube "
                "%s por pregunta, hasta %s. CAG queda por debajo de la versión sin caché desde la segunda pregunta, "
                "y su pendiente es casi la de RAG."
                % (N_QUESTIONS, num(POLICIES, es), num(sin[-1], es), num(int(cag[0]), es),
                   num(int(POLICIES * READ), es), num(int(cag[-1]), es), num(RAG_TOKENS, es), num(rag[-1], es)))
    return ("Line chart of the cumulative cost of the knowledge over the first %d questions, in equivalent input "
            "tokens. Everything in context without a cache climbs %s per question and reaches %s. CAG starts at %s "
            "for the cache write and climbs %s per question, to %s. RAG with four fragments climbs %s per question, "
            "to %s. CAG drops below the uncached version from the second question on, and its slope is close to "
            "RAG's."
            % (N_QUESTIONS, num(POLICIES, es), num(sin[-1], es), num(int(cag[0]), es),
               num(int(POLICIES * READ), es), num(int(cag[-1]), es), num(RAG_TOKENS, es), num(rag[-1], es)))


def fig_cost(es):
    sin, cag, rag = cumulative()
    L = {True: dict(x="preguntas", y="tokens de entrada equivalentes, acumulados",
                    sin="Todo en el contexto, sin caché", cag="CAG", rag="RAG, 4 fragmentos",
                    cross="desde la 2.ª pregunta, CAG cuesta menos"),
         False: dict(x="questions", y="equivalent input tokens, cumulative",
                     sin="Everything in context, no cache", cag="CAG", rag="RAG, 4 fragments",
                     cross="from question 2 on, CAG costs less")}[es]
    PX0, PX1, PY0, PY1 = 78, 540, 34, 254
    vmax = 700000

    def X(n):
        return PX0 + (PX1 - PX0) * (n - 1) / (N_QUESTIONS - 1)

    def Y(v):
        return PY1 - (PY1 - PY0) * v / vmax

    b = []
    for t in (0, 200000, 400000, 600000):
        b.append('<line x1="%d" y1="%.1f" x2="%d" y2="%.1f" stroke="%s"/>' % (PX0, Y(t), PX1, Y(t), GRID))
        b.append(text(PX0 - 8, Y(t) + 4, num(t, es), "sb", "end"))
    for n in (1, 5, 10, 15, 20):
        b.append(text(X(n), PY1 + 16, str(n), "sb"))
    b.append(text((PX0 + PX1) / 2, PY1 + 32, L["x"], "sb"))
    b.append(text(PX0 - 8, PY0 - 14, L["y"], "sb", "start"))
    b.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s"/>' % (PX0, PY1, PX1, PY1, LINE))

    def path(vals, color, dash=""):
        d = "M" + " L".join("%.1f,%.1f" % (X(i + 1), Y(v)) for i, v in enumerate(vals))
        da = ' stroke-dasharray="%s"' % dash if dash else ""
        return ('<path d="%s" fill="none" stroke="%s" stroke-width="2" stroke-linejoin="round" '
                'stroke-linecap="round"%s/>' % (d, color, da))

    b.append(path(sin, C_SIN, "6 4"))
    b.append(path(rag, C_RAG))
    b.append(path(cag, C_CAG))
    # the first two questions, where the write is paid and then recovered
    for n in (1, 2):
        for vals, c in ((sin, C_SIN), (cag, C_CAG)):
            b.append('<circle cx="%.1f" cy="%.1f" r="4" fill="%s" stroke="%s" stroke-width="2"/>'
                     % (X(n), Y(vals[n - 1]), c, SURF))
    b.append(arrow([(X(2) + 40, Y(cag[1]) - 52), (X(2) + 6, Y(cag[1]) - 8)]))
    b.append(text(X(2) + 44, Y(cag[1]) - 56, L["cross"], "tx d", "start"))
    # direct labels at the line ends (text in ink, a colour swatch for identity)
    for vals, c, name in ((sin, C_SIN, L["sin"]), (cag, C_CAG, L["cag"]), (rag, C_RAG, L["rag"])):
        y = Y(vals[-1])
        if vals is rag:
            y += 6
        if vals is cag:
            y -= 12
        b.append('<rect x="%d" y="%.1f" width="10" height="3" rx="1.5" fill="%s"/>' % (PX1 + 12, y - 4, c))
        b.append(text(PX1 + 28, y, name, "tx", "start"))
        b.append(text(PX1 + 28, y + 14, num(int(vals[-1]), es), "tx d", "start"))
    return svg(760, 300, aria_cost(es), b)


# ─── 5. prompt-en-capas ───────────────────────────────────────────────────────────────────────

ARIA_LAYERS = {
    True: "El prompt del asistente de Albarán como una barra dividida en capas, de izquierda a derecha. Primero, "
          "lo que se lee de la caché: las instrucciones del asistente, 1 500 tokens; las definiciones de "
          "herramientas, 800; y las políticas en orden de estabilidad, 32 000, con las preguntas frecuentes al "
          "final. Una marca señala dónde acaba el prefijo en caché. Después, lo que cambia en cada pregunta: la "
          "fecha, la conversación y la pregunta. Debajo, una flecha sale del modelo hacia una herramienta, "
          "buscar_incidencia 4812, que consulta la base de datos de incidencias; su resultado se añade al final "
          "del prompt, detrás de la pregunta.",
    False: "Albarán's assistant prompt as a bar divided into layers, from left to right. First, what is read "
           "from the cache: the assistant's instructions, 1,500 tokens; the tool definitions, 800; and the "
           "policies in order of stability, 32,000, with the FAQ last. A marker shows where the cached prefix "
           "ends. Then, what changes with every question: the date, the conversation and the question. Below, "
           "an arrow goes from the model to a tool, find_ticket 4812, which queries the ticket "
           "database; its result is appended to the end of the prompt, after the question.",
}


def fig_layers(es):
    L = {True: dict(cached="SE LEE DE LA CACHÉ", varies="CAMBIA EN CADA PREGUNTA",
                    ins="Instrucciones", ins2="1 500", tools="Herramientas", tools2="800",
                    pol="Políticas, en orden de estabilidad", pol2="32 000 · preguntas frecuentes al final",
                    end="fin del prefijo", date="Fecha", conv="Conversación", q="Pregunta", res="Resultado",
                    model="Modelo", tool="buscar_incidencia(4812)", db="Base de datos", db2="de incidencias",
                    calls="la pregunta lo necesita", back="se añade al final"),
         False: dict(cached="READ FROM THE CACHE", varies="CHANGES WITH EVERY QUESTION",
                     ins="Instructions", ins2="1,500", tools="Tools", tools2="800",
                     pol="Policies, in order of stability", pol2="32,000 · FAQ last",
                     end="end of prefix", date="Date", conv="Conversation", q="Question", res="Result",
                     model="Model", tool="find_ticket(4812)", db="Ticket", db2="database",
                     calls="the question needs it", back="appended at the end")}[es]
    b = []
    y = 44
    # cached part
    b.append(bracket(20, 450, 30, cls="br m"))
    b.append(text(235, 22, L["cached"], "hd", "middle"))
    b.append(labelled(20, y, 96, 44, L["ins"], L["ins2"], "m"))
    b.append(labelled(122, y, 92, 44, L["tools"], L["tools2"], "m"))
    b.append(labelled(220, y, 230, 44, L["pol"], L["pol2"], "m"))
    # end of the cached prefix
    b.append('<line x1="460" y1="%d" x2="460" y2="%d" stroke="%s" stroke-width="2"/>' % (y - 10, y + 54, ACC))
    b.append(text(460, y + 68, L["end"], "sb m"))
    # per-question part
    b.append(bracket(470, 748, 30, cls="br w"))
    b.append(text(609, 22, L["varies"], "hd", "middle"))
    b.append(labelled(470, y, 44, 44, L["date"], None, "w"))
    b.append(labelled(520, y, 86, 44, L["conv"], None, "w"))
    b.append(labelled(612, y, 62, 44, L["q"], None, "w"))
    b.append(labelled(680, y, 68, 44, L["res"], None, "d"))
    # the tool loop below
    my = 160
    b.append(labelled(250, my, 110, 40, L["model"], None))
    b.append(arrow([(305, y + 46), (305, my - 2)]))  # the model reads the whole prompt
    b.append(box(410, my, 170, 40, "", rx=6))
    b.append(text(495, my + 24, L["tool"], "mo", "middle"))
    b.append(arrow([(360, my + 20), (408, my + 20)]))
    b.append(text(384, my + 56, L["calls"], "sb"))
    b.append(labelled(620, my, 120, 40, L["db"], L["db2"]))
    b.append(arrow([(580, my + 20), (618, my + 20)]))
    b.append(arrow([(690, my), (690, 128), (714, 128), (714, y + 46)], "ar w"))
    b.append(text(682, 124, L["back"], "sb w", "end"))
    return svg(760, 230, ARIA_LAYERS[es], b)


if __name__ == "__main__":
    write("prefill-decode", fig_prefill(True), fig_prefill(False))
    write("rag-frente-a-cag", fig_pipes(True), fig_pipes(False))
    write("orden-del-prefijo", fig_order(True), fig_order(False))
    write("coste-acumulado", fig_cost(True), fig_cost(False))
    write("prompt-en-capas", fig_layers(True), fig_layers(False))
    sin, cag, rag = cumulative()
    print("after %d questions: sin %d · cag %d · rag %d" % (N_QUESTIONS, sin[-1], cag[-1], rag[-1]))
