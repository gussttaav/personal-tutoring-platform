"""The figures the article quotes, computed from resultados/*.json.

English-commented copy of ../analiza.py (same code, Spanish names). It reads the resultados/
folder next to it, so run it after medir.py, or copy ../resultados/ here to see the published
numbers.

Usage:  python3 analiza.py
"""

import json
import os
import statistics
from collections import defaultdict

R = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resultados")
GB_S = 0.0000166667
PETICION = 0.20 / 1e6


def carga(nombre):
    with open(os.path.join(R, nombre)) as f:
        return json.load(f)


def med(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else None


def servidor(r):
    """From the moment the TLS connection is ready until the first byte of the response."""
    return r["primer_byte"] - r["tls"]


def apertura():
    if not os.path.exists(os.path.join(R, "apertura.json")):
        return
    print("== apertura: five cold / warm pairs, curl output and REPORT lines")
    for f in carga("apertura.json"):
        for linea in f["salida"]:
            print("  " + linea)
        for linea in f["report"]:
            print("    " + " ".join(linea.split("\t")[1:]))


def frio():
    d = carga("frio.json")
    print("== frio: 20 cold starts, 60 warm requests (128 MB)")
    for tipo in ("frio", "caliente"):
        f = [r for r in d if r["tipo"] == tipo]
        rep = [r["report"] for r in f if r["report"]]
        print(f"  {tipo:8} n={len(f)} total={med(r['total'] for r in f):.3f} s "
              f"tls={med(r['tls'] for r in f):.3f} s server={med(servidor(r) for r in f):.3f} s "
              f"init={med(x['init_ms'] for x in rep)} ms dur={med(x['duracion_ms'] for x in rep)} ms "
              f"billed={med(x['facturado_ms'] for x in rep)} ms")


def init():
    d = carga("init.json")
    print("== init: 10 cold starts per variant and memory size")
    grupos = defaultdict(list)
    for r in d:
        grupos[(r["variante"], r["memoria"])].append(r)
    for (v, m), g in grupos.items():
        rep = [r["report"] for r in g if r["report"]]
        print(f"  {v:7} {m:5} MB zip={g[0]['zip_bytes'] / 1e6:5.1f} MB "
              f"init={med(x['init_ms'] for x in rep):7.1f} ms server={med(servidor(r) for r in g):.3f} s "
              f"total={med(r['total'] for r in g):.3f} s billed={med(x['facturado_ms'] for x in rep)} ms "
              f"memory used={med(x['usada_mb'] for x in rep)} MB")
    if os.path.exists(os.path.join(R, "pyc.json")):
        print("== pyc: pandas imported at start-up, 128 MB")
        grupos = defaultdict(list)
        for r in carga("pyc.json"):
            grupos[r["variante"]].append(r)
        for v, g in grupos.items():
            rep = [r["report"] for r in g if r["report"]]
            print(f"  .pyc by {v:5} init={med(x['init_ms'] for x in rep):7.1f} ms "
                  f"server={med(servidor(r) for r in g):.3f} s total={med(r['total'] for r in g):.3f} s")
    if os.path.exists(os.path.join(R, "importa.json")):
        d = carga("importa.json")
        primera = [r["cuerpo"]["pandas_s"] for r in d if r["llamada"] == 0]
        despues = [r["cuerpo"]["pandas_s"] for r in d if r["llamada"] > 0]
        print(f"== importa (1769 MB): import pandas in a fresh process: first call "
              f"{med(primera):.2f} s, later ones {med(despues):.2f} s")


def escala():
    d = carga("escala.json")
    print(f"== escala (account limit: {d['limite']})")
    for f in d["fases"]:
        filas = f["filas"]
        ok = [r for r in filas if r["estado"] == 200]
        frios = sum(1 for r in ok if r["report"] and r["report"]["init_ms"])
        estados = defaultdict(int)
        for r in filas:
            estados[r["estado"]] += 1
        print(f"  {f['fase']:32} {dict(estados)} instances={len({r['cuerpo']['instancia'] for r in ok})} "
              f"cold={frios} median total={med(r['total'] for r in ok):.2f} s")


def congela():
    print("== congela: gap between starting the task and its first timestamp (10 s pause)")
    for r in carga("congela.json"):
        print(f"  {r['huecos_s'][0]} s, then {set(r['huecos_s'][1:])}")


def reintentos():
    d = carga("reintentos.json")
    print("== reintentos (asynchronous invocation of a function that fails)")
    for rid, ts in d["intentos"].items():
        print(f"  {len(ts)} attempts, spaced {[round(b - a) for a, b in zip(ts, ts[1:])]} s apart")


def cpu():
    d = carga("cpu.json")
    print("== cpu: 300,000 chained SHA-256, 5 warm calls per memory size")
    grupos = defaultdict(list)
    for r in d["cpu"]:
        grupos[r["memoria"]].append(r)
    for m, g in sorted(grupos.items()):
        seg = med(r["cuerpo"]["segundos"] for r in g)
        fact = med(r["report"]["facturado_ms"] for r in g if r["report"])
        gb_s = m / 1024 * fact / 1000
        print(f"  {m:5} MB {seg:.3f} s billed={fact} ms GB-s={gb_s:.3f} "
              f"$/million={gb_s * GB_S * 1e6 + PETICION * 1e6:.2f} cpus={g[0]['cuerpo']['cpus']} "
              f"cpu='{g[0]['cuerpo']['cpu']}'")
    print("  waiting 5 s, billed:", [r["report"]["facturado_ms"] for r in d["espera"] if r["report"]])


def vida():
    filas = []
    for nombre in sorted(os.listdir(R)):
        if nombre.startswith("vida") and nombre.endswith(".jsonl"):
            with open(os.path.join(R, nombre)) as f:
                filas += [json.loads(l) for l in f]
    if not filas:
        return
    print("== vida: is it still the same instance after N minutes without requests?")
    por = defaultdict(list)
    for f in filas:
        por[f["hueco_min"]].append(f)
    for h, fs in sorted(por.items()):
        fs.sort(key=lambda f: f["t"])
        # Count each probe by the gap there actually was, not the planned one: if the laptop
        # sleeps, the gap gets longer. Probes more than 10% off are discarded.
        pruebas, descartadas = [], 0
        for a, b in zip(fs, fs[1:]):
            if b["sobrevive"] is None:
                continue
            real = (b["t"] - a["t"]) / 60
            if abs(real - h) > 0.1 * h + 0.25:
                descartadas += 1
                continue
            pruebas.append(b)
        vivas = sum(f["sobrevive"] for f in pruebas)
        print(f"  {h:3} min: survives {vivas}/{len(pruebas)}"
              + (f" ({descartadas} discarded, real gap too different)" if descartadas else ""))
    # With a call every minute the instance is never idle: how long does it live anyway?
    uno = sorted(por.get(1, []), key=lambda f: f["t"])
    edades, inicio = [], None
    for a, b in zip(uno, uno[1:]):
        if b["instancia"] != a["instancia"]:
            edades.append(a["cuerpo"]["edad_s"] / 60)
    if edades:
        print("  with one call a minute, instances replaced after (min):",
              [round(e) for e in edades])


if __name__ == "__main__":
    for f in (apertura, frio, init, escala, congela, reintentos, cpu, vida):
        f()
