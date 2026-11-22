"""BLOG-27 — Figures for the blog post `latencia-en-asistentes-de-voz` (voice-assistant latency).
One diagram, `la-cadena`: the five steps of a cascaded voice turn with Twilio's launch targets
under each (A Guide to Core Latency in AI Voice Agents, 17 Nov 2025): 95 ms in (40 + 30 + 25),
350 speech-to-text with end of turn, 375 time to first token, 100 text-to-speech first byte, and
195 for the way back and the hops between services (our subtraction from the 1,115 ms target).
The same constants drive the interactive figure (src/features/blog/figures/latency-budget/model.ts).
Run from this directory: python3 make_svgs.py ../../../public/blog/latencia-en-asistentes-de-voz
-> writes la-cadena.svg (es) and la-cadena.en.svg. Pure Python, no dependencies.

The aria-label is the `alt` of the <img> in content/blog/{es,en}/latencia-en-asistentes-de-voz.mdx,
word for word: change one, change the other."""
import sys, os

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; LINE = "#3b3b3e"
WARN = "#fbbf24"; BAD = "#ffb4ab"; NET = "#3c4a42"; VOICE = "#bbcabf"; CALL = "#10b981"
FONT = "ui-sans-serif, system-ui, sans-serif"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .bx {{ fill: none; stroke: {MUTED}; stroke-width: 1; }}
  .bx.m {{ stroke: {ACC}; fill: rgba(78,222,163,0.08); }}
  .bx.w {{ stroke: {WARN}; fill: rgba(251,191,36,0.10); }}
  .bx.x {{ stroke: {BAD}; fill: rgba(255,180,171,0.08); stroke-dasharray: 4 3; }}
  .lb {{ font-size: 12px; font-weight: 600; text-anchor: middle; }}
  .sb {{ font-size: 10.5px; fill: {MUTED}; text-anchor: middle; }}
  .ms {{ font-size: 13px; font-weight: 700; text-anchor: middle; }}
  .tx {{ font-size: 11px; }}
  .hd {{ font-size: 10px; fill: {MUTED}; letter-spacing: 0.1em; }}
  .m {{ fill: {ACC}; }}
  .w {{ fill: {WARN}; }}
  .x {{ fill: {BAD}; }}
  .ar {{ fill: none; stroke: {MUTED}; stroke-width: 1.2; marker-end: url(#a); }}
  .ar.x {{ stroke: {BAD}; stroke-dasharray: 4 3; marker-end: url(#ax); }}
</style>"""

DEFS = "<defs>" + "".join(
    f'<marker id="{i}" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="7" markerHeight="7" orient="auto-start-reverse">'
    f'<path d="M0,0.5 L7.5,4 L0,7.5 z" fill="{c}"/></marker>'
    for i, c in (("a", MUTED), ("ax", BAD))) + "</defs>"


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


def arrow(x1, y1, x2, y2, cls="ar"):
    return '<path class="%s" d="M%.1f,%.1f L%.1f,%.1f"/>' % (cls, x1, y1, x2, y2)


STEPS_MS = [95, 350, 375, 100, 195]
BAR_FILL = [NET, WARN, ACC, VOICE, NET]

L = {
    "es": {
        "head": "UN TURNO, DESDE QUE EL USUARIO DEJA DE HABLAR",
        "steps": [
            ("Micrófono y red", "la voz llega al servidor", ""),
            ("Fin de turno", "y voz a texto", "w"),
            ("Modelo de lenguaje", "hasta el primer token", "m"),
            ("Síntesis de voz", "hasta el primer audio", ""),
            ("Vuelta y saltos", "entre servicios", ""),
        ],
        "tools": ("Herramientas, RAG, MCP", "cada una, otra vuelta antes de contestar"),
        "total": "1115 ms en total (objetivo de Twilio)",
        "ms": lambda v: f"{v} ms",
        "aria": (
            "La cadena de un asistente de voz en cascada, en cinco pasos de izquierda a derecha, con el "
            "objetivo de Twilio debajo de cada uno. Micrófono y red de ida, 95 ms: la voz llega al servidor. "
            "Fin de turno y voz a texto, 350 ms: se decide que el usuario ha terminado mientras se cierra la "
            "transcripción. Modelo de lenguaje, 375 ms hasta el primer token. Síntesis de voz, 100 ms hasta el "
            "primer audio. Vuelta y saltos entre servicios, 195 ms. Debajo del modelo, en discontinuo, las "
            "herramientas, el RAG y los servidores MCP, cada uno otra vuelta antes de contestar. Una barra "
            "proporcional reparte los 1115 ms del total."
        ),
    },
    "en": {
        "head": "ONE TURN, FROM THE MOMENT THE USER STOPS SPEAKING",
        "steps": [
            ("Microphone and network", "the voice reaches the server", ""),
            ("End of turn", "and speech to text", "w"),
            ("Language model", "to the first token", "m"),
            ("Speech synthesis", "to the first audio", ""),
            ("Way back and hops", "between services", ""),
        ],
        "tools": ("Tools, RAG, MCP", "each one, another round before answering"),
        "total": "1,115 ms in total (Twilio's target)",
        "ms": lambda v: f"{v:,} ms",
        "aria": (
            "The chain of a cascaded voice assistant, in five steps from left to right, with Twilio's target "
            "under each. Microphone and network in, 95 ms: the voice reaches the server. End of turn and speech "
            "to text, 350 ms: the system decides the user has finished while the transcript is closed. Language "
            "model, 375 ms to the first token. Speech synthesis, 100 ms to the first audio. Way back and hops "
            "between services, 195 ms. Below the model, dashed, tools, RAG and MCP servers, each one another "
            "round before answering. A proportional bar splits the 1,115 ms total."
        ),
    },
}


def la_cadena(lang):
    t = L[lang]
    W, H = 760, 300
    bw, gap, x0, y0, bh = 132, 22, 12, 44, 54
    body = [text(x0, 22, t["head"], "hd")]
    centers = []
    for i, ((title, sub, cls), v) in enumerate(zip(t["steps"], STEPS_MS)):
        x = x0 + i * (bw + gap)
        centers.append(x + bw / 2)
        body.append(box(x, y0, bw, bh, cls))
        tcls = {"m": "lb m", "w": "lb w"}.get(cls, "lb")
        body.append(text(x + bw / 2, y0 + 23, title, tcls))
        body.append(text(x + bw / 2, y0 + 39, sub, "sb"))
        body.append(text(x + bw / 2, y0 + bh + 20, t["ms"](v), "ms"))
        if i:
            body.append(arrow(x - gap + 2, y0 + bh / 2, x - 3, y0 + bh / 2))

    # The tools box, under the model: a detour that is another full round.
    cx = centers[2]
    tw, ty, th = 250, 150, 46
    body.append(box(cx - tw / 2, ty, tw, th, "x"))
    body.append(text(cx, ty + 19, t["tools"][0], "lb x"))
    body.append(text(cx, ty + 35, t["tools"][1], "sb"))
    body.append(arrow(cx - 30, y0 + bh + 28, cx - 30, ty - 3, "ar x"))
    body.append(arrow(cx + 30, ty - 1, cx + 30, y0 + bh + 30, "ar x"))

    # Proportional bar of the 1,115 ms.
    by, bh2 = 232, 18
    total = sum(STEPS_MS)
    span = W - 2 * x0
    x = x0
    for v, fill in zip(STEPS_MS, BAR_FILL):
        w = span * v / total
        body.append('<rect x="%.1f" y="%d" width="%.1f" height="%d" fill="%s"/>' % (x, by, w - 1.5, bh2, fill))
        x += w
    body.append(text(W / 2, by + bh2 + 26, t["total"], "lb"))
    return svg(W, H, t["aria"], body)


for lang, suffix in (("es", ""), ("en", ".en")):
    with open(os.path.join(OUT, f"la-cadena{suffix}.svg"), "w") as f:
        f.write(la_cadena(lang))
print("wrote la-cadena.svg, la-cadena.en.svg to", OUT)
