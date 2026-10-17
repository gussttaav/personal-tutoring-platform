import os
import subprocess
import sys
import time

ENTORNO = {**os.environ, "PYTHONPATH": os.environ["LAMBDA_TASK_ROOT"]}


def cronometra(codigo):
    inicio = time.perf_counter()
    subprocess.run([sys.executable, "-c", codigo], check=True, env=ENTORNO)
    return round(time.perf_counter() - inicio, 3)


def lambda_handler(event, context):
    # Imports pandas in a fresh process: it measures the same as the start, but can be repeated.
    return {"vacio_s": cronometra("pass"), "pandas_s": cronometra("import pandas")}
