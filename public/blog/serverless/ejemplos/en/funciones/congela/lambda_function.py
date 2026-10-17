import threading
import time

marcas = []


def tarea():
    # Twenty timestamps, one every 0.1 s: two seconds of work.
    for _ in range(20):
        time.sleep(0.1)
        marcas.append(time.time())


def lambda_handler(event, context):
    accion = (event.get("queryStringParameters") or {}).get("accion")
    if accion == "lanza":
        marcas.clear()
        inicio = time.time()
        threading.Thread(target=tarea).start()
        return {"lanzada": inicio}  # answers without waiting for the task
    time.sleep(3)
    return {"ahora": time.time(), "marcas": marcas}
