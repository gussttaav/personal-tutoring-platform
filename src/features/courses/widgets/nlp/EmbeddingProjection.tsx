/*
 * COURSE-P2-02 — `embedding-projection`: the single most persuasive NLP demo. A 2D
 * scatter of ~200 precomputed Spanish words (fetched from a small committed JSON,
 * no model, no API). Pick a word → its nearest neighbours light up; toggle the
 * analogy to see rey − hombre + mujer land on reina. Pure geometry in math/embeddings.
 * Local state only; the fetch state stays inside the widget (droppable anywhere).
 *
 * COURSE-P5-01 — two legibility fixes, both found by reading Block 1 lesson 6 on a real
 * screen. The widget was drawing information it made unreadable:
 *
 *   - Labels sat at `point.x + r`, and the labelled points are BY CONSTRUCTION the
 *     closest ones to each other — selecting `abuela` stacked six names inside a cluster
 *     a few pixels wide. They now go through ../math/label-layout, which spreads them
 *     down their column and leaves a leader line back to any point whose label moved.
 *   - The analogy used to draw ON TOP of the current selection, so two unrelated stories
 *     (these are the neighbours of X / this displacement repeats over there) shared one
 *     picture. They are now exclusive MODES, and the analogy draws the full parallelogram
 *     — the two equal arrows plus the sides that close it — instead of two bare segments.
 *
 * The plot text is deliberately large (12px) with a halo in the plot's own background
 * colour: below that, labels over a dot are unreadable on a phone, and this widget is
 * the first thing a Block 1 student is asked to look at.
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";

import { analogy, nearestNeighbours, findWord, type EmbeddingPoint } from "../math/embeddings";
import { estimateTextWidth, layoutLabels, type LabelAnchor } from "../math/label-layout";
import { WidgetButton } from "../primitives/WidgetButton";

const SRC = "/courses/dl-nlp/embeddings-sample.json";
const W = 520;
const H = 340;
const M = 16;
const FONT = 12;
/** The analogy the dataset is built to satisfy (see math/__tests__/embeddings-data.test.ts). */
const ANALOGY = { a: "rey", b: "hombre", c: "mujer" } as const;
/* The four analogy words span ~58×27px of a 520×340 plot, so at full extent the
   parallelogram is a smudge in the middle of the cloud — which is exactly the figure the
   student is being asked to read. Analogy mode therefore zooms into it, keeping the rest
   of the cloud drawn (dimmed) around it so the zoom is visibly a zoom and not a new plot.
   The margin is generous because the labels live in it. */
const ZOOM_PAD = 120;
const MAX_ZOOM = 3;

/** Pixel-space zoom that fits `points` into the plot, as a scale + translation. Applied
 *  by hand rather than as an SVG transform so dot radii, strokes and text stay put. */
function fitZoom(points: readonly (readonly [number, number])[]): { k: number; tx: number; ty: number } {
  const identity = { k: 1, tx: 0, ty: 0 };
  if (points.length === 0) return identity;

  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const k = Math.min(
    (W - 2 * ZOOM_PAD) / Math.max(maxX - minX, 1),
    (H - 2 * ZOOM_PAD) / Math.max(maxY - minY, 1),
    MAX_ZOOM,
  );
  if (!Number.isFinite(k) || k <= 1) return identity;

  return { k, tx: W / 2 - (k * (minX + maxX)) / 2, ty: H / 2 - (k * (minY + maxY)) / 2 };
}

type Status = "loading" | "ready" | "error";
/** Neighbours and the analogy answer two different questions; drawn together they
 *  produce one picture that answers neither, so the widget shows one at a time. */
type Mode = "vecinos" | "analogia";

// Deterministic hue per category so clusters read as colour groups.
function categoryColor(cat: string | undefined): string {
  if (!cat) return "var(--text-dim)";
  let h = 0;
  for (let i = 0; i < cat.length; i++) h = (h * 31 + cat.charCodeAt(i)) % 360;
  return `hsl(${h} 58% 60%)`;
}

export default function EmbeddingProjection() {
  const [data, setData] = useState<EmbeddingPoint[]>([]);
  const [status, setStatus] = useState<Status>("loading");
  const [selected, setSelected] = useState("abuelo");
  const [mode, setMode] = useState<Mode>("vecinos");

  useEffect(() => {
    const ctrl = new AbortController();
    fetch(SRC, { signal: ctrl.signal })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((json: { words: EmbeddingPoint[] }) => {
        setData(json.words);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === "AbortError")) setStatus("error");
      });
    return () => ctrl.abort();
  }, []);

  const scales = useMemo(() => {
    if (data.length === 0) return null;
    const xs = data.map((p) => p.x);
    const ys = data.map((p) => p.y);
    const padX = (Math.max(...xs) - Math.min(...xs)) * 0.06;
    const padY = (Math.max(...ys) - Math.min(...ys)) * 0.06;
    const sx = scaleLinear().domain([Math.min(...xs) - padX, Math.max(...xs) + padX]).range([M, W - M]);
    const sy = scaleLinear().domain([Math.min(...ys) - padY, Math.max(...ys) + padY]).range([H - M, M]);
    return { sx, sy };
  }, [data]);

  const neighbours = useMemo(
    () => (status === "ready" ? nearestNeighbours(selected, data, 5) : []),
    [selected, data, status],
  );
  const analogyResult = useMemo(
    () => (status === "ready" ? analogy(ANALOGY.a, ANALOGY.b, ANALOGY.c, data, 1) : null),
    [data, status],
  );

  if (status === "loading") {
    return <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>Cargando embeddings…</p>;
  }
  if (status === "error" || !scales) {
    return <p style={{ color: "var(--error)", fontSize: "0.9rem" }}>No se pudieron cargar los embeddings.</p>;
  }

  const { sx, sy } = scales;
  const showAnalogy = mode === "analogia" && analogyResult !== null;
  const answer = analogyResult?.results[0]?.word;

  // Picking a word always returns to the neighbour story: the two modes never share a
  // frame, so a click on the plot cannot leave a half-analogy on screen.
  const pick = (word: string) => {
    setSelected(word);
    setMode("vecinos");
  };

  const sel = findWord(selected, data);
  const neighbourWords = new Set(neighbours.map((n) => n.word));
  const analogyWords = showAnalogy
    ? new Set<string>([ANALOGY.a, ANALOGY.b, ANALOGY.c, ...(answer ? [answer] : [])])
    : new Set<string>();
  const highlighted = showAnalogy
    ? analogyWords
    : new Set<string>([selected, ...neighbourWords]);

  /* Every drawn coordinate goes through these two, so the zoom applies to the points,
     the arrows and the labels at once — and is the identity outside analogy mode. */
  const zoom = showAnalogy && analogyResult
    ? fitZoom(
        [
          ...[ANALOGY.a, ANALOGY.b, ANALOGY.c]
            .map((w) => findWord(w, data))
            .filter((p): p is EmbeddingPoint => Boolean(p))
            .map((p) => [sx(p.x), sy(p.y)] as const),
          [sx(analogyResult.target[0]), sy(analogyResult.target[1])] as const,
        ],
      )
    : { k: 1, tx: 0, ty: 0 };
  const px = (x: number) => zoom.k * sx(x) + zoom.tx;
  const py = (y: number) => zoom.k * sy(y) + zoom.ty;

  // Labels for the highlighted points only, spread so a cluster stays readable.
  const anchors: LabelAnchor[] = data
    .filter((p) => highlighted.has(p.word))
    .map((p) => ({
      key: p.word,
      x: px(p.x),
      y: py(p.y),
      width: estimateTextWidth(p.word, FONT),
    }));
  const labels = layoutLabels(anchors, {
    width: W,
    height: H,
    lineHeight: FONT + 2,
    // Analogy mode needs the extra px to clear the ring drawn around the answer.
    offset: showAnalogy ? 16 : 9,
  });

  const sorted = [...data].map((p) => p.word).sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", gap: "0.4rem", alignItems: "center" }}>
          Palabra
          <select
            value={selected}
            onChange={(e) => pick(e.target.value)}
            style={{
              padding: "0.25rem 0.4rem",
              borderRadius: "0.4rem",
              border: "1px solid var(--border-variant)",
              background: "var(--surface-lowest)",
              color: "var(--text)",
              fontSize: "0.85rem",
            }}
          >
            {sorted.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </select>
        </label>
        <WidgetButton
          active={showAnalogy}
          onClick={() => setMode((m) => (m === "analogia" ? "vecinos" : "analogia"))}
        >
          Analogía rey − hombre + mujer
        </WidgetButton>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={
          showAnalogy
            ? `Proyección 2D de palabras mostrando la analogía rey menos hombre más mujer, que cae sobre ${answer ?? "ninguna palabra"}`
            : `Proyección 2D de palabras; seleccionada: ${selected}, con sus vecinos ${neighbours.map((n) => n.word).join(", ")}`
        }
        style={{ display: "block", maxWidth: "100%", background: "var(--surface-lowest)", borderRadius: "var(--radius)" }}
      >
        <defs>
          <marker id="ep-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--green)" />
          </marker>
        </defs>

        {/* Neighbour links */}
        {!showAnalogy &&
          sel &&
          neighbours.map((n) => (
            <line
              key={`l${n.word}`}
              x1={px(sel.x)}
              y1={py(sel.y)}
              x2={px(n.x)}
              y2={py(n.y)}
              stroke="var(--green)"
              strokeWidth={1}
              opacity={0.5}
            />
          ))}

        {/* The analogy as a parallelogram: two EQUAL arrows (hombre→rey and mujer→the
            answer) plus the dashed sides that close it. The claim is that the same
            displacement works in both places, and two bare segments never showed that. */}
        {showAnalogy &&
          analogyResult &&
          (() => {
            const a = findWord(ANALOGY.a, data);
            const b = findWord(ANALOGY.b, data);
            const c = findWord(ANALOGY.c, data);
            if (!a || !b || !c) return null;
            const [tx, ty] = analogyResult.target;
            return (
              <g>
                {/* Sides of the parallelogram — faint: they only close the figure. */}
                <line x1={px(b.x)} y1={py(b.y)} x2={px(c.x)} y2={py(c.y)} stroke="var(--text-dim)" strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
                <line x1={px(a.x)} y1={py(a.y)} x2={px(tx)} y2={py(ty)} stroke="var(--text-dim)" strokeWidth={1} strokeDasharray="4 4" opacity={0.7} />
                {/* The two vectors that are the point of the demo. */}
                <line x1={px(b.x)} y1={py(b.y)} x2={px(a.x)} y2={py(a.y)} stroke="var(--green)" strokeWidth={2.5} markerEnd="url(#ep-arrow)" />
                <line x1={px(c.x)} y1={py(c.y)} x2={px(tx)} y2={py(ty)} stroke="var(--green)" strokeWidth={2.5} markerEnd="url(#ep-arrow)" />
                {/* Where the sum lands, before asking which word is there. */}
                <circle cx={px(tx)} cy={py(ty)} r={11} fill="none" stroke="var(--green)" strokeWidth={2} />
              </g>
            );
          })()}

        {/* Points */}
        {data.map((p) => {
          const isSel = !showAnalogy && p.word === selected;
          const isHot = highlighted.has(p.word);
          const r = isSel ? 6 : isHot ? 4.5 : 3;
          return (
            <circle
              key={p.word}
              cx={px(p.x)}
              cy={py(p.y)}
              r={r}
              fill={isSel ? "var(--green)" : categoryColor(p.category)}
              opacity={isHot ? 1 : 0.3}
              stroke={isSel ? "var(--text)" : "none"}
              strokeWidth={1}
              style={{ cursor: "pointer" }}
              onClick={() => pick(p.word)}
            />
          );
        })}

        {/* Labels last, so nothing is drawn over them. */}
        {labels.map((label) => (
          <g key={`t${label.key}`}>
            {label.displaced && (
              <line
                x1={label.pointX}
                y1={label.pointY}
                x2={label.x - (label.anchor === "start" ? 3 : -3)}
                y2={label.y}
                stroke="var(--text-dim)"
                strokeWidth={0.75}
                opacity={0.8}
              />
            )}
            <text
              x={label.x}
              y={label.y}
              dy="0.32em"
              textAnchor={label.anchor}
              fontSize={FONT}
              fontWeight={label.key === selected || label.key === answer ? 600 : 400}
              fill={label.key === selected || label.key === answer ? "var(--green)" : "var(--text)"}
              stroke="var(--surface-lowest)"
              strokeWidth={3}
              paintOrder="stroke"
              style={{ pointerEvents: "none" }}
            >
              {label.key}
            </text>
          </g>
        ))}
      </svg>

      <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0, lineHeight: 1.5 }}>
        {showAnalogy ? (
          <>
            Las dos flechas son el mismo vector: <strong style={{ color: "var(--text-muted)", fontWeight: 600 }}>rey − hombre</strong>, aplicado
            sobre <em>mujer</em>, cae sobre <strong style={{ color: "var(--green)", fontWeight: 600 }}>{answer}</strong>. El círculo marca dónde
            cae la suma; la palabra más cercana es la respuesta. Vista ampliada sobre esas cuatro palabras.
          </>
        ) : (
          <>
            Vecinos de <strong style={{ color: "var(--text-muted)", fontWeight: 600 }}>{selected}</strong>:{" "}
            {neighbours.map((n) => n.word).join(", ")}
          </>
        )}
      </p>
    </div>
  );
}
