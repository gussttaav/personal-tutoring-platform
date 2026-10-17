import hashlib
import os
import time


def modelo_cpu():
    with open("/proc/cpuinfo") as f:
        for linea in f:
            if linea.startswith("model name"):
                return linea.split(":", 1)[1].strip()
    return "?"


def lambda_handler(event, context):
    vueltas = int((event.get("queryStringParameters") or {}).get("vueltas", 300000))
    inicio = time.perf_counter()
    h = b"serverless"
    for _ in range(vueltas):
        h = hashlib.sha256(h).digest()
    return {"segundos": round(time.perf_counter() - inicio, 4),
            "cpus": os.cpu_count(), "cpu": modelo_cpu(),
            "memoria_mb": int(context.memory_limit_in_mb)}
