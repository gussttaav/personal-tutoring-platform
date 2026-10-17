import boto3  # noqa: F401  (sólo para medir lo que cuesta importarlo)
import time
import uuid

# Esto se ejecuta una sola vez, cuando la instancia arranca.
INSTANCIA = uuid.uuid4().hex[:8]
CREADA = time.time()
llamadas = 0


def lambda_handler(event, context):
    # Y esto, en cada petición.
    global llamadas
    llamadas += 1
    espera = float((event.get("queryStringParameters") or {}).get("espera", 0))
    time.sleep(espera)
    return {"instancia": INSTANCIA, "llamadas": llamadas,
            "edad_s": round(time.time() - CREADA, 1)}
