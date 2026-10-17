"""From how much traffic is a server cheaper than Lambda?

English-commented copy of ../coste.py. On-demand prices for eu-west-1 (Ireland), looked up
with the AWS Price List API on 16 October 2026 (`aws pricing get-products ...`). They change:
look them up again before you trust the numbers.
"""

HORAS_MES = 730

# Lambda (Event Functions), x86, first pricing tier.
LAMBDA_GB_S = 0.0000166667      # $ per GB-second
LAMBDA_PETICION = 0.20 / 1e6    # $ per request
GRATIS_PETICIONES = 1_000_000   # monthly free tier
GRATIS_GB_S = 400_000

# Servers (on-demand EC2, Linux).
C7G_MEDIUM = 0.0388   # $/h, 1 vCPU Graviton3, 2 GiB, no CPU credits
ALB = 0.0252 + 0.008  # $/h, application load balancer + 1 LCU

PERFILES = {
    # name: (milliseconds per request, MB of memory)
    "Light API (20 ms, 128 MB)": (20, 128),
    "Typical API (100 ms, 512 MB)": (100, 512),
    "Heavy job (1 s, 1769 MB)": (1000, 1769),
}


def lambda_mes(peticiones, ms, mb, capa_gratuita=True):
    gb_s = peticiones * ms / 1000 * mb / 1024
    if capa_gratuita:
        peticiones = max(0, peticiones - GRATIS_PETICIONES)
        gb_s = max(0, gb_s - GRATIS_GB_S)
    return peticiones * LAMBDA_PETICION + gb_s * LAMBDA_GB_S


def cruce(coste_servidor, ms, mb):
    """Requests per month at which Lambda (without the free tier) costs the same as the server."""
    por_peticion = LAMBDA_PETICION + ms / 1000 * mb / 1024 * LAMBDA_GB_S
    return coste_servidor / por_peticion


if __name__ == "__main__":
    uno = C7G_MEDIUM * HORAS_MES
    dos = (2 * C7G_MEDIUM + ALB) * HORAS_MES
    print(f"one c7g.medium: {uno:.2f} $/month; two + load balancer: {dos:.2f} $/month\n")
    segundos_mes = HORAS_MES * 3600
    for nombre, (ms, mb) in PERFILES.items():
        print(nombre)
        for etiqueta, coste in (("one server", uno), ("two + load balancer", dos)):
            n = cruce(coste, ms, mb)
            rps = n / segundos_mes
            print(f"  against {etiqueta:20}: {n / 1e6:7.1f} M requests/month "
                  f"= {rps:6.2f} per second on average")
        for n in (1e5, 1e6, 1e7, 1e8):
            print(f"  {n:>12,.0f} requests/month → Lambda {lambda_mes(n, ms, mb):8.2f} $"
                  f" (without free tier {lambda_mes(n, ms, mb, False):8.2f} $)")
        print()
    # The price of one vCPU kept busy for a whole hour.
    vcpu_h_lambda = 1769 / 1024 * 3600 * LAMBDA_GB_S
    print(f"one vCPU-hour on Lambda (1769 MB): {vcpu_h_lambda:.4f} $;"
          f" on a c7g.medium: {C7G_MEDIUM:.4f} $ ({vcpu_h_lambda / C7G_MEDIUM:.1f} times less)")
