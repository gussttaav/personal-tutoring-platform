"""BLOG-17 — Figures for the blog post `serverless`.
Run from this directory: python3 make_svgs.py ../../../public/blog/serverless
-> writes *.svg (es) and *.en.svg. Pure Python, no dependencies.

The numbers are copied from `python3 analiza.py` over the post's measured results
(public/blog/serverless/ejemplos/resultados/, AWS Lambda, eu-west-1, Python 3.14, 16-17 Oct 2026):
  - `arranque-en-frio`: medians of 20 cold and 60 warm requests to the `hola` function (128 MB).
    TCP+TLS 171 / 168 ms; TLS-ready to first byte 326 / 76 ms; Init Duration 116 ms; handler
    2.3 / 1.7 ms. The ~134 ms before Init is 326 - 76 - 116: the part of the cold start the log
    does not report. The ~74 ms of network is the warm server time minus the handler.
  - `escala`: the five request batches of `medir.py escala`, with the instance that served each
    request (letters in order of first appearance) and whether it was a cold start.
  - `vida-de-una-instancia`: for each idle gap, how many times the same instance answered again.
  - `memoria-y-cpu`: median of 5 warm calls of 300 000 chained SHA-256, and the cost per million
    calls at 0.0000166667 $/GB-s + 0.20 $/million requests.
  - `coste`: `coste.py`, the 100 ms / 512 MB request, without the free tier, against one
    c7g.medium (28.32 $/month) and two plus a load balancer (80.88 $/month).
  - `linea-de-tiempo` and `quien-gestiona-que` are dates and definitions."""
import math
import os
import sys

OUT = sys.argv[1]
os.makedirs(OUT, exist_ok=True)

TXT = "#bbcabf"; MUTED = "#86948a"; ACC = "#4edea3"; GRID = "#2a2a2c"; LINE = "#3b3b3e"
WARN = "#e8a24c"; BLUE = "#6fb1e8"; BAD = "#ffb4ab"; BG = "#131315"
FONT = "ui-sans-serif, system-ui, sans-serif"
MONO = "ui-monospace, SFMono-Regular, Menlo, monospace"

STYLE = f"""<style>
  text {{ font-family: {FONT}; fill: {TXT}; }}
  .bx {{ fill: none; stroke: {MUTED}; stroke-width: 1; }}
  .bx.m {{ stroke: {ACC}; fill: rgba(78,222,163,0.14); }}
  .bx.w {{ stroke: {WARN}; fill: rgba(232,162,76,0.16); }}
  .bx.b {{ stroke: {BLUE}; fill: rgba(111,177,232,0.14); }}
  .bx.x {{ stroke: {BAD}; fill: rgba(255,180,171,0.06); stroke-dasharray: 3 3; }}
  .bx.g {{ stroke: {LINE}; }}
  .bx.s {{ stroke: {LINE}; fill: rgba(134,148,138,0.10); }}
  .bx.h {{ stroke: {MUTED}; fill: rgba(134,148,138,0.18); stroke-dasharray: 3 3; }}
  .lb {{ font-size: 12.5px; font-weight: 600; }}
  .sb {{ font-size: 11px; fill: {MUTED}; }}
  .sb.n {{ font-size: 10px; }}
  .tx {{ font-size: 11.5px; }}
  .tx.d {{ fill: {MUTED}; }}
  .mo {{ font-family: {MONO}; font-size: 11px; }}
  .mo.s {{ font-size: 10px; }}
  .m {{ fill: {ACC}; }}
  .w {{ fill: {WARN}; }}
  .b {{ fill: {BLUE}; }}
  .x {{ fill: {BAD}; }}
  .ed {{ stroke: {LINE}; stroke-width: 1; }}
  .gl {{ stroke: {GRID}; stroke-width: 1; }}
  .rf {{ stroke: {MUTED}; stroke-width: 1; stroke-dasharray: 4 4; }}
  .br {{ fill: none; stroke: {MUTED}; stroke-width: 1; }}
</style>"""


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def svg(w, h, aria, body):
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %d %d" width="%d" height="%d" role="img"\n'
            ' aria-label="%s">\n%s\n%s\n</svg>\n'
            % (w, h, w, h, esc(aria).replace('"', "&quot;"), STYLE, "\n".join(body)))


def box(x, y, w, h, cls="", rx=4):
    return '<rect class="bx %s" x="%.1f" y="%.1f" width="%.1f" height="%.1f" rx="%g"/>' % (cls, x, y, w, h, rx)


def text(x, y, s, cls="tx", anchor=None):
    a = ' style="text-anchor:%s"' % anchor if anchor else ""
    return '<text class="%s" x="%.1f" y="%.1f"%s>%s</text>' % (cls, x, y, a, esc(s))


def line(x1, y1, x2, y2, cls="ed"):
    return '<line class="%s" x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f"/>' % (cls, x1, y1, x2, y2)


def num(v, es, dec=0):
    """Decimal comma in Spanish, point in English."""
    s = "%.*f" % (dec, v)
    return s.replace(".", ",") if es else s


def legend(b, items, right, y=14):
    """items: (css class of the swatch box, label). Right-aligned at `right`."""
    x = right
    for cls, label in reversed(items):
        w = 6.2 * len(label) + 20
        x -= w
        b.append(box(x, y - 9, 11, 11, cls, rx=2))
        b.append(text(x + 16, y, label, "sb"))
        x -= 12


def write(name, es_svg, en_svg):
    for suffix, content in ((".svg", es_svg), (".en.svg", en_svg)):
        with open(os.path.join(OUT, name + suffix), "w", encoding="utf-8") as f:
            f.write(content)


# ─── 1. arranque-en-frio (the post's cover) ──────────────────────────────────────────────────────

def fig_arranque(es):
    # (ms, css class, label, sublabel)
    L = {
        True: dict(
            cold="Arranque en frío", warm="Petición en caliente",
            conn=("conexión", "TCP y TLS"), prep=("preparar la instancia", "sin registrar ni cobrar"),
            init=("Init", "Python y el fichero"), net=("red", ""), h="handler",
            billed_c="se cobra: 119 ms", billed_w="se cobra: 2 ms",
            tot_c="0,51 s", tot_w="0,24 s", axis="milisegundos desde que empieza la petición",
            k=(("b", "red"), ("h", "sin cobrar"), ("w", "se cobra")),
            aria="Dos barras sobre el mismo eje de tiempo, de 0 a 520 milisegundos, con las medianas "
                 "medidas. Arranque en frío: conexión TCP y TLS, 171 ms; preparar la instancia, unos "
                 "134 ms, que Lambda no registra ni cobra; Init, arrancar Python e importar el fichero, "
                 "116 ms; el handler, 2 ms; la red, unos 74 ms. Total, 0,51 s, de los que se cobran 119 ms. "
                 "Petición en caliente: conexión, 168 ms; handler, 2 ms; red, 74 ms. Total, 0,24 s, de los "
                 "que se cobran 2 ms."),
        False: dict(
            cold="Cold start", warm="Warm request",
            conn=("connection", "TCP and TLS"), prep=("setting up the instance", "not logged, not billed"),
            init=("Init", "Python and the file"), net=("network", ""), h="handler",
            billed_c="billed: 119 ms", billed_w="billed: 2 ms",
            tot_c="0.51 s", tot_w="0.24 s", axis="milliseconds since the request started",
            k=(("b", "network"), ("h", "not billed"), ("w", "billed")),
            aria="Two bars on the same time axis, from 0 to 520 milliseconds, with the measured medians. "
                 "Cold start: TCP and TLS connection, 171 ms; setting up the instance, about 134 ms, which "
                 "Lambda neither logs nor bills; Init, starting Python and importing the file, 116 ms; the "
                 "handler, 2 ms; the network, about 74 ms. Total, 0.51 s, of which 119 ms are billed. Warm "
                 "request: connection, 168 ms; handler, 2 ms; network, 74 ms. Total, 0.24 s, of which 2 ms "
                 "are billed."),
    }[es]
    W, H = 760, 232
    x0, x1, ms_max = 150, 730, 520
    sx = lambda ms: x0 + ms / ms_max * (x1 - x0)
    b = []
    legend(b, L["k"], W - 16)
    rows = [
        (58, L["cold"], L["tot_c"], [(171, "b", L["conn"]), (134, "h", L["prep"]), (116, "w", L["init"]),
                                     (2.3, "w", None), (74, "b", L["net"])], (171 + 134, 171 + 134 + 116 + 2.3),
         L["billed_c"]),
        (136, L["warm"], L["tot_w"], [(168, "b", L["conn"]), (1.7, "w", None), (74, "b", L["net"])],
         (168, 169.7), L["billed_w"]),
    ]
    for y, label, total, segs, billed, billed_label in rows:
        b.append(text(16, y + 21, label, "lb"))
        t = 0
        for ms, cls, lab in segs:
            xa, xb = sx(t), sx(t + ms)
            b.append(box(xa, y, max(xb - xa, 1.5), 32, cls, rx=2))
            if lab and xb - xa > 60:
                b.append(text((xa + xb) / 2, y + 14, lab[0], "tx", "middle"))
                if lab[1]:
                    b.append(text((xa + xb) / 2, y + 27, lab[1], "sb", "middle"))
            elif lab:
                b.append(text((xa + xb) / 2, y + 20, lab[0], "sb", "middle"))
            t += ms
        hx = sx(billed[1])
        b.append(line(hx, y - 2, hx, y - 12))
        b.append(text(hx + 4, y - 4, L["h"], "sb"))
        b.append(text(sx(t) + 8, y + 21, total, "lb"))
        ba, bb = sx(billed[0]), sx(billed[1])
        b.append('<path class="br" d="M%.1f,%.1f L%.1f,%.1f L%.1f,%.1f L%.1f,%.1f"/>'
                 % (ba, y + 38, ba, y + 44, bb, y + 44, bb, y + 38))
        b.append(text((ba + bb) / 2 if bb - ba > 40 else ba, y + 56, billed_label, "sb w",
                      "middle" if bb - ba > 40 else None))
    ya = 194
    b.append(line(x0, ya, x1, ya))
    for ms in range(0, 501, 100):
        b.append(line(sx(ms), ya, sx(ms), ya + 4))
        b.append(text(sx(ms), ya + 15, str(ms), "sb", "middle"))
    b.append(text((x0 + x1) / 2, ya + 32, L["axis"], "sb", "middle"))
    return svg(W, H, L["aria"], b)


# ─── 2. linea-de-tiempo ──────────────────────────────────────────────────────────────────────────

def fig_linea(es):
    ev = [  # (year, (es, sub), (en, sub), family: pre | lam | post)
        (1993, ("CGI", "proceso por petición"), ("CGI", "process per request"), "pre"),
        (2006, ("EC2", "máquinas por horas"), ("EC2", "machines by the hour"), "pre"),
        (2008, ("App Engine", "PaaS"), ("App Engine", "PaaS"), "pre"),
        (2011, ("Parse, Firebase", "BaaS"), ("Parse, Firebase", "BaaS"), "pre"),
        (2012, ("«serverless»", "Ken Fromm"), ("“serverless”", "Ken Fromm"), "pre"),
        (2014, ("AWS Lambda", "una función por evento"), ("AWS Lambda", "a function per event"), "lam"),
        (2017, ("Workers", "isolates de V8"), ("Workers", "V8 isolates"), "post"),
        (2018, ("Firecracker", "y 15 minutos"), ("Firecracker", "and 15 minutes"), "post"),
        (2019, ("Cloud Run", "contenedores"), ("Cloud Run", "containers"), "post"),
        (2020, ("1 ms", "facturación"), ("1 ms", "billing"), "post"),
        (2025, ("Managed Instances", "y durable functions"), ("Managed Instances", "and durable functions"), "post"),
        (2026, ("Web Functions", "y Event Functions"), ("Web Functions", "and Event Functions"), "post"),
    ]
    col = {"pre": (BLUE, "b"), "lam": (ACC, "m"), "post": (WARN, "w")}
    L = {
        True: dict(k=(("pre", "antes de Lambda"), ("lam", "Lambda"), ("post", "después")),
                   aria="Línea de tiempo, no a escala, con doce hitos. Antes de Lambda: 1993, CGI, un proceso "
                        "por petición; 2006, EC2 alquila máquinas virtuales por horas; 2008, Google App Engine, "
                        "una plataforma como servicio; 2011, Parse y Firebase, servidores como servicio para "
                        "aplicaciones móviles; 2012, Ken Fromm populariza la palabra serverless. 2014, AWS Lambda, "
                        "una función por evento. Después: 2017, Cloudflare Workers, con isolates de V8; 2018, "
                        "Firecracker y funciones de hasta 15 minutos; 2019, Cloud Run, contenedores serverless; "
                        "2020, facturación por milisegundo; 2025, Lambda Managed Instances y "
                        "durable functions; 2026, Lambda Web Functions, y las funciones clásicas pasan a llamarse "
                        "Event Functions."),
        False: dict(k=(("pre", "before Lambda"), ("lam", "Lambda"), ("post", "after")),
                    aria="Timeline, not to scale, with twelve milestones. Before Lambda: 1993, CGI, a process per "
                         "request; 2006, EC2 rents virtual machines by the hour; 2008, Google App Engine, a platform "
                         "as a service; 2011, Parse and Firebase, backends as a service for mobile apps; 2012, Ken "
                         "Fromm popularises the word serverless. 2014, AWS Lambda, a function per event. After: "
                         "2017, Cloudflare Workers, with V8 isolates; 2018, Firecracker and functions of up to 15 "
                         "minutes; 2019, Cloud Run, serverless containers; 2020, per-millisecond billing; 2025, "
                         "Lambda Managed Instances and durable functions; 2026, Lambda Web Functions, and the classic "
                         "functions are renamed Event Functions."),
    }[es]
    W, H, Y = 760, 176, 102
    b = [line(8, Y, W - 8, Y, "ed")]
    step = (W - 72 - 62) / (len(ev) - 1)
    for i, (yr, tes, ten, fam) in enumerate(ev):
        x = 72 + i * step
        t = tes if es else ten
        c, cls = col[fam]
        b.append('<circle cx="%.1f" cy="%d" r="%s" fill="%s"/>' % (x, Y, "6" if fam == "lam" else "4.5", c))
        up = i % 2 == 0
        b.append(line(x, Y + (-7 if up else 7), x, Y + (-17 if up else 17), "ed"))
        ty = Y - 48 if up else Y + 31
        b.append(text(x, ty, str(yr), "lb " + cls, "middle"))
        b.append(text(x, ty + 14, t[0], "tx", "middle"))
        b.append(text(x, ty + 27, t[1], "sb", "middle"))
    kx = W - 16
    for fam, label in reversed(L["k"]):
        w = 6.4 * len(label) + 22
        kx -= w
        b.append('<circle cx="%d" cy="12" r="4.5" fill="%s"/>' % (kx, col[fam][0]))
        b.append(text(kx + 10, 16, label, "sb"))
        kx -= 10
    return svg(W, H, L["aria"], b)


# ─── 3. quien-gestiona-que ───────────────────────────────────────────────────────────────────────

def fig_quien(es):
    # rows top to bottom; per column: t = you, p = provider, h = half
    rows = [
        (("Código de la aplicación", "Application code"), None, "ttttp"),
        (("Escalado", "Scaling"), None, "tthpp"),
        (("Programa que atiende peticiones", "Program that serves requests"), None, "ttppp"),
        (("Sistema operativo", "Operating system"), None, "ttppp"),
        (("Hardware", "Hardware"), None, "tpppp"),
    ]
    cols = [(("Servidor propio", ""), ("Own server", "")), (("IaaS", "EC2"), ("IaaS", "EC2")),
            (("PaaS", "App Engine, Heroku"), ("PaaS", "App Engine, Heroku")),
            (("FaaS", "Lambda"), ("FaaS", "Lambda")), (("BaaS", "Firebase"), ("BaaS", "Firebase"))]
    L = {
        True: dict(t="tú", p="el proveedor", h="a medias", conf="sólo configuras",
                   k=(("w", "lo gestionas tú"), ("m", "lo gestiona el proveedor"), ("s", "a medias")),
                   aria="Tabla de cinco columnas, una por modelo: servidor propio, IaaS (EC2), PaaS (App Engine, "
                        "Heroku), FaaS (Lambda) y BaaS (Firebase). Cinco filas, de arriba abajo: código de la "
                        "aplicación, escalado, programa que atiende peticiones, sistema operativo y hardware. Con "
                        "un servidor propio todo lo gestionas tú. En IaaS, el proveedor gestiona el hardware. En "
                        "PaaS, también el sistema operativo y el programa, y el escalado a medias. En FaaS, todo "
                        "salvo tu código. En BaaS, también el código del servidor: sólo configuras."),
        False: dict(t="you", p="the provider", h="partly", conf="you only configure",
                    k=(("w", "you manage it"), ("m", "the provider manages it"), ("s", "partly")),
                    aria="Table with five columns, one per model: own server, IaaS (EC2), PaaS (App Engine, "
                         "Heroku), FaaS (Lambda) and BaaS (Firebase). Five rows, from top to bottom: application "
                         "code, scaling, program that serves requests, operating system and hardware. With your own "
                         "server you manage everything. With IaaS, the provider manages the hardware. With PaaS, "
                         "also the operating system and the program, and partly the scaling. With FaaS, everything "
                         "but your code. With BaaS, also the server code: you only configure."),
    }[es]
    W, H = 760, 280
    lx, cx0, cw, ch, top = 16, 214, 106, 36, 64
    b = []
    legend(b, L["k"], W - 16)
    for j, c in enumerate(cols):
        t = c[0] if es else c[1]
        x = cx0 + j * cw + cw / 2
        b.append(text(x, top - 22, t[0], "lb", "middle"))
        if t[1]:
            b.append(text(x, top - 8, t[1], "sb", "middle"))
    for i, (name, _, cells) in enumerate(rows):
        y = top + i * (ch + 6)
        b.append(text(lx, y + ch / 2 + 4, name[0] if es else name[1], "tx"))
        for j, k in enumerate(cells):
            x = cx0 + j * cw + 4
            cls = {"t": "w", "p": "m", "h": "s"}[k]
            b.append(box(x, y, cw - 8, ch, cls, rx=3))
            lab = {"t": L["t"], "p": L["p"], "h": L["h"]}[k]
            if i == 0 and j == 4:
                lab = L["conf"]
            b.append(text(x + (cw - 8) / 2, y + ch / 2 + 4, lab, "sb" if k == "p" else "tx", "middle"))
    return svg(W, H, L["aria"], b)


# ─── 4. escala ───────────────────────────────────────────────────────────────────────────────────

def fig_escala(es):
    # Per batch: requests as (state, instance). f = cold, c = warm, x = rejected (429).
    batches = [
        (("10 seguidas", "1 instancia"), ("10 in a row", "1 instance"), [("f", "A")] + [("c", "A")] * 9),
        (("10 a la vez", "10 nuevas"), ("10 at once", "10 new ones"), [("f", c) for c in "BCDEFGHIJK"]),
        (("otras 10 a la vez", "las mismas 10"), ("another 10 at once", "the same 10"),
         [("c", c) for c in "BCDEFGHIJK"]),
        (("20 a la vez", "10 atendidas, 10 rechazadas"), ("20 at once", "10 served, 10 rejected"),
         [("c", c) for c in "BCDEFGHIJK"] + [("x", "")] * 10),
        (("10 seguidas", "1 instancia"), ("10 in a row", "1 instance"), [("c", "E")] * 10),
    ]
    L = {
        True: dict(k=(("w", "arranque en frío"), ("m", "en caliente"), ("x", "rechazada (429)")),
                   note="Cada cuadro es una petición; la letra, la instancia que la atendió.",
                   aria="Cinco filas, una por tanda de peticiones, con un cuadro por petición y la letra de la "
                        "instancia que la atendió. Diez seguidas: las diez las atiende la instancia A, la primera "
                        "en frío. Diez a la vez: diez instancias nuevas, de la B a la K, todas en frío. Otras diez "
                        "a la vez: las mismas diez instancias, en caliente. Veinte a la vez: diez atendidas por "
                        "esas instancias y diez rechazadas con un error 429. Diez seguidas: todas las atiende la "
                        "instancia E, en caliente."),
        False: dict(k=(("w", "cold start"), ("m", "warm"), ("x", "rejected (429)")),
                    note="Each square is a request; the letter, the instance that served it.",
                    aria="Five rows, one per batch of requests, with a square per request and the letter of the "
                         "instance that served it. Ten in a row: instance A serves all ten, the first one cold. Ten "
                         "at once: ten new instances, B to K, all cold. Another ten at once: the same ten instances, "
                         "warm. Twenty at once: ten served by those instances and ten rejected with a 429 error. "
                         "Ten in a row: instance E serves them all, warm."),
    }[es]
    W, H = 760, 248
    x0, sq, gap, top, rh = 196, 22, 4, 40, 42
    b = []
    legend(b, L["k"], W - 16)
    b.append(text(16, 14, L["note"], "sb"))
    for i, (tes, ten, reqs) in enumerate(batches):
        y = top + i * rh
        t = tes if es else ten
        b.append(text(16, y + 10, t[0], "tx"))
        b.append(text(16, y + 24, t[1], "sb"))
        for j, (state, inst) in enumerate(reqs):
            x = x0 + j * (sq + gap)
            cls = {"f": "w", "c": "m", "x": "x"}[state]
            b.append(box(x, y, sq, sq, cls, rx=2))
            if inst:
                b.append(text(x + sq / 2, y + 15, inst, "mo s", "middle"))
    return svg(W, H, L["aria"], b)


# ─── 5. vida-de-una-instancia ────────────────────────────────────────────────────────────────────

# (idle minutes, times the same instance answered again, attempts)
VIDA = [(1, 355, 358), (2, 175, 179), (3, 117, 119), (4, 70, 73), (5, 68, 71), (6, 0, 49), (7, 0, 51),
        (8, 0, 37), (10, 0, 35), (15, 0, 23), (20, 0, 17), (30, 0, 11), (45, 0, 7), (60, 0, 5), (90, 0, 3)]


def fig_vida(es):
    L = {
        True: dict(y="veces que contestó la misma instancia", x="minutos sin peticiones antes de volver a llamar",
                   aria="Gráfico de barras. Para cada hueco sin peticiones, la proporción de veces que la misma "
                        "instancia volvió a contestar: " +
                        "; ".join("%d min, %d de %d" % v for v in VIDA) +
                        ". Hasta 5 minutos sobrevive casi siempre; desde los 6, nunca."),
        False: dict(y="times the same instance answered", x="idle minutes before calling again",
                    aria="Bar chart. For each idle gap, the share of times the same instance answered again: " +
                         "; ".join("%d min, %d of %d" % v for v in VIDA) +
                         ". Up to 5 minutes it nearly always survives; from 6 on, never."),
    }[es]
    W, H = 760, 262
    left, right, top, bottom = 56, 16, 48, 208
    n = len(VIDA)
    slot = (W - left - right) / n
    sy = lambda f: bottom - f * (bottom - top)
    b = [text(16, 16, L["y"], "sb")]
    for f in (0, 0.5, 1):
        b.append(line(left, sy(f), W - right, sy(f), "gl" if f else "ed"))
        b.append(text(left - 8, sy(f) + 4, "%d %%" % (f * 100) if es else "%d%%" % (f * 100), "sb", "end"))
    bw = slot * 0.6
    for i, (m, ok, total) in enumerate(VIDA):
        cx = left + (i + 0.5) * slot
        f = ok / total
        if f > 0:
            b.append(box(cx - bw / 2, sy(f), bw, bottom - sy(f), "m", rx=2))
        else:
            b.append(box(cx - bw / 2, bottom - 3, bw, 3, "x", rx=1))
        b.append(text(cx, sy(f) - 6, "%d/%d" % (ok, total), "sb n", "middle"))
        b.append(text(cx, bottom + 16, str(m), "tx", "middle"))
    b.append(text((left + W - right) / 2, bottom + 40, L["x"], "sb", "middle"))
    return svg(W, H, L["aria"], b)


# ─── 6. memoria-y-cpu ────────────────────────────────────────────────────────────────────────────

CPU = [(128, 3.108, 6.73), (256, 1.530, 6.65), (512, 0.782, 6.86), (1024, 0.411, 7.15),
       (1769, 0.232, 6.97), (3008, 0.231, 11.66)]


def fig_memoria(es):
    L = {
        True: dict(t1="Tiempo por llamada (s)", t2="Coste por millón de llamadas ($)", x="memoria (MB)",
                   aria="Dos gráficos de barras lado a lado, uno por cada memoria configurada: 128, 256, 512, "
                        "1024, 1769 y 3008 MB. A la izquierda, el tiempo de la llamada: 3,11, 1,53, 0,78, 0,41, "
                        "0,23 y 0,23 segundos; baja en proporción a la memoria hasta 1769 MB y no baja más. A la "
                        "derecha, el coste por millón de llamadas: 6,73, 6,65, 6,86, 7,15, 6,97 y 11,66 dólares; "
                        "casi plano hasta 1769 MB, y un 70 % más caro con 3008."),
        False: dict(t1="Time per call (s)", t2="Cost per million calls ($)", x="memory (MB)",
                    aria="Two bar charts side by side, one bar per configured memory size: 128, 256, 512, 1024, "
                         "1769 and 3008 MB. On the left, the time of the call: 3.11, 1.53, 0.78, 0.41, 0.23 and "
                         "0.23 seconds; it falls in proportion to memory up to 1769 MB and no further. On the right, "
                         "the cost per million calls: 6.73, 6.65, 6.86, 7.15, 6.97 and 11.66 dollars; nearly flat up "
                         "to 1769 MB, and 70% more expensive at 3008."),
    }[es]
    W, H = 760, 290
    b = []
    panels = [(16, L["t1"], 1, 3.5, 2, "w"), (396, L["t2"], 2, 14, 2, "m")]
    for px, title, idx, vmax, dec, cls in panels:
        pw, top, bottom = 348, 46, 236
        b.append(text(px, 18, title, "lb"))
        sy = lambda v: bottom - v / vmax * (bottom - top)
        slot = (pw - 10) / len(CPU)
        bw = slot * 0.62
        b.append(line(px, bottom, px + pw - 10, bottom))
        for i, row in enumerate(CPU):
            v = row[idx]
            cx = px + (i + 0.5) * slot
            b.append(box(cx - bw / 2, sy(v), bw, bottom - sy(v), cls, rx=2))
            b.append(text(cx, sy(v) - 6, num(v, es, dec), "sb", "middle"))
            b.append(text(cx, bottom + 15, str(row[0]), "tx", "middle"))
        b.append(text(px + (pw - 10) / 2, bottom + 33, L["x"], "sb", "middle"))
    return svg(W, H, L["aria"], b)


# ─── 7. coste ────────────────────────────────────────────────────────────────────────────────────

PER_REQUEST = 0.20e-6 + 0.1 * 0.5 * 0.0000166667   # 100 ms at 512 MB, no free tier
SECONDS_MONTH = 730 * 3600
ONE, TWO = 28.32, 80.88


def fig_coste(es):
    L = {
        True: dict(y="dólares al mes", x="peticiones por segundo, de media (1 por segundo = 2,6 millones al mes)",
                   lam="Lambda, 100 ms y 512 MB", one="un c7g.medium: 28,32 $", two="dos y un balanceador: 80,88 $",
                   c1="10 por segundo", c2="30 por segundo",
                   aria="Gráfico en escala logarítmica del coste mensual frente a las peticiones por segundo de "
                        "media, de 0,1 a 1000, para una petición de 100 ms con 512 MB, sin contar la capa gratuita. "
                        "Lambda es una recta que sube con el tráfico, de 0,27 dólares al mes con 0,1 peticiones por "
                        "segundo a unos 2700 con 1000. Un c7g.medium es una línea plana en 28,32 dólares, y dos con "
                        "un balanceador, otra en 80,88. Lambda cruza la primera hacia las 10 peticiones por segundo "
                        "y la segunda hacia las 30."),
        False: dict(y="dollars per month", x="requests per second, on average (1 per second = 2.6 million a month)",
                    lam="Lambda, 100 ms and 512 MB", one="one c7g.medium: $28.32", two="two plus a load balancer: $80.88",
                    c1="10 per second", c2="30 per second",
                    aria="Log-scale chart of the monthly cost against the average requests per second, from 0.1 to "
                         "1000, for a 100 ms request with 512 MB, without the free tier. Lambda is a straight line "
                         "that rises with traffic, from $0.27 a month at 0.1 requests per second to about $2,700 at "
                         "1000. One c7g.medium is a flat line at $28.32, and two plus a load balancer, another at "
                         "$80.88. Lambda crosses the first at about 10 requests per second and the second at about "
                         "30."),
    }[es]
    W, H = 760, 300
    left, right, top, bottom = 70, 24, 30, 238
    xmin, xmax, ymin, ymax = 0.1, 1000, 0.1, 10000
    sx = lambda v: left + (math.log10(v) - math.log10(xmin)) / (math.log10(xmax) - math.log10(xmin)) * (W - left - right)
    sy = lambda v: bottom - (math.log10(v) - math.log10(ymin)) / (math.log10(ymax) - math.log10(ymin)) * (bottom - top)
    b = [text(16, 16, L["y"], "sb")]
    for e in range(-1, 5):
        v = 10 ** e
        b.append(line(left, sy(v), W - right, sy(v), "gl" if e > -1 else "ed"))
        lab = {-1: "0,1" if es else "0.1"}.get(e, ("{:,}".format(v).replace(",", " " if es else ",")))
        b.append(text(left - 8, sy(v) + 4, lab, "sb", "end"))
    for e in range(-1, 4):
        v = 10 ** e
        b.append(line(sx(v), bottom, sx(v), bottom + 4))
        lab = {-1: "0,1" if es else "0.1"}.get(e, "{:,}".format(v).replace(",", " " if es else ","))
        b.append(text(sx(v), bottom + 17, lab, "tx", "middle"))
    b.append(text((left + W - right) / 2, bottom + 38, L["x"], "sb", "middle"))
    cost = lambda rps: rps * SECONDS_MONTH * PER_REQUEST
    pts = [(sx(r), sy(cost(r))) for r in (xmin, xmax)]
    b.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2.2"/>'
             % (pts[0][0], pts[0][1], pts[1][0], pts[1][1], ACC))
    b.append(text(sx(300), sy(cost(300)) - 12, L["lam"], "tx m", "end"))
    for v, lab, colr in ((ONE, L["one"], WARN), (TWO, L["two"], BLUE)):
        b.append('<line x1="%.1f" y1="%.1f" x2="%.1f" y2="%.1f" stroke="%s" stroke-width="2"/>'
                 % (left, sy(v), W - right, sy(v), colr))
        b.append(text(left + 8, sy(v) - 6, lab, "tx"))
    for v, lab in ((ONE, L["c1"]), (TWO, L["c2"])):
        r = v / (SECONDS_MONTH * PER_REQUEST)
        b.append('<circle cx="%.1f" cy="%.1f" r="4" fill="%s"/>' % (sx(r), sy(v), TXT))
        b.append(line(sx(r), sy(v) + 6, sx(r), bottom, "rf"))
        b.append(text(sx(r) + 6, sy(v) + 16, lab, "sb"))
    return svg(W, H, L["aria"], b)


for name, fn in (("arranque-en-frio", fig_arranque), ("linea-de-tiempo", fig_linea),
                 ("quien-gestiona-que", fig_quien), ("escala", fig_escala),
                 ("vida-de-una-instancia", fig_vida), ("memoria-y-cpu", fig_memoria), ("coste", fig_coste)):
    write(name, fn(True), fn(False))
print("ok:", OUT)
