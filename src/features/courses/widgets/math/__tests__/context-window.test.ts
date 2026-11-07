/*
 * COURSE-C2-P1-03 — `math/context-window.ts`, checked two independent ways, as AUTHORING §7
 * asks of a widget's maths:
 *
 *   1. THE CONTRACT, AT EVERY WINDOW — for every tCtx the slider reaches, each policy keeps
 *      the invariants the lesson states: the call fits, the reserve is always there, what stays
 *      keeps its order, "drop" never cuts and never removes a pinned segment, the segments it
 *      removes are a prefix of the rank order (and the shortest one that fits, recounted by
 *      brute force), "front" keeps exactly the last tCtx − reserve tokens of the prompt.
 *   2. THE LESSON'S NUMBERS — what the intuition paragraph reads off the widget at its
 *      default window of 2 560 tokens.
 *
 * COURSE-C2-P1-04 — the same two checks for the `agente` preset (Block 4 lesson 6), plus the
 * rule it needs: segments sharing a drop rank leave together, so "drop" never leaves a
 * turno's llamadas without their observaciones.
 *
 * COURSE-C2-P1-05 — the `compactacion` preset (Block 5 lesson 5): its measured sizes add up to
 * the petición the lesson's trace reports, "compact" keeps `compactar.py`'s contract (the
 * inicio and the last two turnos verbatim, never half a turno) at every window, and the
 * `margin` makes it fire at the umbral, while everything still fits.
 */

import {
  AGENT_PRESET,
  ASSISTANT_PRESET,
  COMPACTION_PRESET,
  SUMMARY_ID,
  dropGroups,
  fitWindow,
  type Fit,
  type Policy,
  type WindowPreset,
} from "../context-window";

const sum = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const P = ASSISTANT_PRESET;
const reserve = P.segments[P.segments.length - 1].tokens;
const windows: number[] = [];
for (let t = P.tCtxMin; t <= P.tCtxMax; t += P.tCtxStep) windows.push(t);

const ids = (fit: Fit) => fit.call.map((p) => p.segment.id);
const status = (fit: Fit, id: string) => fit.placed.find((p) => p.segment.id === id)?.status;

/** True when `sub` appears in `full` in the same relative order. */
function isSubsequence(sub: readonly string[], full: readonly string[]): boolean {
  let i = 0;
  for (const x of full) if (x === sub[i]) i++;
  return i === sub.length;
}

describe("context-window — the preset", () => {
  it("is in prompt order, ends on the reserve, and holds more than the largest window", () => {
    expect(P.segments[P.segments.length - 1].kind).toBe("respuesta");
    expect(P.segments[P.segments.length - 1].drop).toBeUndefined();
    expect(sum(P.segments.map((s) => s.tokens))).toBe(3_410);
    expect(new Set(P.segments.map((s) => s.id)).size).toBe(P.segments.length);
    expect(P.tCtxDefault).toBeGreaterThanOrEqual(P.tCtxMin);
    expect(P.tCtxDefault).toBeLessThanOrEqual(P.tCtxMax);
  });

  it("drops turns oldest first, then pasajes worst first", () => {
    const ranked = P.segments.filter((s) => s.drop !== undefined).sort((a, b) => a.drop! - b.drop!);
    expect(ranked.map((s) => s.id)).toEqual([
      "turno-1", "turno-2", "turno-3", "turno-4", "turno-5", "turno-6",
      "pasaje-5", "pasaje-4", "pasaje-3", "pasaje-2", "pasaje-1",
    ]);
  });
});

describe.each<Policy>(["front", "drop", "compact"])("context-window — %s, at every window", (policy) => {
  it.each(windows)("tCtx = %i: fits, keeps the reserve, keeps the order", (tCtx) => {
    const fit = fitWindow(P, tCtx, policy);
    const pinnedTotal = sum(P.segments.filter((s) => s.drop === undefined).map((s) => s.tokens));
    if (policy === "drop") expect(fit.fits).toBe(pinnedTotal <= tCtx);
    if (fit.fits) expect(fit.used).toBeLessThanOrEqual(tCtx);
    expect(fit.used).toBe(sum(fit.call.map((p) => p.kept)));
    expect(fit.total).toBe(3_410);
    expect(ids(fit)[ids(fit).length - 1]).toBe("respuesta");
    const original = P.segments.map((s) => s.id);
    const kept = ids(fit).filter((id) => id !== SUMMARY_ID);
    expect(isSubsequence(kept, original)).toBe(true);
  });
});

describe("context-window — front: the model keeps the last tokens", () => {
  it.each(windows)("tCtx = %i: exactly the last tCtx − reserve tokens of the prompt", (tCtx) => {
    const fit = fitWindow(P, tCtx, "front");
    const prompt = sum(P.segments.slice(0, -1).map((s) => s.tokens));
    expect(fit.used - reserve).toBe(Math.min(prompt, tCtx - reserve));
    // At most one segment is cut, and everything before it is gone, everything after whole.
    const st = fit.placed.map((p) => p.status);
    const firstKept = st.findIndex((s) => s !== "dropped");
    expect(st.slice(0, firstKept).every((s) => s === "dropped")).toBe(true);
    expect(st.slice(firstKept + 1).every((s) => s === "whole")).toBe(true);
  });

  it("loses the prompt de sistema first", () => {
    const fit = fitWindow(P, 3_200, "front");
    expect(status(fit, "sistema")).toBe("cut");
    expect(fit.placed.find((p) => p.segment.id === "sistema")?.kept).toBe(110);
  });
});

describe("context-window — drop: whole segments, by rank, as few as possible", () => {
  /** The brute-force answer: the shortest prefix of the rank order whose removal fits. */
  function bruteForce(preset: WindowPreset, tCtx: number): string[] {
    const ranked = preset.segments.filter((s) => s.drop !== undefined).sort((a, b) => a.drop! - b.drop!);
    const total = sum(preset.segments.map((s) => s.tokens));
    for (let k = 0; k <= ranked.length; k++) {
      const removed = ranked.slice(0, k);
      if (total - sum(removed.map((s) => s.tokens)) <= tCtx) return removed.map((s) => s.id);
    }
    return ranked.map((s) => s.id);
  }

  it.each(windows)("tCtx = %i: removes the shortest prefix that fits, cuts nothing", (tCtx) => {
    const fit = fitWindow(P, tCtx, "drop");
    const dropped = fit.placed.filter((p) => p.status === "dropped").map((p) => p.segment.id);
    expect(new Set(dropped)).toEqual(new Set(bruteForce(P, tCtx)));
    expect(fit.placed.every((p) => p.status !== "cut")).toBe(true);
    for (const p of fit.placed) {
      if (p.segment.drop === undefined) expect(p.status).toBe("whole");
    }
  });

  it("drops nothing when everything fits", () => {
    const fit = fitWindow(P, 4_096, "drop");
    expect(fit.used).toBe(3_410);
    expect(fit.placed.every((p) => p.status === "whole")).toBe(true);
  });

  it("refuses rather than cuts when the pinned segments overflow", () => {
    const fit = fitWindow(P, 768, "drop");
    expect(fit.fits).toBe(false);
    expect(fit.used).toBe(320 + 130 + 130 + 40 + 400);
    expect(fit.placed.every((p) => p.status !== "cut")).toBe(true);
  });
});

describe("context-window — compact: the old turns become one summary", () => {
  it.each(windows)("tCtx = %i: keeps the last two turns verbatim, or does not fire", (tCtx) => {
    const fit = fitWindow(P, tCtx, "compact");
    if (tCtx >= 3_410) {
      expect(fit.summary).toBeUndefined();
      return;
    }
    expect(fit.summary?.replaced).toBe(210 + 150 + 280 + 170);
    expect(ids(fit)).toContain(SUMMARY_ID);
    expect(ids(fit)).toEqual(expect.arrayContaining(["turno-5", "turno-6"]));
    // The summary sits where the first turn was: after the ejemplos, before the recent turns.
    const order = ids(fit);
    expect(order.indexOf(SUMMARY_ID)).toBe(order.indexOf("ejemplo-2") + 1);
    expect(order.indexOf("turno-5")).toBe(order.indexOf(SUMMARY_ID) + 1);
    for (const n of [1, 2, 3, 4]) expect(status(fit, `turno-${n}`)).toBe("compacted");
  });
});

describe("context-window — the numbers the lesson reads at 2 560 tokens", () => {
  const tCtx = P.tCtxDefault;

  it("the window is the default the widget opens on", () => {
    expect(tCtx).toBe(2_560);
  });

  it("front: the prompt de sistema, both ejemplos and the first turn fall off, the second is cut", () => {
    const fit = fitWindow(P, tCtx, "front");
    for (const id of ["sistema", "ejemplo-1", "ejemplo-2", "turno-1"]) expect(status(fit, id)).toBe("dropped");
    expect(status(fit, "turno-2")).toBe("cut");
    expect(fit.placed.find((p) => p.segment.id === "turno-2")?.kept).toBe(90);
    expect(fit.used).toBe(2_560);
  });

  it("drop: five turns go, the last turn and the five pasajes stay", () => {
    const fit = fitWindow(P, tCtx, "drop");
    for (const n of [1, 2, 3, 4, 5]) expect(status(fit, `turno-${n}`)).toBe("dropped");
    expect(status(fit, "turno-6")).toBe("whole");
    for (const n of [1, 2, 3, 4, 5]) expect(status(fit, `pasaje-${n}`)).toBe("whole");
    expect(fit.used).toBe(2_360);
  });

  it("compact: 810 tokens of turns become 180, and the worst pasaje goes", () => {
    const fit = fitWindow(P, tCtx, "compact");
    expect(fit.summary?.replaced).toBe(810);
    expect(status(fit, "pasaje-5")).toBe("dropped");
    for (const n of [1, 2, 3, 4]) expect(status(fit, `pasaje-${n}`)).toBe("whole");
    expect(status(fit, "turno-5")).toBe("whole");
    expect(status(fit, "turno-6")).toBe("whole");
    expect(fit.used).toBe(2_560);
  });
});

describe("context-window — agente: the preset", () => {
  const A = AGENT_PRESET;

  it("is in prompt order, ends on the reserve, and holds less than the largest window", () => {
    expect(A.segments[A.segments.length - 1].kind).toBe("respuesta");
    expect(new Set(A.segments.map((s) => s.id)).size).toBe(A.segments.length);
    expect(sum(A.segments.map((s) => s.tokens))).toBe(4_840);
    expect(A.tCtxMax).toBeGreaterThanOrEqual(4_840);
    expect((A.tCtxDefault - A.tCtxMin) % A.tCtxStep).toBe(0);
    expect((A.tCtxMax - A.tCtxMin) % A.tCtxStep).toBe(0);
  });

  it("each turno is one drop unit, llamadas then observaciones, oldest first", () => {
    expect(dropGroups(A.segments).map((g) => g.map((s) => s.id))).toEqual(
      [1, 2, 3, 4, 5, 6].map((n) => [`llamadas-${n}`, `observaciones-${n}`]),
    );
  });

  it("the turnos add 3 280 tokens, 2 440 of them observaciones", () => {
    const turns = A.segments.filter((s) => s.drop !== undefined);
    expect(sum(turns.map((s) => s.tokens))).toBe(3_280);
    expect(sum(turns.filter((s) => s.kind === "observaciones").map((s) => s.tokens))).toBe(2_440);
  });
});

describe("context-window — agente, at every window", () => {
  const A = AGENT_PRESET;
  const agentWindows: number[] = [];
  for (let t = A.tCtxMin; t <= A.tCtxMax; t += A.tCtxStep) agentWindows.push(t);

  /** The brute-force answer: the shortest prefix of the rank groups whose removal fits. */
  function bruteForce(tCtx: number): string[] {
    const groups = dropGroups(A.segments);
    const total = sum(A.segments.map((s) => s.tokens));
    for (let k = 0; k <= groups.length; k++) {
      const removed = groups.slice(0, k).flat();
      if (total - sum(removed.map((s) => s.tokens)) <= tCtx) return removed.map((s) => s.id);
    }
    return groups.flat().map((s) => s.id);
  }

  it.each(agentWindows)("tCtx = %i: every policy fits and keeps the order and the reserve", (tCtx) => {
    for (const policy of ["front", "drop", "compact"] as const) {
      const fit = fitWindow(A, tCtx, policy);
      if (fit.fits) expect(fit.used).toBeLessThanOrEqual(tCtx);
      expect(ids(fit)[ids(fit).length - 1]).toBe("respuesta");
      const kept = ids(fit).filter((id) => id !== SUMMARY_ID);
      expect(isSubsequence(kept, A.segments.map((s) => s.id))).toBe(true);
    }
  });

  it.each(agentWindows)("tCtx = %i: drop removes whole turnos, never a llamada without its observación", (tCtx) => {
    const fit = fitWindow(A, tCtx, "drop");
    const dropped = fit.placed.filter((p) => p.status === "dropped").map((p) => p.segment.id);
    expect(new Set(dropped)).toEqual(new Set(bruteForce(tCtx)));
    for (let n = 1; n <= 6; n++) expect(status(fit, `llamadas-${n}`)).toBe(status(fit, `observaciones-${n}`));
    for (const id of ["sistema", "herramientas", "pedido", "respuesta"]) expect(status(fit, id)).toBe("whole");
  });
});

describe("context-window — agente: the numbers the lesson reads", () => {
  const A = AGENT_PRESET;
  const tCtx = A.tCtxDefault;

  it("the window is the default the widget opens on", () => {
    expect(tCtx).toBe(3_584);
  });

  it("front: the prompt de sistema, the herramientas, the pedido and turno 1 fall off; turno 2 loses its llamadas and the start of its observaciones", () => {
    const fit = fitWindow(A, tCtx, "front");
    for (const id of ["sistema", "herramientas", "pedido", "llamadas-1", "observaciones-1", "llamadas-2"]) {
      expect(status(fit, id)).toBe("dropped");
    }
    expect(status(fit, "observaciones-2")).toBe("cut");
    expect(fit.placed.find((p) => p.segment.id === "observaciones-2")?.kept).toBe(1_074);
    expect(fit.used).toBe(3_584);
  });

  it("drop: turnos 1 and 2 go whole, the rest stays", () => {
    const fit = fitWindow(A, tCtx, "drop");
    for (const n of [1, 2]) expect(status(fit, `observaciones-${n}`)).toBe("dropped");
    for (const n of [3, 4, 5, 6]) expect(status(fit, `observaciones-${n}`)).toBe("whole");
    expect(fit.used).toBe(3_470);
  });

  it("compact: turnos 1 to 5 become one summary", () => {
    const fit = fitWindow(A, tCtx, "compact");
    expect(fit.summary?.replaced).toBe(3_110);
    expect(fit.used).toBe(1_930);
  });

  it("at 1 536 tokens, what drop never removes no longer fits", () => {
    const fit = fitWindow(A, 1_536, "drop");
    expect(fit.fits).toBe(false);
    expect(fit.used).toBe(280 + 620 + 60 + 600);
  });
});

describe("context-window — compactacion: the measured petición", () => {
  const C = COMPACTION_PRESET;
  const prompt = C.segments.filter((s) => s.kind !== "respuesta");

  it("is the tenth petición of the trace: 7 471 tokens, the inicio 1 044 of them", () => {
    expect(sum(prompt.map((s) => s.tokens))).toBe(7_471);
    expect(sum(prompt.filter((s) => s.drop === undefined).map((s) => s.tokens))).toBe(1_044);
    expect(C.segments[C.segments.length - 1]).toMatchObject({ kind: "respuesta", tokens: 1_024 });
    expect((C.tCtxDefault - C.tCtxMin) % C.tCtxStep).toBe(0);
    expect((C.tCtxMax - C.tCtxMin) % C.tCtxStep).toBe(0);
  });

  it("the margin puts the umbral where compactar.py has it: 8 192 − 1 024 − 3 072 = 4 096", () => {
    expect(C.tCtxDefault - 1_024 - C.margin!).toBe(4_096);
  });
});

describe("context-window — compactacion, at every window", () => {
  const C = COMPACTION_PRESET;
  const total = sum(C.segments.map((s) => s.tokens));
  const all: number[] = [];
  for (let t = C.tCtxMin; t <= C.tCtxMax; t += C.tCtxStep) all.push(t);

  it.each(all)("tCtx = %i: compact keeps the inicio and turnos 8 and 9, and never splits a turno", (tCtx) => {
    const fit = fitWindow(C, tCtx, "compact");
    for (const id of ["sistema", "herramientas", "proyecto", "pedido", "respuesta"]) expect(status(fit, id)).toBe("whole");
    for (let n = 1; n <= 9; n++) expect(status(fit, `llamadas-${n}`)).toBe(status(fit, `observaciones-${n}`));
    if (fit.summary) for (const n of [8, 9]) expect(status(fit, `observaciones-${n}`)).toBe("whole");
    if (fit.fits) expect(fit.used).toBeLessThanOrEqual(tCtx);
  });

  it.each(all)("tCtx = %i: compact fires exactly when what the call leaves free is under the margin", (tCtx) => {
    const fit = fitWindow(C, tCtx, "compact");
    expect(fit.summary !== undefined).toBe(total + C.margin! > tCtx);
  });
});

describe("context-window — compactacion: the numbers the lesson reads at 8 192 tokens", () => {
  const C = COMPACTION_PRESET;
  const tCtx = C.tCtxDefault;

  it("the call, reserve included, is 8 495 tokens: 303 too many", () => {
    expect(fitWindow(C, tCtx, "drop").total).toBe(8_495);
  });

  it("front: the prompt de sistema falls off and the herramientas lose their first 114 tokens", () => {
    const fit = fitWindow(C, tCtx, "front");
    expect(status(fit, "sistema")).toBe("dropped");
    expect(status(fit, "herramientas")).toBe("cut");
    expect(fit.placed.find((p) => p.segment.id === "herramientas")?.kept).toBe(705 - 114);
  });

  it("drop: only turno 1 goes, and the call is 7 318 tokens", () => {
    const fit = fitWindow(C, tCtx, "drop");
    expect(fit.placed.filter((p) => p.status === "dropped").map((p) => p.segment.id)).toEqual(["llamadas-1", "observaciones-1"]);
    expect(fit.used).toBe(7_318);
  });

  it("compact: turnos 1 to 7, 5 316 tokens, become one summary", () => {
    const fit = fitWindow(C, tCtx, "compact");
    expect(fit.summary?.replaced).toBe(5_316);
    expect(fit.used).toBe(1_044 + C.summaryTokens + 807 + 304 + 1_024);
  });

  it("at 12 288, nobody has to decide anything, and compact still fires", () => {
    expect(fitWindow(C, 12_288, "drop").placed.every((p) => p.status === "whole")).toBe(true);
    expect(fitWindow(C, 11_520, "compact").summary).toBeDefined();
    expect(fitWindow(C, 11_776, "compact").summary).toBeUndefined();
  });
});
