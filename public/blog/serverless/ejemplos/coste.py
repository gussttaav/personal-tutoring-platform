"""¿A partir de cuánto tráfico sale más barato un servidor que Lambda?

Precios bajo demanda de eu-west-1 (Irlanda), consultados con la API de precios de AWS el
16 de octubre de 2026 (`aws pricing get-products ...`, ver medir.py). Cambian: vuelve a
consultarlos antes de fiarte de los números.
"""

HORAS_MES = 730

# Lambda (Event Functions), x86, primer tramo.
LAMBDA_GB_S = 0.0000166667      # $ por GB-segundo
LAMBDA_PETICION = 0.20 / 1e6    # $ por petición
GRATIS_PETICIONES = 1_000_000   # capa gratuita mensual
GRATIS_GB_S = 400_000

# Servidores (EC2 bajo demanda, Linux).
C7G_MEDIUM = 0.0388   # $/h, 1 vCPU Graviton3, 2 GiB, sin créditos de CPU
ALB = 0.0252 + 0.008  # $/h, balanceador de aplicaciones + 1 LCU

PERFILES = {
    # nombre: (milisegundos por petición, MB de memoria)
    "API ligera (20 ms, 128 MB)": (20, 128),
    "API típica (100 ms, 512 MB)": (100, 512),
    "Trabajo pesado (1 s, 1769 MB)": (1000, 1769),
}


def lambda_mes(peticiones, ms, mb, capa_gratuita=True):
    gb_s = peticiones * ms / 1000 * mb / 1024
    if capa_gratuita:
        peticiones = max(0, peticiones - GRATIS_PETICIONES)
        gb_s = max(0, gb_s - GRATIS_GB_S)
    return peticiones * LAMBDA_PETICION + gb_s * LAMBDA_GB_S


def cruce(coste_servidor, ms, mb):
    """Peticiones al mes en las que Lambda (sin capa gratuita) iguala al servidor."""
    por_peticion = LAMBDA_PETICION + ms / 1000 * mb / 1024 * LAMBDA_GB_S
    return coste_servidor / por_peticion


if __name__ == "__main__":
    uno = C7G_MEDIUM * HORAS_MES
    dos = (2 * C7G_MEDIUM + ALB) * HORAS_MES
    print(f"un c7g.medium: {uno:.2f} $/mes; dos + balanceador: {dos:.2f} $/mes\n")
    segundos_mes = HORAS_MES * 3600
    for nombre, (ms, mb) in PERFILES.items():
        print(nombre)
        for etiqueta, coste in (("un servidor", uno), ("dos + balanceador", dos)):
            n = cruce(coste, ms, mb)
            rps = n / segundos_mes
            print(f"  frente a {etiqueta:18}: {n / 1e6:7.1f} M peticiones/mes "
                  f"= {rps:6.2f} por segundo de media")
        for n in (1e5, 1e6, 1e7, 1e8):
            print(f"  {n:>12,.0f} peticiones/mes → Lambda {lambda_mes(n, ms, mb):8.2f} $"
                  f" (sin capa gratuita {lambda_mes(n, ms, mb, False):8.2f} $)")
        print()
    # Precio de una vCPU ocupada una hora entera.
    vcpu_h_lambda = 1769 / 1024 * 3600 * LAMBDA_GB_S
    print(f"una vCPU-hora en Lambda (1769 MB): {vcpu_h_lambda:.4f} $;"
          f" en un c7g.medium: {C7G_MEDIUM:.4f} $ ({vcpu_h_lambda / C7G_MEDIUM:.1f} veces menos)")
