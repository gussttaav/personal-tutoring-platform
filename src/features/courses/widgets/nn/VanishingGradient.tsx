/*
 * COURSE-P5-03 — `vanishing-gradient`: slide the spectral radius of W_hh and watch
 * the magnitude of the transported gradient, in ORDERS OF MAGNITUDE, against the
 * distance it has to travel back through the sequence. The exponential in the BPTT
 * product (Block 3 lesson 3) is abstract on the page and a straight line here: its
 * slope is log₁₀ of the per-step factor, so below ρ = 1 it slopes down to nothing
 * (vanishing) and above ρ = 1 it slopes up without bound (exploding). Pure envelope
 * from math/vanishing-gradient (unit-tested); local state only.
 *
 * The y axis is log₁₀ on purpose: a linear axis cannot show a decay to 10⁻¹² and an
 * explosion to 10⁺¹² in the same frame, and its tick labels run to twelve digits. On
 * a log axis the value IS the order of magnitude the prose quotes, and the zero line
 * is the size the gradient started at.
 */

"use client";

import { useMemo, useState } from "react";

import { gradientMagnitudes, MAX_TANH_PRIME } from "../math/vanishing-gradient";
import { Plot2D } from "../primitives/Plot2D";
import { Slider } from "../primitives/Slider";

const MAX_DISTANCE = 40; // pasos entre la pérdida y el primer token — la T del ejemplo
const RHO_MIN = 0.2;
const RHO_MAX = 2.0;
const RHO_STEP = 0.05;
const DEFAULT_RHO = 0.6; // arranca desvaneciéndose, que es el fenómeno de la lección

const comma = (v: number) => v.toFixed(2).replace(".", ",");

export default function VanishingGradient() {
  const [rho, setRho] = useState(DEFAULT_RHO);

  const { points, yDomain, ordersAtEnd } = useMemo(() => {
    // γ = 1: the most favourable mask (tanh at its steepest). Even so, ρ < 1 vanishes;
    // saturation only deepens the decay, which is the point the prose makes.
    const mags = gradientMagnitudes(rho, MAX_TANH_PRIME, MAX_DISTANCE);
    const points = mags.map((m, d) => [d, Math.log10(m)] as [number, number]);
    const ys = points.map((p) => p[1]);
    // Always include 0 (the starting size) so the crossover line is on screen.
    const lo = Math.min(0, ...ys);
    const hi = Math.max(0, ...ys);
    const yDomain: [number, number] = [Math.floor(lo) - 1, Math.ceil(hi) + 1];
    return { points, yDomain, ordersAtEnd: ys[ys.length - 1] };
  }, [rho]);

  const e = Math.round(ordersAtEnd);
  const verb = e < 0 ? "se desvanece" : e > 0 ? "explota" : "se mantiene";
  const expStr = e < 0 ? `−${Math.abs(e)}` : e > 0 ? `+${e}` : "0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%" }}>
      <Slider
        label="Radio espectral ρ de Wₕₕ"
        value={rho}
        min={RHO_MIN}
        max={RHO_MAX}
        step={RHO_STEP}
        onChange={setRho}
        format={comma}
      />

      <Plot2D
        series={[{ points }]}
        xDomain={[0, MAX_DISTANCE]}
        yDomain={yDomain}
        ariaLabel={`Magnitud del gradiente en órdenes de magnitud (log decimal) frente a la distancia en pasos, para un radio espectral de ${comma(rho)}. A ${MAX_DISTANCE} pasos el gradiente ${verb}.`}
      />

      <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>
        Eje vertical: órdenes de magnitud (log₁₀); el 0 es el tamaño de partida. A {MAX_DISTANCE} pasos
        de distancia, el gradiente {verb}: ‖·‖ pasa a ≈ 10<sup>{expStr}</sup> veces lo que valía.
      </p>
    </div>
  );
}
