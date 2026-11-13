"""BLOG-25 — Figures for the blog post `ia-y-problema-de-la-parada`. All diagrams, no measured numbers.
`portada` is the index card's cover only; it does not appear in the article.
Run from this directory: python3 make_svgs.py ../../../public/blog/ia-y-problema-de-la-parada
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies. Same style helpers as
scripts/figures/problema-de-la-parada/make_svgs.py (the first post of the series).

Every figure's aria-label is the `alt` of its <img> in content/blog/{es,en}/ia-y-problema-de-la-parada.mdx,
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



# ─── 1. donde-entra ───────────────────────────────────────────────────────────────────────────

ARIA_DONDE = {
    True: "Tres cajas de izquierda a derecha, de lo que siempre termina a lo que puede no terminar. A la "
          "izquierda, una pasada del modelo: un circuito fijo que siempre termina; saber qué hará con un "
          "conjunto de entradas es decidible, aunque NP-completo. En el centro, la cadena de pensamiento: "
          "muchas pasadas seguidas, con un tope de tokens, así que también termina; cuantos más pasos, más "
          "problemas alcanza, y con un número polinómico de pasos resuelve exactamente los de la clase P. "
          "Las dos son cuestión de complejidad. A la derecha, el agente: un bucle con herramientas que puede "
          "escribir y ejecutar código, sin tope, que equivale a una máquina universal; ahí empieza la "
          "computabilidad, y preguntas como si terminará o si borrará algo caen bajo el teorema de Rice.",
    False: "Three boxes from left to right, from what always halts to what may not. On the left, one pass of "
           "the model: a fixed circuit that always halts; knowing what it will do on a set of inputs is "
           "decidable, though NP-complete. In the middle, chain of thought: many passes in a row, with a token "
           "cap, so it halts too; the more steps, the more problems it reaches, and with a polynomial number "
           "of steps it solves exactly the problems in the class P. Both are a matter of complexity. On the "
           "right, the agent: a loop with tools that can write and run code, with no cap, which amounts to a "
           "universal machine; this is where computability begins, and questions such as whether it will "
           "halt or delete something fall under Rice's theorem.",
}


def fig_donde(es):
    L = {True: dict(hc="COMPLEJIDAD: SIEMPRE TERMINA", hk="COMPUTABILIDAD",
                    a=("Una pasada", "circuito fijo"), an=["siempre termina;", "verificarla es decidible,", "aunque NP-completo"],
                    b=("Cadena de pensamiento", "muchas pasadas, con tope"), bn=["más pasos, más problemas;", "con pasos polinómicos,", "exactamente P"],
                    c=("Agente", "bucle, herramientas, código"), cn=["sin tope: máquina universal;", "si terminará o borrará algo", "es indecidible (Rice)"]),
         False: dict(hc="COMPLEXITY: ALWAYS HALTS", hk="COMPUTABILITY",
                     a=("One pass", "a fixed circuit"), an=["always halts;", "verifying it is decidable,", "though NP-complete"],
                     b=("Chain of thought", "many passes, capped"), bn=["more steps, more problems;", "with polynomial steps,", "exactly P"],
                     c=("Agent", "loop, tools, code"), cn=["no cap: a universal machine;", "whether it halts or deletes", "something is undecidable (Rice)"])}[es]
    b = []
    b.append(text(260, 30, L["hc"], "hd m", "middle"))
    b.append(path([(40, 40), (480, 40)], "ln m"))
    b.append(text(630, 30, L["hk"], "hd x", "middle"))
    b.append(path([(520, 40), (740, 40)], "ln x"))
    b.append(labelled(40, 62, 180, 56, L["a"][0], L["a"][1], "m"))
    b.append(lines(130, 142, L["an"], "sb"))
    b.append(arrow([(222, 90), (288, 90)]))
    b.append(labelled(290, 62, 190, 56, L["b"][0], L["b"][1], "m"))
    b.append(lines(385, 142, L["bn"], "sb"))
    b.append(arrow([(482, 90), (538, 90)]))
    b.append(labelled(540, 62, 200, 56, L["c"][0], L["c"][1], "x"))
    b.append(lines(640, 142, L["cn"], "sb"))
    return svg(760, 200, ARIA_DONDE[es], b)


# ─── 2. proponer-comprobar ────────────────────────────────────────────────────────────────────

ARIA_PROP = {
    True: "Un bucle entre dos cajas. A la izquierda, el modelo de lenguaje, que puede equivocarse: recibe el "
          "programa y propone un veredicto junto con un certificado, como una función de ranking, una "
          "demostración o código acompañado de su prueba. A la derecha, el comprobador, que siempre termina: "
          "un solucionador SMT, un demostrador de teoremas o un verificador. Si acepta el certificado, la "
          "conclusión es segura aunque el modelo no sea de fiar. Si lo rechaza, devuelve al modelo el error o "
          "un contraejemplo, y el modelo lo intenta otra vez. Cuando se acaba el presupuesto de intentos, la "
          "respuesta es no lo sé.",
    False: "A loop between two boxes. On the left, the language model, which can be wrong: it takes the "
           "program and proposes a verdict together with a certificate, such as a ranking function, a proof "
           "or code with its proof. On the right, the checker, which always halts: an SMT solver, a theorem "
           "prover or a verifier. If it accepts the certificate, the conclusion is certain even though the "
           "model cannot be trusted. If it rejects it, it sends the error or a counterexample back to the "
           "model, which tries again. When the budget of attempts runs out, the answer is I don't know.",
}


def fig_proponer(es):
    L = {True: dict(prog="programa", hd1="PUEDE EQUIVOCARSE", hd2="SIEMPRE TERMINA",
                    m="Modelo de lenguaje", m2="propone",
                    cert="veredicto + certificado", cert2=["ranking, demostración,", "código con su prueba"],
                    c="Comprobador", c2="SMT, demostrador, verificador",
                    ok="acepta", ok2="conclusión segura",
                    no="rechaza: error o contraejemplo",
                    out="se acaba el presupuesto", out2="«no lo sé»"),
         False: dict(prog="program", hd1="CAN BE WRONG", hd2="ALWAYS HALTS",
                     m="Language model", m2="proposes",
                     cert="verdict + certificate", cert2=["ranking function, proof,", "code with its proof"],
                     c="Checker", c2="SMT, prover, verifier",
                     ok="accepts", ok2="certain conclusion",
                     no="rejects: error or counterexample",
                     out="budget runs out", out2="“I don't know”")}[es]
    b = []
    b.append(text(10, 102, L["prog"], "tx", "start"))
    b.append(arrow([(70, 98), (100, 98)]))
    b.append(text(104, 50, L["hd1"], "hd w", "start"))
    b.append(labelled(104, 64, 180, 68, L["m"], L["m2"], "w"))
    b.append(arrow([(286, 98), (430, 98)], "ar"))
    b.append(text(358, 88, L["cert"], "sb"))
    b.append(lines(358, 116, L["cert2"], "sb"))
    b.append(text(432, 50, L["hd2"], "hd m", "start"))
    b.append(labelled(432, 64, 180, 68, L["c"], L["c2"], "m"))
    b.append(arrow([(614, 80), (628, 80), (628, 58), (640, 58)], "ar m"))
    b.append(text(646, 54, L["ok"], "lb m", "start"))
    b.append(text(646, 68, L["ok2"], "sb", "start"))
    # rejected: back to the model, with the error
    b.append(arrow([(522, 134), (522, 186), (230, 186), (230, 136)], "ar w"))
    b.append(text(376, 204, L["no"], "sb w"))
    # out of budget
    b.append(arrow([(150, 134), (150, 220)], "ar"))
    b.append(text(160, 214, L["out"], "sb", "start"))
    b.append(text(160, 236, L["out2"], "lb", "start"))
    return svg(760, 250, ARIA_PROP[es], b)


# ─── 3. trilema-ia ────────────────────────────────────────────────────────────────────────────

ARIA_TRI = {
    True: "Un triángulo con una propiedad en cada vértice: general, que funciona con cualquier programa; "
          "total, que siempre contesta; y exacto, que nunca se equivoca. En el centro, en rojo, una "
          "inteligencia artificial que verificase cualquier programa, siempre y sin error, que no existe. "
          "Cada lado renuncia a una propiedad. Entre general y total, renunciando a la exactitud: un modelo "
          "que siempre da un veredicto y una mejora que se acepta porque aprueba un banco de pruebas. Entre "
          "general y exacto, renunciando a contestar siempre: el modelo que propone un certificado que "
          "comprueba otro programa, el que contesta no lo sé y el límite de pasos de un agente. Entre total "
          "y exacto, renunciando a la generalidad: verificar una red concreta, que es finita, y el sandbox, "
          "que restringe lo que el agente puede hacer en lugar de predecirlo.",
    False: "A triangle with one property at each corner: general, it works on any program; total, it always "
           "answers; and exact, it is never wrong. In the middle, in red, an artificial intelligence that "
           "verified any program, always and without error, which does not exist. Each side gives up one "
           "property. Between general and total, giving up exactness: a model that always returns a verdict, "
           "and an improvement accepted because it passes a benchmark. Between general and exact, giving up "
           "always answering: the model that proposes a certificate another program checks, the one that "
           "answers I don't know, and an agent's step limit. Between total and exact, giving up generality: "
           "verifying one particular network, which is finite, and the sandbox, which restricts what the "
           "agent can do instead of predicting it.",
}


def fig_trilema(es):
    L = {True: dict(g=("General", "cualquier programa"), t=("Total", "siempre contesta"),
                    e=("Exacto", "nunca se equivoca"), c1="verificarlo", c2="todo, siempre", c3="no existe",
                    left=("SIN EXACTITUD", ["el modelo que siempre", "da un veredicto;", "aprobar un banco", "de pruebas"]),
                    right=("SIN CONTESTAR SIEMPRE", ["proponer y comprobar,", "«no lo sé»,", "límite de pasos", "del agente"]),
                    bottom=("SIN GENERALIDAD", "verificar una red concreta; el sandbox: restringir, no predecir")),
         False: dict(g=("General", "any program"), t=("Total", "always answers"),
                     e=("Exact", "never wrong"), c1="verify", c2="everything, always", c3="does not exist",
                     left=("NOT EXACT", ["the model that always", "returns a verdict;", "passing a", "benchmark"]),
                     right=("DOES NOT ALWAYS ANSWER", ["propose and check,", "“I don't know”,", "the agent's", "step limit"]),
                     bottom=("NOT GENERAL", "verifying one network; the sandbox: restrict, don't predict"))}[es]
    T, BL, BR = (380, 62), (210, 300), (550, 300)
    b = []
    b.append(path([T, BL], "ln w"))
    b.append(path([T, BR], "ln m"))
    b.append(path([BL, BR], "ln m"))
    b.append(labelled(T[0] - 80, T[1] - 30, 160, 44, L["g"][0], L["g"][1], "o"))
    b.append(labelled(BL[0] - 100, BL[1] - 4, 170, 44, L["t"][0], L["t"][1], "o"))
    b.append(labelled(BR[0] - 70, BR[1] - 4, 170, 44, L["e"][0], L["e"][1], "o"))
    cx, cy = 380, 205
    b.append(box(cx - 58, cy - 28, 116, 56, "x", 8))
    b.append(text(cx, cy - 9, L["c1"], "lb x"))
    b.append(text(cx, cy + 5, L["c2"], "lb x"))
    b.append(text(cx, cy + 20, L["c3"], "sb"))
    b.append(text(150, 140, L["left"][0], "hd w", "end"))
    b.append(lines(150, 156, L["left"][1], "tx", "end"))
    b.append(text(610, 140, L["right"][0], "hd m", "start"))
    b.append(lines(610, 156, L["right"][1], "tx", "start"))
    b.append(text(380, 372, L["bottom"][0], "hd m", "middle"))
    b.append(text(380, 388, L["bottom"][1], "tx", "middle"))
    b.append(path([(158, 166), (285, 182)], "ln w"))
    b.append(path([(602, 166), (475, 182)], "ln m"))
    b.append(path([(380, 360), (380, 302)], "ln m"))
    return svg(760, 400, ARIA_TRI[es], b)


# ─── 4. portada (cover only, not in the article) ─────────────────────────────────────────────

ARIA_PORTADA = {
    True: "El bucle de un agente: el modelo, que siempre termina, y la ejecución de código, unidos por un "
          "ciclo en cuyo centro está la pregunta de si parará. Del bucle sale una propuesta hacia un "
          "comprobador que siempre termina y da una conclusión segura o contesta no lo sé.",
    False: "An agent's loop: the model, which always halts, and code execution, joined by a cycle with the "
           "question of whether it will halt at its centre. From the loop a proposal goes to a checker that "
           "always halts and gives a certain conclusion or answers I don't know.",
}


def big(x, y, s, size, fill=TXT, weight=600, anchor="middle"):
    return ('<text x="%.1f" y="%.1f" style="font-size:%dpx;font-weight:%d;fill:%s;text-anchor:%s">%s</text>'
            % (x, y, size, weight, fill, anchor, esc(s)))


def fig_portada(es):
    L = {True: dict(m="modelo", m2="termina", x="ejecutar código", q="¿parará?", loop="el bucle del agente",
                    p="propone", c="Comprobador", c2="siempre termina", ok="✓ conclusión segura",
                    no="✗ «no lo sé»"),
         False: dict(m="model", m2="halts", x="run code", q="will it halt?", loop="the agent's loop",
                     p="proposes", c="Checker", c2="always halts", ok="✓ certain conclusion",
                     no="✗ “I don't know”")}[es]
    cx, cy, r = 240, 190, 118
    b = []
    arc = '<path d="M%.1f,%.1f A%d,%d 0 0 1 %.1f,%.1f" style="fill:none;stroke:%s;stroke-width:2.5" marker-end="url(#ax)"/>'
    b.append(arc % (330.4, 114.2, r, r, 330.4, 265.8, BAD))
    b.append(arc % (149.6, 265.8, r, r, 149.6, 114.2, BAD))
    b.append(box(150, 46, 180, 60, "m", 8))
    b.append(big(240, 74, L["m"], 22, ACC))
    b.append(big(240, 96, L["m2"], 15, MUTED, 400))
    b.append(box(140, 276, 200, 52, "w", 8))
    b.append(big(240, 309, L["x"], 20, WARN))
    b.append(big(cx, cy + 8, L["q"], 30, BAD, 700))
    b.append(big(cx, cy + 36, L["loop"], 15, MUTED, 400))
    b.append('<path d="M362,190 L466,190" style="fill:none;stroke:%s;stroke-width:2.5" marker-end="url(#a)"/>' % MUTED)
    b.append(big(414, 178, L["p"], 16, MUTED, 400))
    b.append(box(472, 140, 260, 100, "m", 10))
    b.append(big(602, 186, L["c"], 26, ACC, 700))
    b.append(big(602, 214, L["c2"], 15, MUTED, 400))
    b.append(big(480, 282, L["ok"], 18, ACC, 600, "start"))
    b.append(big(480, 310, L["no"], 18, WARN, 600, "start"))
    return svg(760, 380, ARIA_PORTADA[es], b)


if __name__ == "__main__":
    write("donde-entra", fig_donde(True), fig_donde(False))
    write("proponer-comprobar", fig_proponer(True), fig_proponer(False))
    write("trilema-ia", fig_trilema(True), fig_trilema(False))
    write("portada", fig_portada(True), fig_portada(False))
