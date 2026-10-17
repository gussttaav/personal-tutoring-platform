"""Utilidades comunes de los experimentos: crear funciones Lambda, llamarlas y leer sus registros.

Sólo usa la biblioteca estándar de Python, la AWS CLI (v2) y curl. Todos los recursos que crea
llevan el prefijo PREFIJO, y `python3 medir.py limpia` los borra.
"""

import io
import json
import os
import re
import subprocess
import tempfile
import time
import zipfile

PREFIJO = "blog-sls-"
ROL = PREFIJO + "rol"
RUNTIME = os.environ.get("RUNTIME", "python3.14")
AQUI = os.path.dirname(os.path.abspath(__file__))
FUNCIONES = os.path.join(AQUI, "funciones")
RESULTADOS = os.path.join(AQUI, "resultados")


def aws(*args, salida_json=True, tolera=None):
    """Ejecuta `aws ...` y devuelve su salida JSON. `tolera` es un texto de error que se ignora."""
    cmd = ["aws", *args] + (["--output", "json"] if salida_json else [])
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        if tolera and tolera in r.stderr:
            return None
        raise RuntimeError(f"{' '.join(cmd)}\n{r.stderr}")
    return json.loads(r.stdout) if salida_json and r.stdout.strip() else r.stdout


def asegura_rol():
    """Rol de ejecución mínimo: la función sólo puede escribir sus registros en CloudWatch."""
    try:
        return aws("iam", "get-role", "--role-name", ROL)["Role"]["Arn"]
    except RuntimeError:
        pass
    confianza = {"Version": "2012-10-17", "Statement": [{
        "Effect": "Allow", "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"}]}
    arn = aws("iam", "create-role", "--role-name", ROL,
              "--assume-role-policy-document", json.dumps(confianza))["Role"]["Arn"]
    aws("iam", "attach-role-policy", "--role-name", ROL, "--policy-arn",
        "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole", salida_json=False)
    time.sleep(10)  # IAM tarda unos segundos en propagar un rol nuevo
    return arn


def empaqueta(carpeta, extra=None):
    """Zip en memoria con el contenido de `carpeta` (y de `extra`, si se da)."""
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as z:
        for base in [carpeta] + ([extra] if extra else []):
            for raiz, _, ficheros in os.walk(base):
                for f in ficheros:
                    ruta = os.path.join(raiz, f)
                    z.write(ruta, os.path.relpath(ruta, base))
    return buf.getvalue()


def espera_lista(nombre):
    """Espera a que termine el último cambio de código o de configuración."""
    while True:
        c = aws("lambda", "get-function-configuration", "--function-name", nombre)
        if c.get("State") == "Active" and c.get("LastUpdateStatus") in ("Successful", None):
            return c
        if c.get("LastUpdateStatus") == "Failed" or c.get("State") == "Failed":
            raise RuntimeError(f"{nombre}: {c.get('LastUpdateStatusReason') or c.get('StateReason')}")
        time.sleep(1)


def crea_funcion(nombre, carpeta, memoria=128, timeout=30, extra=None, url=True):
    """Crea (o actualiza) la función `PREFIJO+nombre` y, si `url`, le da una Function URL pública."""
    nombre = PREFIJO + nombre
    with tempfile.NamedTemporaryFile(suffix=".zip", delete=False) as t:
        t.write(empaqueta(carpeta, extra))
        zip_path = t.name
    try:
        if aws("lambda", "get-function", "--function-name", nombre,
               tolera="ResourceNotFoundException") is None:
            aws("lambda", "create-function", "--function-name", nombre, "--runtime", RUNTIME,
                "--handler", "lambda_function.lambda_handler", "--role", asegura_rol(),
                "--zip-file", f"fileb://{zip_path}", "--memory-size", str(memoria),
                "--timeout", str(timeout), "--tags", "proyecto=blog-serverless")
            aws("logs", "create-log-group", "--log-group-name", f"/aws/lambda/{nombre}",
                salida_json=False, tolera="ResourceAlreadyExistsException")
            aws("logs", "put-retention-policy", "--log-group-name", f"/aws/lambda/{nombre}",
                "--retention-in-days", "7", salida_json=False)
        else:
            espera_lista(nombre)
            aws("lambda", "update-function-code", "--function-name", nombre,
                "--zip-file", f"fileb://{zip_path}")
            espera_lista(nombre)
            aws("lambda", "update-function-configuration", "--function-name", nombre,
                "--memory-size", str(memoria), "--timeout", str(timeout))
        espera_lista(nombre)
    finally:
        os.unlink(zip_path)
    return url_de(nombre) if url else None


def url_de(nombre):
    """Function URL sin autenticación (AuthType NONE): cualquiera que la conozca puede llamarla."""
    c = aws("lambda", "get-function-url-config", "--function-name", nombre,
            tolera="ResourceNotFoundException")
    if c:
        return c["FunctionUrl"]
    c = aws("lambda", "create-function-url-config", "--function-name", nombre, "--auth-type", "NONE")
    aws("lambda", "add-permission", "--function-name", nombre, "--statement-id", "url-publica",
        "--action", "lambda:InvokeFunctionUrl", "--principal", "*",
        "--function-url-auth-type", "NONE")
    # Desde octubre de 2025, una Function URL nueva también necesita lambda:InvokeFunction.
    aws("lambda", "add-permission", "--function-name", nombre, "--statement-id", "url-publica-invoke",
        "--action", "lambda:InvokeFunction", "--principal", "*",
        "--invoked-via-function-url", tolera="Unknown options")
    time.sleep(5)
    return c["FunctionUrl"]


def cambia_memoria(nombre, memoria):
    nombre = PREFIJO + nombre
    espera_lista(nombre)
    aws("lambda", "update-function-configuration", "--function-name", nombre,
        "--memory-size", str(memoria))
    espera_lista(nombre)


def fuerza_frio(nombre):
    """Cambiar la configuración obliga a Lambda a descartar las instancias que tenía."""
    nombre = PREFIJO + nombre
    espera_lista(nombre)
    aws("lambda", "update-function-configuration", "--function-name", nombre,
        "--environment", json.dumps({"Variables": {"FRIO": str(time.time_ns())}}))
    espera_lista(nombre)


def llama(url, **params):
    """Llama a la Function URL con curl. Devuelve tiempos (s), estado, request id y cuerpo."""
    if params:
        url = url + "?" + "&".join(f"{k}={v}" for k, v in params.items())
    with tempfile.TemporaryDirectory() as d:
        cuerpo, cabeceras = os.path.join(d, "b"), os.path.join(d, "h")
        r = subprocess.run(["curl", "-s", "-o", cuerpo, "-D", cabeceras, "-w", "%{json}",
                            "--max-time", "120", url], capture_output=True, text=True)
        w = json.loads(r.stdout)
        texto = open(cuerpo).read() if os.path.exists(cuerpo) else ""
        hdr = open(cabeceras).read() if os.path.exists(cabeceras) else ""
    m = re.search(r"(?im)^x-amzn-requestid:\s*(\S+)", hdr)
    try:
        datos = json.loads(texto)
    except ValueError:
        datos = texto
    return {
        "t": time.time(),
        "estado": w.get("http_code"),
        "request_id": m.group(1) if m else None,
        "conexion": w.get("time_connect"),         # TCP
        "tls": w.get("time_appconnect"),           # TCP + TLS
        "primer_byte": w.get("time_starttransfer"),
        "total": w.get("time_total"),
        "cuerpo": datos,
    }


REPORT = re.compile(
    r"REPORT RequestId: (?P<id>\S+)\s+Duration: (?P<dur>[\d.]+) ms\s+"
    r"Billed Duration: (?P<fact>\d+) ms\s+Memory Size: (?P<mem>\d+) MB\s+"
    r"Max Memory Used: (?P<usada>\d+) MB(?:\s+Init Duration: (?P<init>[\d.]+) ms)?")


def informes(nombre, desde_ms, cuantos=None, espera_max=90):
    """Líneas REPORT de la función desde `desde_ms`, como dicts por request id."""
    nombre = PREFIJO + nombre
    fin = time.time() + espera_max
    while True:
        res, token = {}, None
        while True:
            args = ["logs", "filter-log-events", "--log-group-name", f"/aws/lambda/{nombre}",
                    "--start-time", str(desde_ms), "--filter-pattern", '"REPORT RequestId"']
            if token:
                args += ["--next-token", token]
            r = aws(*args, tolera="ResourceNotFoundException") or {}
            for e in r.get("events", []):
                m = REPORT.search(e["message"])
                if m:
                    res[m["id"]] = {
                        "duracion_ms": float(m["dur"]), "facturado_ms": int(m["fact"]),
                        "memoria_mb": int(m["mem"]), "usada_mb": int(m["usada"]),
                        "init_ms": float(m["init"]) if m["init"] else None,
                    }
            token = r.get("nextToken")
            if not token:
                break
        if cuantos is None or len(res) >= cuantos or time.time() > fin:
            return res
        time.sleep(5)


def guarda(nombre, datos):
    os.makedirs(RESULTADOS, exist_ok=True)
    ruta = os.path.join(RESULTADOS, nombre + ".json")
    with open(ruta, "w") as f:
        json.dump(datos, f, indent=1, ensure_ascii=False)
    return ruta


def ahora_ms():
    return int(time.time() * 1000)
