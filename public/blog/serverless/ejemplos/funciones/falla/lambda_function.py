import time


def lambda_handler(event, context):
    print(f"intento de {context.aws_request_id} a las {time.time():.1f}")
    raise RuntimeError("fallo a propósito")
