import time
import uuid

# This runs only once, when the instance starts.
INSTANCIA = uuid.uuid4().hex[:8]
CREADA = time.time()
llamadas = 0


def lambda_handler(event, context):
    # And this, on every request.
    global llamadas
    llamadas += 1
    espera = float((event.get("queryStringParameters") or {}).get("espera", 0))
    time.sleep(espera)
    return {"instancia": INSTANCIA, "llamadas": llamadas,
            "edad_s": round(time.time() - CREADA, 1)}
