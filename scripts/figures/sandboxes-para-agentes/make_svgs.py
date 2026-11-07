"""BLOG-23 — Figures for the blog post `sandboxes-para-agentes`. All three are diagrams: no
measured or cited numbers are drawn. Same palette and helpers as the first sandbox post
(scripts/figures/que-es-un-sandbox/make_svgs.py), so the two posts read as one series.
Run from this directory: python3 make_svgs.py ../../../public/blog/sandboxes-para-agentes
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

Every figure's aria-label is the `alt` of its <img> in content/blog/{es,en}/sandboxes-para-agentes.mdx,
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
  .lb {{ font-size: 12px; font-weight: 600; text-anchor: middle; }}
  .sb {{ font-size: 10.5px; fill: {MUTED}; text-anchor: middle; }}
  .tx {{ font-size: 11px; }}
  .hd {{ font-size: 10px; fill: {MUTED}; letter-spacing: 0.1em; }}
  .m {{ fill: {ACC}; }}
  .w {{ fill: {WARN}; }}
  .x {{ fill: {BAD}; }}
  .ln {{ fill: none; stroke: {LINE}; stroke-width: 1.5; }}
  .ln.x {{ stroke: {BAD}; stroke-dasharray: 4 3; }}
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


def seg(x1, y1, x2, y2, cls="ln"):
    return '<path class="%s" d="M%.1f,%.1f L%.1f,%.1f"/>' % (cls, x1, y1, x2, y2)


def write(name, es_svg, en_svg):
    for suffix, content in ((".svg", es_svg), (".en.svg", en_svg)):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(content)


# ─── 1. triada ────────────────────────────────────────────────────────────────────────────────

ARIA_TRI = {
    True: "La tríada letal, como un triángulo. En los vértices, los tres ingredientes: el contenido no fiable "
          "(issues, páginas web, ficheros del repositorio), los datos privados (claves, tokens, código privado) "
          "y la comunicación externa (la red, una petición de cambios, un correo). Con los tres a la vez, una "
          "inyección puede leer algo y enviarlo fuera. Junto a cada vértice, cómo se corta: el contenido no fiable "
          "casi nunca se puede quitar, porque leerlo es el trabajo; los datos privados se quitan no montando el "
          "directorio personal y dejando los secretos fuera; la comunicación externa, con la red cerrada o un "
          "proxy con una lista de dominios.",
    False: "The lethal trifecta, as a triangle. At the corners, the three ingredients: untrusted content (issues, "
           "web pages, files in the repository), private data (keys, tokens, private code) and external "
           "communication (the network, a pull request, an email). With all three at once, an injection can read "
           "something and send it out. Next to each corner, how to cut it: untrusted content can rarely be "
           "removed, because reading it is the job; private data is removed by not mounting the home directory "
           "and keeping secrets outside; external communication, with the network closed or a proxy with a list "
           "of domains.",
}


def fig_triada(es):
    L = {True: dict(top=("Contenido no fiable", "issues, webs, ficheros del repo"),
                    left=("Datos privados", "claves, tokens, código privado"),
                    right=("Comunicación externa", "red, petición de cambios, correo"),
                    mid=["Los tres a la vez:", "una inyección lee algo", "y lo envía fuera"],
                    cut="CÓMO SE CORTA",
                    ctop=["Casi nunca se puede quitar:", "leerlo es el trabajo."],
                    cleft=["No montar el directorio personal;", "los secretos, fuera del sandbox."],
                    cright=["Red cerrada, o un proxy", "con una lista de dominios."]),
         False: dict(top=("Untrusted content", "issues, web pages, repo files"),
                     left=("Private data", "keys, tokens, private code"),
                     right=("External communication", "network, pull request, email"),
                     mid=["All three at once:", "an injection reads something", "and sends it out"],
                     cut="HOW TO CUT IT",
                     ctop=["Can rarely be removed:", "reading it is the job."],
                     cleft=["Don't mount the home directory;", "keep secrets outside the sandbox."],
                     cright=["Closed network, or a proxy", "with a list of domains."])}[es]
    b = []
    # corners
    b.append(labelled(280, 20, 200, 52, L["top"][0], L["top"][1], "w"))
    b.append(labelled(60, 176, 200, 52, L["left"][0], L["left"][1], "x"))
    b.append(labelled(500, 176, 200, 52, L["right"][0], L["right"][1], "x"))
    # edges
    b.append(seg(310, 72, 200, 176))
    b.append(seg(450, 72, 560, 176))
    b.append(seg(260, 202, 500, 202))
    b.append(lines(380, 124, L["mid"], "sb", step=14))
    # how each corner is cut
    b.append(text(740, 26, L["cut"], "hd", "end"))
    b.append(lines(496, 44, L["ctop"], "tx", "start"))
    b.append(lines(160, 248, L["cleft"], "sb m"))
    b.append(lines(600, 248, L["cright"], "sb m"))
    return svg(760, 272, ARIA_TRI[es], b)


# ─── 2. proxy (cover) ─────────────────────────────────────────────────────────────────────────

ARIA_PROXY = {
    True: "La política de un agente local, dibujada. A la izquierda, dentro de una línea discontinua que marca la "
          "frontera del sandbox, el agente y las órdenes que ejecuta. Dentro sólo hay la carpeta de trabajo, en "
          "lectura y escritura; el directorio personal no está, y la red se reduce a la interfaz local. La única "
          "salida es un socket Unix hacia un proxy que se ejecuta fuera del sandbox. El proxy compara cada destino "
          "con una lista de dominios: deja pasar el registro de paquetes y rechaza un dominio desconocido. Encima "
          "del proxy, una persona aprueba los dominios nuevos; debajo, las credenciales, que se añaden a la "
          "petición en el proxy y nunca entran en el sandbox.",
    False: "A local agent's policy, drawn. On the left, inside a dashed line that marks the sandbox boundary, the "
           "agent and the commands it runs. Inside there is only the working folder, read and write; the home "
           "directory is not there, and the network is just the loopback interface. The only way out is a Unix "
           "socket to a proxy that runs outside the sandbox. The proxy checks every destination against a list "
           "of domains: it lets the package registry through and refuses an unknown domain. Above the proxy, a "
           "person approves new domains; below it, the credentials, which are added to the request at the proxy "
           "and never enter the sandbox.",
}


def fig_proxy(es):
    L = {True: dict(border="SANDBOX", agent="Agente", agent2="y las órdenes que ejecuta",
                    rows=[("Carpeta de trabajo", "lectura y escritura", "m"),
                          ("Directorio personal", "no está", "x"),
                          ("Red", "sólo la interfaz local", "x")],
                    sock="socket Unix", proxy="Proxy", proxy2="lista de dominios",
                    human="Una persona", human2="aprueba un dominio nuevo",
                    cred="Credenciales", cred2="se añaden aquí, fuera",
                    ok="registro de paquetes", bad="dominio desconocido", outside="FUERA DEL SANDBOX"),
         False: dict(border="SANDBOX", agent="Agent", agent2="and the commands it runs",
                     rows=[("Working folder", "read and write", "m"),
                           ("Home directory", "not there", "x"),
                           ("Network", "loopback only", "x")],
                     sock="Unix socket", proxy="Proxy", proxy2="list of domains",
                     human="A person", human2="approves a new domain",
                     cred="Credentials", cred2="added here, outside",
                     ok="package registry", bad="unknown domain", outside="OUTSIDE THE SANDBOX")}[es]
    b = []
    b.append(box(20, 30, 300, 216, "d", 10))
    b.append(text(32, 48, L["border"], "hd", "start"))
    b.append(labelled(40, 60, 170, 48, L["agent"], L["agent2"], "x"))
    for i, (name, rule, cls) in enumerate(L["rows"]):
        y = 128 + i * 38
        b.append(box(40, y, 170, 30))
        b.append(text(125, y + 13, name, "lb"))
        b.append(text(125, y + 25, rule, "sb " + cls))
    # the only way out
    b.append(arrow([(210, 84), (346, 84), (346, 138), (392, 138)], "ar w"))
    b.append(text(266, 76, L["sock"], "sb w"))
    b.append(text(560, 20, L["outside"], "hd"))
    b.append(labelled(396, 112, 150, 52, L["proxy"], L["proxy2"], "w"))
    b.append(labelled(396, 30, 150, 44, L["human"], L["human2"]))
    b.append(arrow([(471, 74), (471, 108)]))
    b.append(labelled(396, 200, 150, 44, L["cred"], L["cred2"], "m"))
    b.append(arrow([(471, 200), (471, 168)], "ar m"))
    b.append(labelled(600, 92, 140, 36, L["ok"], None, "m"))
    b.append(labelled(600, 150, 140, 36, L["bad"], None, "x"))
    b.append(arrow([(546, 130), (572, 130), (572, 110), (596, 110)], "ar m"))
    b.append(arrow([(546, 146), (572, 146), (572, 168), (596, 168)], "ar x"))
    return svg(760, 262, ARIA_PROXY[es], b)


# ─── 3. diferido ──────────────────────────────────────────────────────────────────────────────

ARIA_DEF = {
    True: "Una escritura permitida que se ejecuta después, fuera. A la izquierda, dentro del sandbox, hoy: el "
          "agente escribe un fichero en la carpeta de trabajo, un gancho de git en .git/hooks/pre-commit, y la "
          "política lo permite porque está dentro de la carpeta. El fichero se queda en el disco y cruza la "
          "frontera sin que nadie lo revise. A la derecha, fuera del sandbox, mañana: haces git commit en tu "
          "terminal, git ejecuta el gancho con tus permisos, y el gancho llega a todo lo que llegas tú: el "
          "directorio personal, las claves y la red.",
    False: "An allowed write that runs later, outside. On the left, inside the sandbox, today: the agent writes "
           "a file in the working folder, a git hook in .git/hooks/pre-commit, and the policy allows it because "
           "it is inside the folder. The file stays on disk and crosses the boundary without anyone reviewing "
           "it. On the right, outside the sandbox, tomorrow: you run git commit in your terminal, git runs the "
           "hook with your permissions, and the hook reaches everything you can: the home directory, the keys "
           "and the network.",
}


def fig_diferido(es):
    L = {True: dict(inside="DENTRO DEL SANDBOX, HOY", outside="FUERA, MAÑANA",
                    agent="Agente", agent2="escribe en la carpeta",
                    file=".git/hooks/pre-commit", file2="permitido: está dentro",
                    cross=["cruza la frontera", "sin revisión"],
                    you="Tú: git commit", you2="en tu terminal",
                    hook="git ejecuta el gancho", hook2="con tus permisos",
                    reach="Claves, ficheros, red", reach2="todo lo que alcanzas tú"),
         False: dict(inside="INSIDE THE SANDBOX, TODAY", outside="OUTSIDE, TOMORROW",
                     agent="Agent", agent2="writes in the folder",
                     file=".git/hooks/pre-commit", file2="allowed: it's inside",
                     cross=["crosses the boundary", "unreviewed"],
                     you="You: git commit", you2="in your terminal",
                     hook="git runs the hook", hook2="with your permissions",
                     reach="Keys, files, network", reach2="everything you can reach")}[es]
    b = []
    b.append(box(20, 30, 250, 170, "d", 10))
    b.append(text(32, 48, L["inside"], "hd", "start"))
    b.append(labelled(55, 62, 180, 44, L["agent"], L["agent2"], "x"))
    b.append(arrow([(145, 106), (145, 128)]))
    b.append(labelled(55, 132, 180, 48, L["file"], L["file2"], "m"))
    b.append(arrow([(235, 156), (392, 156)], "ar w"))
    b.append(lines(332, 134, L["cross"], "sb w"))
    b.append(text(560, 26, L["outside"], "hd"))
    b.append(labelled(396, 40, 150, 44, L["you"], L["you2"]))
    b.append(arrow([(471, 84), (471, 130)]))
    b.append(labelled(396, 134, 150, 46, L["hook"], L["hook2"], "w"))
    b.append(arrow([(546, 157), (582, 157)], "ar x"))
    b.append(labelled(586, 128, 160, 58, L["reach"], L["reach2"], "x"))
    return svg(760, 214, ARIA_DEF[es], b)


if __name__ == "__main__":
    write("triada", fig_triada(True), fig_triada(False))
    write("proxy", fig_proxy(True), fig_proxy(False))
    write("diferido", fig_diferido(True), fig_diferido(False))
