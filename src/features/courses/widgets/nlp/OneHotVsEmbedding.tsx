/*
 * COURSE-P2-02 — `onehot-vs-embedding`: the same word as a sparse one-hot vector
 * (one 1 in `vocab` dimensions) vs a short dense embedding. A vocabulary-size slider
 * drives the dimensionality counter, making Block 0's bridge argument visual: one-hot
 * grows without bound and carries no similarity; the embedding stays small and dense.
 * Static, deterministic data; local state only.
 */

"use client";

import { useState } from "react";

import { Slider } from "../primitives/Slider";

const WORDS = ["rey", "reina", "hombre", "mujer", "perro", "gato", "azul", "correr"];

// A fixed 6-dim "embedding" per word (illustrative, not trained).
const EMBED: Record<string, number[]> = {
  rey: [0.82, 0.61, -0.12, 0.44, 0.9, -0.3],
  reina: [0.79, 0.44, -0.15, 0.41, 0.88, 0.35],
  hombre: [0.55, 0.6, -0.2, 0.1, 0.2, -0.28],
  mujer: [0.52, 0.43, -0.22, 0.08, 0.18, 0.33],
  perro: [-0.4, 0.7, 0.6, -0.5, 0.1, 0.05],
  gato: [-0.38, 0.66, 0.58, -0.47, 0.12, 0.08],
  azul: [0.1, -0.8, 0.3, 0.7, -0.6, 0.2],
  correr: [-0.6, -0.1, -0.7, 0.2, 0.4, -0.5],
};

const EMBED_DIM = 6;

function Cell({ value, dense }: { value: number; dense: boolean }) {
  const lit = dense || value !== 0;
  const bg = dense
    ? `hsl(162 55% ${20 + ((value + 1) / 2) * 45}%)`
    : value === 1
      ? "var(--green)"
      : "var(--surface-lowest)";
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: 40,
        height: 28,
        borderRadius: "0.35rem",
        border: "1px solid var(--border-variant)",
        background: bg,
        color: lit ? "#04140d" : "var(--text-dim)",
        fontSize: "0.72rem",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {dense ? value.toFixed(2) : value}
    </span>
  );
}

export default function OneHotVsEmbedding() {
  const [wordIndex, setWordIndex] = useState(0);
  const [vocab, setVocab] = useState(1000);

  const word = WORDS[wordIndex];
  const embedding = EMBED[word];
  // One-hot preview: show the first few dims with the active bit placed for illustration.
  const previewDims = 8;
  const onehot = Array.from({ length: previewDims }, (_, i) => (i === wordIndex ? 1 : 0));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem", width: "100%" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
        {WORDS.map((w, i) => (
          <button
            key={w}
            type="button"
            aria-pressed={i === wordIndex}
            onClick={() => setWordIndex(i)}
            style={{
              cursor: "pointer",
              padding: "0.25rem 0.6rem",
              borderRadius: "var(--radius)",
              border: "1px solid var(--border-variant)",
              background: i === wordIndex ? "var(--green-container)" : "var(--surface-lowest)",
              color: i === wordIndex ? "#04140d" : "var(--text-muted)",
              fontSize: "0.8rem",
              fontWeight: 600,
            }}
          >
            {w}
          </button>
        ))}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
          One-hot · <span style={{ color: "var(--green)" }}>{vocab.toLocaleString("es")}</span> dimensiones
        </span>
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}>
          {onehot.map((v, i) => (
            <Cell key={i} value={v} dense={false} />
          ))}
          <span style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>… 0 0 0</span>
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
          Un único 1; el resto son ceros. Todas las palabras están a la misma distancia.
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text)" }}>
          Embedding · <span style={{ color: "var(--green)" }}>{EMBED_DIM}</span> dimensiones
        </span>
        <div style={{ display: "flex", gap: "0.25rem", alignItems: "center", flexWrap: "wrap" }}>
          {embedding.map((v, i) => (
            <Cell key={i} value={v} dense />
          ))}
        </div>
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
          Denso y compacto; palabras parecidas quedan cerca.
        </span>
      </div>

      <Slider
        label="Tamaño del vocabulario"
        value={vocab}
        min={100}
        max={50000}
        step={100}
        onChange={setVocab}
        format={(v) => `${v.toLocaleString("es")} → ${(v / EMBED_DIM).toFixed(0)}× más grande`}
      />
    </div>
  );
}
