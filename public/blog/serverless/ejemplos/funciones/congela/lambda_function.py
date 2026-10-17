import threading
import time

marcas = []


def tarea():
    # Veinte marcas de tiempo, una cada 0,1 s: dos segundos de trabajo.
    for _ in range(20):
        time.sleep(0.1)
        marcas.append(time.time())


def lambda_handler(event, context):
    accion = (event.get("queryStringParameters") or {}).get("accion")
    if accion == "lanza":
        marcas.clear()
        inicio = time.time()
        threading.Thread(target=tarea).start()
        return {"lanzada": inicio}  # responde sin esperar a la tarea
    time.sleep(3)
    return {"ahora": time.time(), "marcas": marcas}
