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
 *
 * COURSE-P11-02 — the slider label and the two readouts are
 * `courses.widgets.vanishing-gradient`; the verb the sentence turns on
 * (vanishes / explodes / holds) is an ICU `select`, not three concatenated strings, so a
 * language that inflects the rest of the sentence around it can. ρ, W and log₁₀ are
 * notation and do not move. The decimal separator follows the locale.
 */

"use client";

import { useLocale, useTranslations } from "next-intl";
import { useMemo, useState } from "react";

import { gradientMagnitudes, MAX_TANH_PRIME } from "../math/vanishing-gradient";
import { Plot2D } from "../primitives/Plot2D";
import { Slider } from "../primitives/Slider";

const MAX_DISTANCE = 40; // pasos entre la pérdida y el primer token — la T del ejemplo
const RHO_MIN = 0.2;
const RHO_MAX = 2.0;
const RHO_STEP = 0.05;
const DEFAULT_RHO = 0.6; // arranca desvaneciéndose, que es el fenómeno de la lección

export default function VanishingGradient() {
  const t = useTranslations("courses.widgets.vanishing-gradient");
  const locale = useLocale();
  // Spanish writes 0,60; English writes 0.60. Same number, same two decimals.
  const decimal = (v: number) => v.toFixed(2).replace(".", locale === "es" ? "," : ".");
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
  const verb = e < 0 ? "vanishes" : e > 0 ? "explodes" : "holds";
  const expStr = e < 0 ? `−${Math.abs(e)}` : e > 0 ? `+${e}` : "0";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem", width: "100%" }}>
      <Slider
        label={t("spectralRadius")}
        value={rho}
        min={RHO_MIN}
        max={RHO_MAX}
        step={RHO_STEP}
        onChange={setRho}
        format={decimal}
      />

      <Plot2D
        series={[{ points }]}
        xDomain={[0, MAX_DISTANCE]}
        yDomain={yDomain}
        ariaLabel={t("plotAria", { rho: decimal(rho), steps: MAX_DISTANCE, verb })}
      />

      <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>
        {t.rich("note", {
          steps: MAX_DISTANCE,
          verb,
          exponent: expStr,
          exp: (chunks) => <sup>{chunks}</sup>,
        })}
      </p>
    </div>
  );
}
