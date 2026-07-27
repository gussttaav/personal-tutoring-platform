/*
 * COURSE-P2-02 — `embedding-projection`: the single most persuasive NLP demo. A 2D
 * scatter of ~200 precomputed Spanish words (fetched from a small committed JSON,
 * no model, no API). Pick a word → its nearest neighbours light up; toggle the
 * analogy to see rey − hombre + mujer land on reina. Pure geometry in math/embeddings.
 * Local state only; the fetch state stays inside the widget (droppable anywhere).
 */

"use client";

import { useEffect, useMemo, useState } from "react";
import { scaleLinear } from "d3-scale";

import { analogy, nearestNeighbours, findWord, type EmbeddingPoint } from "../math/embeddings";
import { WidgetButton } from "../primitives/WidgetButton";

const SRC = "/courses/dl-nlp/embeddings-sample.json";
const W = 520;
const H = 340;
const M = 16;

type Status = "loading" | "ready" | "error";

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
  const [selected, setSelected] = useState("rey");
  const [showAnalogy, setShowAnalogy] = useState(false);

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
    () => (showAnalogy && status === "ready" ? analogy("rey", "hombre", "mujer", data, 1) : null),
    [showAnalogy, data, status],
  );

  if (status === "loading") {
    return <p style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>Cargando embeddings…</p>;
  }
  if (status === "error" || !scales) {
    return <p style={{ color: "var(--error)", fontSize: "0.9rem" }}>No se pudieron cargar los embeddings.</p>;
  }

  const { sx, sy } = scales;
  const sel = findWord(selected, data);
  const neighbourWords = new Set(neighbours.map((n) => n.word));
  const analogyWords = new Set<string>(
    analogyResult
      ? ["rey", "hombre", "mujer", analogyResult.results[0]?.word].filter((w): w is string => Boolean(w))
      : [],
  );
  const labelled = new Set<string>([selected, ...neighbourWords, ...analogyWords]);

  const sorted = [...data].map((p) => p.word).sort((a, b) => a.localeCompare(b, "es"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
        <label style={{ fontSize: "0.85rem", color: "var(--text-muted)", display: "flex", gap: "0.4rem", alignItems: "center" }}>
          Palabra
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
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
        <WidgetButton active={showAnalogy} onClick={() => setShowAnalogy((v) => !v)}>
          Analogía rey − hombre + mujer
        </WidgetButton>
      </div>

      <svg
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        role="img"
        aria-label={`Proyección 2D de palabras; seleccionada: ${selected}`}
        style={{ display: "block", maxWidth: "100%", background: "var(--surface-lowest)", borderRadius: "var(--radius)" }}
      >
        {/* Neighbour links */}
        {sel &&
          neighbours.map((n) => (
            <line
              key={`l${n.word}`}
              x1={sx(sel.x)}
              y1={sy(sel.y)}
              x2={sx(n.x)}
              y2={sy(n.y)}
              stroke="var(--green)"
              strokeWidth={1}
              opacity={0.5}
            />
          ))}

        {/* Analogy vector: mujer → target ≈ reina, with hombre → rey for reference */}
        {analogyResult &&
          (() => {
            const rey = findWord("rey", data)!;
            const hombre = findWord("hombre", data)!;
            const mujer = findWord("mujer", data)!;
            const [tx, ty] = analogyResult.target;
            return (
              <g>
                <line x1={sx(hombre.x)} y1={sy(hombre.y)} x2={sx(rey.x)} y2={sy(rey.y)} stroke="var(--text-dim)" strokeWidth={1.5} strokeDasharray="3 3" />
                <line x1={sx(mujer.x)} y1={sy(mujer.y)} x2={sx(tx)} y2={sy(ty)} stroke="var(--green)" strokeWidth={2} />
                <circle cx={sx(tx)} cy={sy(ty)} r={7} fill="none" stroke="var(--green)" strokeWidth={2} />
              </g>
            );
          })()}

        {/* Points */}
        {data.map((p) => {
          const isSel = p.word === selected;
          const isN = neighbourWords.has(p.word);
          const isA = analogyWords.has(p.word);
          const r = isSel ? 6 : isN || isA ? 4.5 : 3;
          const fill = isSel ? "var(--green)" : categoryColor(p.category);
          return (
            <g key={p.word}>
              <circle
                cx={sx(p.x)}
                cy={sy(p.y)}
                r={r}
                fill={fill}
                opacity={labelled.size > 0 && !isSel && !isN && !isA ? 0.55 : 1}
                stroke={isSel ? "var(--text)" : "none"}
                strokeWidth={1}
                style={{ cursor: "pointer" }}
                onClick={() => setSelected(p.word)}
              />
              {labelled.has(p.word) && (
                <text x={sx(p.x) + r + 2} y={sy(p.y)} dy="0.32em" fontSize={11} fill="var(--text)">
                  {p.word}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <p style={{ fontSize: "0.8rem", color: "var(--text-dim)", margin: 0 }}>
        {showAnalogy && analogyResult
          ? `rey − hombre + mujer ≈ ${analogyResult.results[0]?.word}`
          : `Vecinos de "${selected}": ${neighbours.map((n) => n.word).join(", ")}`}
      </p>
    </div>
  );
}
