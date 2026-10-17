"""Experimentos del artículo «Serverless» sobre AWS Lambda (Python 3.14, eu-west-1).

Uso:  python3 medir.py <experimento> [opciones]

  apertura    el ejemplo del principio: cinco pares de peticiones (en frío y en caliente) con curl
  frio        arranque en frío frente a petición caliente
  init        qué alarga el arranque: lo que importas y lo que pesa el paquete
  importa     por qué importar pandas tarda más en el arranque que después
  pyc         el mismo pandas, con los .pyc validados por fecha o por hash
  escala      cuántas instancias crea Lambda ante peticiones a la vez
  congela     qué pasa con el trabajo que sigue después de responder
  reintentos  cuántas veces ejecuta Lambda una invocación asíncrona que falla
  cpu         memoria, CPU y lo que se factura
  vida        cuánto tiempo sobrevive una instancia sin peticiones (horas)
  limpia      borra todo lo que han creado los experimentos

Requisitos: Python 3, AWS CLI v2 con credenciales y curl. Los resultados van a resultados/*.json.
`init`, `pyc` e `importa` descargan pandas con pip: ejecútalos dentro de un entorno virtual
(python3 -m venv), porque algunas distribuciones no dejan instalar con el pip del sistema.

Todo lo que se crea lleva el prefijo blog-sls-. Las Function URLs son públicas (sin
autenticación) mientras existen: ejecuta `limpia` al terminar.
"""

import json
import os
import shutil
import statistics
import subprocess
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor

import comun
from comun import (FUNCIONES, PREFIJO, ahora_ms, aws, crea_funcion, cambia_memoria,
                   fuerza_frio, guarda, informes, llama)


def resumen(valores):
    v = sorted(x for x in valores if x is not None)
    if not v:
        return None
    q = lambda p: v[min(len(v) - 1, int(p * len(v)))]
    return {"n": len(v), "mediana": statistics.median(v), "p10": q(0.1), "p90": q(0.9),
            "min": v[0], "max": v[-1]}


def une(llamadas, reports):
    for r in llamadas:
        r["report"] = reports.get(r["request_id"])
    return llamadas


# --- apertura -------------------------------------------------------------------------------

def apertura(pares=5):
    """Lo mismo que se ve al principio del artículo: forzar un arranque en frío y llamar dos veces
    con `curl -s -w '  %{time_total} s\\n' URL`. Guarda la salida de curl tal cual y las líneas
    REPORT del registro de cada par."""
    url = crea_funcion("hola", os.path.join(FUNCIONES, "hola"))
    filas = []
    for _ in range(pares):
        fuerza_frio("hola")
        t0 = ahora_ms()
        salida = [subprocess.run(["curl", "-s", "-w", "  %{time_total} s\n", url],
                                 capture_output=True, text=True).stdout.rstrip("\n")
                  for _ in range(2)]
        filas.append({"t0": t0, "t1": ahora_ms(), "salida": salida})
        time.sleep(2)
    time.sleep(20)  # los registros tardan unos segundos en llegar a CloudWatch
    for f in filas:
        r = aws("logs", "filter-log-events", "--log-group-name", f"/aws/lambda/{PREFIJO}hola",
                "--start-time", str(f["t0"]), "--end-time", str(f["t1"] + 5000),
                "--filter-pattern", '"REPORT RequestId"')
        f["report"] = [e["message"].strip() for e in r["events"]]
        print("\n".join(f["salida"] + f["report"]), end="\n\n")
    print(guarda("apertura", filas))


# --- frio ------------------------------------------------------------------------------------

def frio(ciclos=20, calientes=3):
    url = crea_funcion("hola", os.path.join(FUNCIONES, "hola"))
    t0, filas = ahora_ms(), []
    for i in range(ciclos):
        fuerza_frio("hola")
        filas.append({"tipo": "frio", **llama(url)})
        for _ in range(calientes):
            filas.append({"tipo": "caliente", **llama(url)})
        print(f"ciclo {i + 1}/{ciclos}", flush=True)
    une(filas, informes("hola", t0, cuantos=len(filas)))
    ruta = guarda("frio", filas)
    for tipo in ("frio", "caliente"):
        f = [r for r in filas if r["tipo"] == tipo and r["estado"] == 200]
        print(tipo, json.dumps({
            "total_s": resumen(r["total"] for r in f),
            "tls_s": resumen(r["tls"] for r in f),
            "servidor_s": resumen(r["primer_byte"] - r["tls"] for r in f),
            "init_ms": resumen(r["report"]["init_ms"] for r in f if r["report"]),
            "duracion_ms": resumen(r["report"]["duracion_ms"] for r in f if r["report"]),
            "facturado_ms": resumen(r["report"]["facturado_ms"] for r in f if r["report"]),
        }, indent=1))
    print(ruta)


# --- init ------------------------------------------------------------------------------------

def prepara_pandas():
    """Descarga pandas (y numpy) para Linux x86_64 y Python 3.14 en funciones/_pandas."""
    destino = os.path.join(FUNCIONES, "_pandas")
    if not os.path.isdir(destino):
        subprocess.run([sys.executable, "-m", "pip", "install", "--quiet", "--target", destino,
                        "--platform", "manylinux_2_28_x86_64", "--platform", "manylinux2014_x86_64",
                        "--implementation", "cp",
                        "--python-version", "3.14", "--only-binary=:all:", "pandas"], check=True)
    return destino


def prepara_pandas_hash():
    """La misma copia de pandas, con los .pyc validados por hash del código y no por fecha."""
    origen, destino = prepara_pandas(), os.path.join(FUNCIONES, "_pandas_hash")
    if not os.path.isdir(destino):
        shutil.copytree(origen, destino)
        subprocess.run([sys.executable, "-m", "compileall", "-q", "-f",
                        "--invalidation-mode", "unchecked-hash", destino], check=True)
    return destino


def prepara_hola_pandas():
    """La función hola, con un `import pandas` al principio."""
    carpeta = os.path.join(FUNCIONES, "hola_pandas")
    os.makedirs(carpeta, exist_ok=True)
    with open(os.path.join(FUNCIONES, "hola", "lambda_function.py")) as f:
        base = f.read()
    with open(os.path.join(carpeta, "lambda_function.py"), "w") as f:
        f.write("import pandas  # noqa: F401  (sólo para medir lo que cuesta importarlo)\n" + base)
    return carpeta


def init(ciclos=10, memorias=(128, 1769)):
    pandas = prepara_pandas()
    prepara_hola_pandas()
    variantes = {
        "nada": ("hola", None),                  # el mismo código de siempre
        "boto3": ("hola_boto3", None),           # importa boto3, que ya trae el runtime
        "lastre": ("hola", pandas),              # lleva pandas en el paquete, pero no lo importa
        "pandas": ("hola_pandas", pandas),       # lleva pandas y lo importa
    }
    filas = []
    for variante, (carpeta, extra) in variantes.items():
        nombre = "init-" + variante
        url = crea_funcion(nombre, os.path.join(FUNCIONES, carpeta), extra=extra, timeout=60)
        tam = aws("lambda", "get-function-configuration", "--function-name",
                  PREFIJO + nombre)["CodeSize"]
        for memoria in memorias:
            cambia_memoria(nombre, memoria)
            t0, mias = ahora_ms(), []
            for i in range(ciclos):
                fuerza_frio(nombre)
                mias.append({"variante": variante, "memoria": memoria, "zip_bytes": tam,
                             **llama(url)})
            une(mias, informes(nombre, t0, cuantos=len(mias)))
            filas += mias
            ok = [r for r in mias if r["report"]]
            print(variante, memoria, "MB", f"zip={tam / 1e6:.1f} MB",
                  "total_s", resumen(r["total"] for r in mias)["mediana"],
                  "init_ms", (resumen(r["report"]["init_ms"] for r in ok) or {}).get("mediana"),
                  flush=True)
    print(guarda("init", filas))


# --- pyc ------------------------------------------------------------------------------------

def pyc(ciclos=10, memoria=128):
    """pandas con los .pyc de pip (validados por fecha) frente a .pyc validados por hash.

    Los .pyc de pip guardan la fecha de cada .py. zipfile la escribe en el .zip en hora local
    y en segundos pares, y Lambda la lee como UTC: si tu máquina no está en UTC, no coincide
    ninguna, y Python recompila todo en cada arranque (el directorio del código es de sólo
    lectura, así que no puede guardar los .pyc nuevos)."""
    prepara_hola_pandas()
    filas = []
    for variante, extra in (("fecha", prepara_pandas()), ("hash", prepara_pandas_hash())):
        nombre = "pyc-" + variante
        url = crea_funcion(nombre, os.path.join(FUNCIONES, "hola_pandas"), extra=extra,
                           memoria=memoria, timeout=60)
        t0, mias = ahora_ms(), []
        for i in range(ciclos):
            fuerza_frio(nombre)
            mias.append({"variante": variante, **llama(url)})
        une(mias, informes(nombre, t0, cuantos=len(mias)))
        filas += mias
        print(variante, "init_ms", resumen(r["report"]["init_ms"] for r in mias if r["report"]),
              "total_s", resumen(r["total"] for r in mias)["mediana"], flush=True)
    print(guarda("pyc", filas))


# --- importa --------------------------------------------------------------------------------

def importa(ciclos=5, calientes=4, memoria=1769):
    """Importar pandas en una instancia recién creada y en la misma instancia, ya caliente."""
    url = crea_funcion("importa", os.path.join(FUNCIONES, "importa"), extra=prepara_pandas(),
                       memoria=memoria, timeout=60)
    filas = []
    for i in range(ciclos):
        fuerza_frio("importa")
        for j in range(1 + calientes):
            r = llama(url)
            filas.append({"ciclo": i, "llamada": j, **r})
            print(i, j, r["cuerpo"], flush=True)
    print(guarda("importa", filas))


# --- escala ----------------------------------------------------------------------------------

def rafaga(url, n, **params):
    barrera = threading.Barrier(n)

    def una(_):
        barrera.wait()
        return llama(url, **params)

    with ThreadPoolExecutor(n) as ex:
        return list(ex.map(una, range(n)))


def escala():
    url = crea_funcion("hola", os.path.join(FUNCIONES, "hola"))
    limite = aws("lambda", "get-account-settings")["AccountLimit"]["ConcurrentExecutions"]
    print("límite de concurrencia de la cuenta:", limite)
    t0, fases = ahora_ms(), []

    def fase(nombre, filas):
        ids = [r["cuerpo"]["instancia"] for r in filas if r["estado"] == 200]
        estados = {}
        for r in filas:
            estados[r["estado"]] = estados.get(r["estado"], 0) + 1
        print(f"{nombre}: {len(filas)} peticiones, estados {estados}, "
              f"{len(set(ids))} instancias distintas", flush=True)
        fases.append({"fase": nombre, "filas": filas})

    fuerza_frio("hola")
    fase("10 seguidas, una detrás de otra", [llama(url) for _ in range(10)])
    fuerza_frio("hola")
    fase("10 a la vez (1 s cada una)", rafaga(url, 10, espera=1))
    fase("otras 10 a la vez", rafaga(url, 10, espera=1))
    fase("20 a la vez", rafaga(url, 20, espera=1))
    fase("10 seguidas tras las ráfagas", [llama(url) for _ in range(10)])
    todas = [r for f in fases for r in f["filas"]]
    reports = informes("hola", t0, cuantos=sum(1 for r in todas if r["estado"] == 200))
    for f in fases:
        une(f["filas"], reports)
        frios = sum(1 for r in f["filas"] if r["report"] and r["report"]["init_ms"])
        print(f"  {f['fase']}: {frios} arranques en frío")
    print(guarda("escala", {"limite": limite, "fases": fases}))


# --- congela ---------------------------------------------------------------------------------

def congela(repeticiones=3, pausa=10):
    url = crea_funcion("congela", os.path.join(FUNCIONES, "congela"))
    filas = []
    for i in range(repeticiones):
        a = llama(url, accion="lanza")
        time.sleep(pausa)
        b = llama(url, accion="mira")
        lanzada, marcas = a["cuerpo"]["lanzada"], b["cuerpo"]["marcas"]
        huecos = [round(y - x, 2) for x, y in zip([lanzada] + marcas, marcas)]
        filas.append({"lanza": a, "mira": b, "huecos_s": huecos})
        print(f"rep {i + 1}: {len(marcas)} marcas; huecos entre marcas (s): {huecos}", flush=True)
    print(guarda("congela", filas))


# --- reintentos ------------------------------------------------------------------------------

def reintentos(invocaciones=2, espera_max=600):
    crea_funcion("falla", os.path.join(FUNCIONES, "falla"), url=False)
    nombre = PREFIJO + "falla"
    t0 = ahora_ms()
    for _ in range(invocaciones):
        aws("lambda", "invoke", "--function-name", nombre, "--invocation-type", "Event",
            "--cli-binary-format", "raw-in-base64-out", "--payload", "{}", "/dev/null")
        print("invocación asíncrona enviada", time.time(), flush=True)
    fin, intentos = time.time() + espera_max, []
    while time.time() < fin:
        r = aws("logs", "filter-log-events", "--log-group-name", f"/aws/lambda/{nombre}",
                "--start-time", str(t0), "--filter-pattern", '"intento de"')
        intentos = [e["message"].strip() for e in r.get("events", [])]
        if len(intentos) >= 3 * invocaciones:
            break
        time.sleep(15)
    por_id = {}
    for linea in intentos:
        _, _, rid, _, _, t = linea.split()[:6]
        por_id.setdefault(rid, []).append(float(t))
    for rid, ts in por_id.items():
        print(rid, f"{len(ts)} intentos; separación (s):",
              [round(b - a, 1) for a, b in zip(ts, ts[1:])])
    print(guarda("reintentos", {"enviado_ms": t0, "intentos": por_id}))


# --- cpu -------------------------------------------------------------------------------------

def cpu(memorias=(128, 256, 512, 1024, 1769, 3008, 10240), repeticiones=5, vueltas=300000):
    url = crea_funcion("cpu", os.path.join(FUNCIONES, "cpu"), timeout=60)
    filas = []
    for memoria in memorias:
        try:
            cambia_memoria("cpu", memoria)
        except RuntimeError as e:
            print(f"{memoria} MB: no se puede ({str(e).splitlines()[-1]})")
            continue
        llama(url, vueltas=1000)  # arranque en frío, no cuenta
        t0 = ahora_ms()
        mias = [{"memoria": memoria, **llama(url, vueltas=vueltas)} for _ in range(repeticiones)]
        une(mias, informes("cpu", t0, cuantos=repeticiones))
        filas += mias
        c = mias[0]["cuerpo"]
        print(memoria, "MB", c.get("cpus"), "vCPU", c.get("cpu"), "segundos",
              resumen(r["cuerpo"]["segundos"] for r in mias)["mediana"],
              "facturado_ms", resumen(r["report"]["facturado_ms"] for r in mias if r["report"]),
              flush=True)
    # Esperar también se factura: la misma función hola, durmiendo 5 s, con 128 MB.
    url_h = crea_funcion("hola", os.path.join(FUNCIONES, "hola"))
    t0 = ahora_ms()
    espera = [llama(url_h, espera=5) for _ in range(3)]
    une(espera, informes("hola", t0, cuantos=3))
    print("espera 5 s:", [r["report"]["facturado_ms"] for r in espera if r["report"]])
    print(guarda("cpu", {"cpu": filas, "espera": espera}))


# --- vida ------------------------------------------------------------------------------------

HUECOS_MIN = (1, 2, 3, 5, 7, 10, 15, 20, 30, 45, 60, 90)


def vida(horas=5.0, *huecos):
    """Una función por hueco: se llama, se espera el hueco sin tráfico, y se vuelve a llamar.
    Si responde la misma instancia, sobrevivió al hueco; si responde otra, Lambda la retiró."""
    huecos = huecos or HUECOS_MIN
    urls = {h: crea_funcion(f"vida-{h:02d}", os.path.join(FUNCIONES, "hola")) for h in huecos}
    fin = time.time() + horas * 3600
    sufijo = "" if huecos == HUECOS_MIN else "-" + "-".join(str(h) for h in huecos)
    ruta = os.path.join(comun.RESULTADOS, f"vida{sufijo}.jsonl")
    os.makedirs(comun.RESULTADOS, exist_ok=True)
    cerrojo = threading.Lock()

    def sonda(hueco):
        anterior = None
        while time.time() < fin:
            for intento in range(10):
                r = llama(urls[hueco])
                if r["estado"] == 200:
                    break
                time.sleep(2)  # 429 (límite de concurrencia) o error de red: reintentar
            inst = r["cuerpo"]["instancia"] if r["estado"] == 200 else None
            fila = {"hueco_min": hueco, "instancia": inst,
                    "sobrevive": None if anterior is None else inst == anterior, **r}
            with cerrojo, open(ruta, "a") as f:
                f.write(json.dumps(fila, ensure_ascii=False) + "\n")
            anterior = inst
            time.sleep(hueco * 60)

    hilos = [threading.Thread(target=sonda, args=(h,)) for h in huecos]
    for t in hilos:
        t.start()
        time.sleep(3)  # escalonar las primeras llamadas
    for t in hilos:
        t.join()
    print(ruta)


# --- limpia ----------------------------------------------------------------------------------

def limpia():
    for f in aws("lambda", "list-functions")["Functions"]:
        if f["FunctionName"].startswith(PREFIJO):
            aws("lambda", "delete-function", "--function-name", f["FunctionName"],
                salida_json=False)
            print("borrada", f["FunctionName"])
    grupos = aws("logs", "describe-log-groups", "--log-group-name-prefix", "/aws/lambda/" + PREFIJO)
    for g in grupos.get("logGroups", []):
        aws("logs", "delete-log-group", "--log-group-name", g["logGroupName"], salida_json=False)
        print("borrado", g["logGroupName"])
    if aws("iam", "get-role", "--role-name", comun.ROL, tolera="NoSuchEntity"):
        aws("iam", "detach-role-policy", "--role-name", comun.ROL, "--policy-arn",
            "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole", salida_json=False)
        aws("iam", "delete-role", "--role-name", comun.ROL, salida_json=False)
        print("borrado el rol", comun.ROL)


if __name__ == "__main__":
    experimentos = {"apertura": apertura, "frio": frio, "init": init, "importa": importa, "pyc": pyc, "escala": escala,
                    "congela": congela, "reintentos": reintentos, "cpu": cpu, "vida": vida,
                    "limpia": limpia}
    if len(sys.argv) < 2 or sys.argv[1] not in experimentos:
        print(__doc__)
        sys.exit(1)
    args = [float(a) if "." in a else int(a) for a in sys.argv[2:]]
    experimentos[sys.argv[1]](*args)
