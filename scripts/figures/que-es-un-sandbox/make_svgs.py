"""BLOG-22 — Figures for the blog post `que-es-un-sandbox`. Diagrams, except `superficie`, whose
bars are Table 1 of Anjali, Caraza-Harter and Swift, "Blending Containers and Virtual Machines: A
Study of Firecracker and gVisor" (VEE 2020), copied below as printed: system calls each platform
allows itself towards the host kernel, out of 350 (LXC: "all except 44").
Run from this directory: python3 make_svgs.py ../../../public/blog/que-es-un-sandbox
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

Every figure's aria-label is the `alt` of its <img> in content/blog/{es,en}/que-es-un-sandbox.mdx,
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


def write(name, es_svg, en_svg):
    for suffix, content in ((".svg", es_svg), (".en.svg", en_svg)):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(content)


# ─── 1. monitor ───────────────────────────────────────────────────────────────────────────────

ARIA_MON = {
    True: "Las tres piezas de un sandbox. A la izquierda, dentro de una línea discontinua que marca la frontera, "
          "el código no fiable. Cada petición que hace sale de la frontera y pasa por un punto de control, fuera "
          "de su alcance, que la compara con la política: qué se permite y cuánto. A la derecha, los recursos y "
          "lo que la política decide para cada uno: los ficheros, sólo su directorio; la red, denegada; los "
          "demás procesos, denegados; la CPU y la memoria, con límite.",
    False: "The three parts of a sandbox. On the left, inside a dashed line that marks the boundary, the "
           "untrusted code. Every request it makes leaves the boundary and goes through an enforcement point, "
           "out of its reach, which checks it against the policy: what is allowed, and how much. On the right, "
           "the resources and what the policy decides for each: files, only its own directory; the network, "
           "denied; other processes, denied; CPU and memory, with a limit.",
}


def fig_monitor(es):
    L = {True: dict(code="Código no fiable", code2="lo que se quiere aislar", border="FRONTERA",
                    req="cada petición", ctl="Punto de control", ctl2="compara con la política",
                    reach="fuera del alcance del código",
                    res=[("Ficheros", "sólo su directorio", "m"), ("Red", "denegada", "x"),
                         ("Otros procesos", "denegados", "x"), ("CPU y memoria", "con límite", "w")],
                    pol="POLÍTICA: QUÉ SE PERMITE Y CUÁNTO"),
         False: dict(code="Untrusted code", code2="what you want to isolate", border="BOUNDARY",
                     req="every request", ctl="Enforcement point", ctl2="checks against the policy",
                     reach="out of the code's reach",
                     res=[("Files", "only its own directory", "m"), ("Network", "denied", "x"),
                          ("Other processes", "denied", "x"), ("CPU and memory", "with a limit", "w")],
                     pol="POLICY: WHAT IS ALLOWED, AND HOW MUCH")}[es]
    b = []
    b.append(box(20, 40, 210, 150, "d", 10))
    b.append(text(32, 58, L["border"], "hd", "start"))
    b.append(labelled(45, 85, 160, 60, L["code"], L["code2"], "x"))
    b.append(arrow([(207, 115), (318, 115)]))
    b.append(text(262, 106, L["req"], "sb"))
    b.append(labelled(322, 80, 170, 70, L["ctl"], L["ctl2"], "w"))
    b.append(text(407, 168, L["reach"], "sb"))
    b.append(text(740, 26, L["pol"], "hd", "end"))
    for i, (name, rule, cls) in enumerate(L["res"]):
        y = 40 + i * 40
        b.append(box(560, y, 180, 32))
        b.append(text(650, y + 13, name, "lb"))
        b.append(text(650, y + 26, rule, "sb " + cls))
        b.append(arrow([(494, 115), (520, 115), (520, y + 16), (556, y + 16)], "ar " + cls))
    return svg(760, 206, ARIA_MON[es], b)


# ─── 2. linea-de-tiempo ───────────────────────────────────────────────────────────────────────

# Not to scale: one slot per distinct year. (year, level, es, en); level > 0 above the axis (ideas
# and papers), < 0 below (systems). Labels run right of their stem, so an event inside a label's
# span on the same side must sit on a LOWER level than that label.
EVENTS = [
    (1972, 2, "monitor de referencia", "reference monitor"),
    (1973, 1, "confinamiento", "confinement"),
    (1993, 2, "SFI: «sandboxing»", "SFI: “sandboxing”"),
    (1996, 1, "Janus", "Janus"),
    (2018, 1, "Spectre", "Spectre"),
    (1967, -3, "CP-67", "CP-67"),
    (1969, -2, "anillos de Multics", "Multics rings"),
    (1979, -1, "chroot", "chroot"),
    (1995, -3, "applets de Java", "Java applets"),
    (2000, -1, "jails", "jails"),
    (2005, -2, "seccomp", "seccomp"),
    (2008, -1, "Chrome", "Chrome"),
    (2013, -2, "Docker", "Docker"),
    (2017, -3, "WebAssembly", "WebAssembly"),
    (2018, -2, "gVisor · Firecracker", "gVisor · Firecracker"),
    (2021, -1, "Landlock", "Landlock"),
]

ARIA_TIME = {
    True: "Línea de tiempo, no a escala, de 1967 a 2021. Encima del eje, las ideas: el monitor de referencia en "
          "1972, el problema del confinamiento en 1973, el aislamiento de fallos por software, que da nombre al "
          "sandboxing, en 1993, Janus en 1996 y Spectre en 2018. Debajo, los sistemas: CP-67 en 1967, los "
          "anillos de Multics en 1969, chroot en 1979, los applets de Java en 1995, las jails de FreeBSD en "
          "2000, seccomp en 2005, Chrome en 2008, Docker en 2013, WebAssembly en 2017, gVisor y "
          "Firecracker en 2018 y Landlock en 2021.",
    False: "Timeline, not to scale, from 1967 to 2021. Above the axis, the ideas: the reference monitor in 1972, "
           "the confinement problem in 1973, software-based fault isolation, which gave sandboxing its name, in "
           "1993, Janus in 1996 and Spectre in 2018. Below, the systems: CP-67 in 1967, the Multics rings in "
           "1969, chroot in 1979, Java applets in 1995, FreeBSD jails in 2000, seccomp in 2005, Chrome in "
           "2008, Docker in 2013, WebAssembly in 2017, gVisor and Firecracker in 2018 and Landlock in 2021.",
}


def fig_time(es):
    L = {True: dict(up="IDEAS", down="SISTEMAS"), False: dict(up="IDEAS", down="SYSTEMS")}[es]
    years = sorted({e[0] for e in EVENTS})
    X0, X1 = 30, 700
    AY = 84
    slot = (X1 - X0) / (len(years) - 1)

    def X(y):
        return X0 + slot * years.index(y)

    b = []
    b.append(text(20, 18, L["up"], "hd"))
    b.append(text(20, 208, L["down"], "hd"))
    b.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="1.5"/>' % (X0 - 10, AY, X1 + 10, AY, MUTED))
    for yr in years:
        b.append(text(X(yr), AY + 16, str(yr), "sb"))
    for yr, lvl, les, len_ in EVENTS:
        x = X(yr)
        label = les if es else len_
        if lvl > 0:
            ty = AY - 18 - 28 * (lvl - 1)
            b.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%.1f" stroke="%s"/>' % (x, AY, x, ty + 4, LINE))
        else:
            ty = AY + 40 + 28 * (-lvl - 1)
            b.append('<line x1="%.1f" y1="%d" x2="%.1f" y2="%.1f" stroke="%s"/>' % (x, AY + 22, x, ty - 11, LINE))
        b.append(text(x + 4, ty, label, "tx", "start"))
        b.append('<circle cx="%.1f" cy="%d" r="3.5" fill="%s" stroke="%s" stroke-width="2"/>' % (x, AY, TXT, SURF))
    return svg(760, 218, ARIA_TIME[es], b)


# ─── 3. capas ─────────────────────────────────────────────────────────────────────────────────

# Per column: which rows are the program's own ("m") or shared with everything else on the machine
# (""), and where the boundary line sits: after row index k (0 = between program and runtime). gVisor
# splits the kernel row: its own Sentry above the line, the host kernel below.
COLS = [
    (("Isolate", "de V8"), ("Isolate", "(V8)"), 0, ("el runtime",), ("the runtime",)),
    (("WebAssembly", ""), ("WebAssembly", ""), 0, ("memoria lineal",), ("linear memory",)),
    (("Proceso", "con filtros"), ("Process", "with filters"), 1, ("seccomp,", "Landlock"), ("seccomp,", "Landlock")),
    (("Contenedor", ""), ("Container", ""), 1, ("namespaces,", "cgroups"), ("namespaces,", "cgroups")),
    (("gVisor", ""), ("gVisor", ""), 1.5, ("el Sentry",), ("the Sentry",)),
    (("MicroVM", ""), ("MicroVM", ""), 2, ("KVM + VMM",), ("KVM + VMM",)),
    (("Otra", "máquina"), ("Another", "machine"), 3, ("la red",), ("the network",)),
]

ARIA_LAYERS = {
    True: "Siete formas de aislar un programa, en columnas, y cuatro capas en filas, de arriba abajo: el "
          "programa, el runtime del lenguaje, el núcleo del sistema operativo y el hardware. En cada columna, "
          "una línea naranja marca la frontera: lo que queda encima es sólo de ese programa, y lo que queda "
          "debajo lo comparte con los demás. Isolate de V8 y WebAssembly: la frontera está justo debajo del "
          "programa, y comparte el runtime, el núcleo y el hardware. Proceso con filtros, como seccomp o "
          "Landlock, y contenedor, con namespaces y cgroups: la frontera está encima del núcleo, que se "
          "comparte. gVisor: la frontera está dentro de la capa del núcleo, con un núcleo propio, el Sentry, "
          "encima del núcleo del anfitrión, que se comparte. MicroVM: la frontera es el hipervisor, KVM y el "
          "gestor de la máquina virtual, y sólo se comparte el hardware. Otra máquina: no se comparte nada; la "
          "frontera es la red.",
    False: "Seven ways to isolate a program, in columns, and four layers in rows, from top to bottom: the "
           "program, the language runtime, the operating system kernel and the hardware. In each column, an "
           "orange line marks the boundary: what lies above belongs to that program alone, and what lies below "
           "it shares with everything else. V8 isolate and WebAssembly: the boundary sits right under the "
           "program, which shares the runtime, the kernel and the hardware. Process with filters, such as "
           "seccomp or Landlock, and container, with namespaces and cgroups: the boundary sits above the "
           "kernel, which is shared. gVisor: the boundary sits inside the kernel layer, with a kernel of its "
           "own, the Sentry, on top of the host kernel, which is shared. MicroVM: the boundary is the "
           "hypervisor, KVM and the virtual machine monitor, and only the hardware is shared. Another machine: "
           "nothing is shared; the boundary is the network.",
}


def fig_layers(es):
    L = {True: dict(rows=["Programa", "Runtime", "Núcleo", "Hardware"], own="sólo de este programa",
                    shared="compartido con los demás", line="la frontera", sentry="Sentry", host="anfitrión",
                    hd="CUANTO MÁS ABAJO LA FRONTERA, MENOS SE COMPARTE"),
         False: dict(rows=["Program", "Runtime", "Kernel", "Hardware"], own="this program's alone",
                     shared="shared with the rest", line="the boundary", sentry="Sentry", host="host",
                     hd="THE LOWER THE BOUNDARY, THE LESS IS SHARED")}[es]
    b = []
    LX, CX0, CW, GAP = 20, 104, 86, 6
    RY0, RH, RG = 66, 34, 6
    b.append(text(LX, 16, L["hd"], "hd", "start"))
    for r, name in enumerate(L["rows"]):
        b.append(text(LX, RY0 + r * (RH + RG) + RH / 2 + 4, name, "tx", "start"))
    for c, (hes, hen, k, mes, men) in enumerate(COLS):
        x = CX0 + c * (CW + GAP)
        h1, h2 = hes if es else hen
        b.append(text(x + CW / 2, 38, h1, "lb"))
        if h2:
            b.append(text(x + CW / 2, 52, h2, "sb"))
        for r in range(4):
            y = RY0 + r * (RH + RG)
            if k == 1.5 and r == 2:
                hh = (RH - 4) / 2
                b.append(box(x, y, CW, hh, "m", 4))
                b.append(text(x + CW / 2, y + hh / 2 + 4, L["sentry"], "sb m"))
                b.append(box(x, y + hh + 4, CW, hh, "g", 4))
                b.append(text(x + CW / 2, y + hh + 4 + hh / 2 + 4, L["host"], "sb"))
                continue
            own = r <= k
            b.append(box(x, y, CW, RH, "m" if own else "g", 4))
        if k == 1.5:
            ly = RY0 + 2 * (RH + RG) + (RH - 4) / 2 + 2
        else:
            ly = RY0 + (k + 1) * (RH + RG) - RG / 2
        b.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="3"/>'
                 % (x - 2, ly, x + CW + 2, ly, WARN))
        mech = mes if es else men
        for i, s in enumerate(mech):
            b.append(text(x + CW / 2, RY0 + 4 * (RH + RG) + 12 + i * 13, s, "sb w"))
    ly = 284
    b.append(box(LX + 84, ly - 9, 14, 12, "m", 2))
    b.append(text(LX + 104, ly + 1, L["own"], "sb", "start"))
    b.append(box(LX + 264, ly - 9, 14, 12, "g", 2))
    b.append(text(LX + 284, ly + 1, L["shared"], "sb", "start"))
    b.append('<line x1="%d" y1="%d" x2="%d" y2="%d" stroke="%s" stroke-width="3"/>' % (LX + 454, ly - 3, LX + 474, ly - 3, WARN))
    b.append(text(LX + 480, ly + 1, L["line"], "sb", "start"))
    return svg(760, 294, ARIA_LAYERS[es], b)


# ─── 4. superficie ────────────────────────────────────────────────────────────────────────────

# Anjali et al., VEE 2020, Table 1: "Total number of system calls allowed out of 350".
# Measured on gVisor release-20200127.0 and Firecracker v0.19.1. LXC = 350 - 44.
TOTAL = 350
SURFACE = [("nofilter", 350), ("lxc", 306), ("gvisor_net", 68), ("gvisor", 53), ("firecracker", 36)]
NAMES = {
    True: {"nofilter": "Proceso sin filtro", "lxc": "Contenedor (perfil por defecto)",
           "gvisor_net": "gVisor, con la red del anfitrión", "gvisor": "gVisor", "firecracker": "Firecracker"},
    False: {"nofilter": "Unfiltered process", "lxc": "Container (default profile)",
            "gvisor_net": "gVisor, with host networking", "gvisor": "gVisor", "firecracker": "Firecracker"},
}

ARIA_SURF = {
    True: "Barras horizontales con el número de llamadas al sistema, de 350, que cada plataforma se permite "
          "hacer al núcleo del anfitrión, según Anjali y otros, 2020. Un proceso sin filtro, 350. Un "
          "contenedor con el perfil por defecto, 306: todas menos 44. gVisor con la red del anfitrión, 68. "
          "gVisor, 53. Firecracker, 36.",
    False: "Horizontal bars with the number of system calls, out of 350, that each platform allows itself "
           "towards the host kernel, according to Anjali et al., 2020. An unfiltered process, 350. A container "
           "with the default profile, 306: all but 44. gVisor with host networking, 68. gVisor, 53. "
           "Firecracker, 36.",
}


def fig_surface(es):
    L = {True: dict(hd="LLAMADAS AL SISTEMA PERMITIDAS HACIA EL NÚCLEO DEL ANFITRIÓN, DE 350"),
         False: dict(hd="SYSTEM CALLS ALLOWED TOWARDS THE HOST KERNEL, OUT OF 350")}[es]
    b = []
    BX0, BX1 = 236, 700
    b.append(text(20, 18, L["hd"], "hd", "start"))
    for t in (0, 50, 100, 150, 200, 250, 300, 350):
        x = BX0 + (BX1 - BX0) * t / TOTAL
        b.append('<line x1="%.1f" y1="32" x2="%.1f" y2="196" stroke="%s"/>' % (x, x, GRID))
        b.append(text(x, 212, str(t), "sb"))
    for i, (key, n) in enumerate(SURFACE):
        y = 40 + i * 32
        hi = key in ("gvisor", "firecracker", "gvisor_net")
        b.append(text(BX0 - 10, y + 15, NAMES[es][key], "tx", "end"))
        w = (BX1 - BX0) * n / TOTAL
        b.append('<rect x="%d" y="%d" width="%.1f" height="20" rx="3" fill="%s" fill-opacity="%s"/>'
                 % (BX0, y, w, ACC if hi else MUTED, "0.85" if hi else "0.55"))
        b.append(text(BX0 + w + 6, y + 15, str(n), "tx m" if hi else "tx", "start"))
    return svg(760, 222, ARIA_SURF[es], b)


if __name__ == "__main__":
    write("monitor", fig_monitor(True), fig_monitor(False))
    write("linea-de-tiempo", fig_time(True), fig_time(False))
    write("capas", fig_layers(True), fig_layers(False))
    write("superficie", fig_surface(True), fig_surface(False))
