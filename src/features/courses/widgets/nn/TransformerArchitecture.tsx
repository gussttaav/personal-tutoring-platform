/*
 * COURSE-P5-05 — `transformer-architecture`: the paper's Figure 1, clickable (Block 5
 * lessons 1, 6 and 8). It does two jobs, and the block plan asks for both.
 *
 *   • IN LESSON 1 it carries the argument. The toggle marks every box that lets one
 *     position see another, and three of the fifteen light up — all three of them
 *     attention. Everything else in the drawing works on one row at a time, which is
 *     what «no hay recurrencia en ninguna parte» looks like once it is drawn.
 *   • FROM LESSON 6 ON it is the block's map and its revision tool: pick a box, read
 *     what it does and which lesson builds it.
 *
 * Picking a box NAMES its lesson; it does not link to it. Nothing else in this course
 * links from one lesson to another — the prose says «la lección 4 de este bloque,
 * sobre la atención multi-head», which survives a renumbering and reads the same while
 * the rest of the block is still a draft. See math/transformer-architecture.
 *
 * Interaction follows `rnn-unrolled` and `lstm-gates`: the whole widget is ONE tab
 * stop, the arrow keys walk the boxes in drawing order (encoder bottom-to-top, then
 * decoder), and a pointer can hit any box directly. All geometry comes from the maths
 * module — this file draws what it is given and computes nothing. Local state only.
 */

"use client";

import { useState } from "react";

import {
  REPEATED_FRAMES,
  RESIDUAL_LINKS,
  TRANSFORMER_COMPONENTS,
  VIEWBOX,
  centreX,
  centreY,
  crossAttentionPath,
  flowArrows,
  lessonReference,
  residualPath,
  type ArchComponent,
} from "../math/transformer-architecture";
import { WidgetButton } from "../primitives/WidgetButton";

const DEFAULT_ID = "atencion-encoder";
const ARROW = "url(#ta-arrow)";

export default function TransformerArchitecture() {
  const [selectedId, setSelectedId] = useState(DEFAULT_ID);
  const [marking, setMarking] = useState(false);

  const index = TRANSFORMER_COMPONENTS.findIndex((c) => c.id === selectedId);
  const selected = TRANSFORMER_COMPONENTS[index] ?? TRANSFORMER_COMPONENTS[0];

  // Computed from the id React is holding, not from the `index` of this render: two
  // keypresses inside one frame would otherwise both start from the same stale index
  // and land on the same box, so holding an arrow key would move exactly once.
  const move = (delta: number) => {
    const n = TRANSFORMER_COMPONENTS.length;
    setSelectedId((current) => {
      const at = TRANSFORMER_COMPONENTS.findIndex((c) => c.id === current);
      return TRANSFORMER_COMPONENTS[(at + delta + n) % n].id;
    });
  };

  return (
    <div
      tabIndex={0}
      role="group"
      aria-label="Arquitectura del Transformer; usa las flechas para recorrer las cajas del diagrama"
      onKeyDown={(e) => {
        if (e.key === "ArrowDown" || e.key === "ArrowLeft") {
          e.preventDefault();
          move(-1);
        } else if (e.key === "ArrowUp" || e.key === "ArrowRight") {
          e.preventDefault();
          move(1);
        }
      }}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0.8rem",
        width: "100%",
        outline: "none",
      }}
    >
      <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
        <WidgetButton
          active={marking}
          aria-pressed={marking}
          onClick={() => setMarking((m) => !m)}
        >
          Marcar lo que mezcla posiciones
        </WidgetButton>
      </div>

      <svg
        viewBox={`0 0 ${VIEWBOX.width} ${VIEWBOX.height}`}
        role="img"
        aria-label={`Diagrama del Transformer: a la izquierda el encoder, con embedding de entrada, codificacion posicional, auto-atencion multi-head, un perceptron por posiciones y dos cajas de suma y layer norm, repetido N veces; a la derecha el decoder, con auto-atencion enmascarada, atencion encoder-decoder que recibe las claves y los valores del encoder, un perceptron por posiciones, tres cajas de suma y layer norm, y una proyeccion lineal con softmax al final. De las quince cajas, solo las tres de atencion mezclan posiciones. Caja seleccionada: ${selected.label.join(" ")}.`}
        style={{ display: "block", width: "100%", height: "auto", maxWidth: 460, margin: "0 auto" }}
      >
        <defs>
          <marker
            id="ta-arrow"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="5"
            markerHeight="5"
            orient="auto-start-reverse"
          >
            <path d="M 0 1 L 7 4 L 0 7 z" fill="var(--border-variant)" />
          </marker>
        </defs>

        {/* The part of each column that repeats N times. */}
        {REPEATED_FRAMES.map((f) => (
          <g key={f.stack}>
            <rect
              x={f.x}
              y={f.y}
              width={f.w}
              height={f.h}
              rx={8}
              fill="none"
              stroke="var(--border)"
              strokeWidth={1}
              strokeDasharray="4 4"
            />
            <text
              x={f.labelX}
              y={f.labelY}
              textAnchor="end"
              fontSize={10}
              fill="var(--text-dim)"
            >
              × N
            </text>
          </g>
        ))}

        {/* Flow, residuals, and the one line that crosses between the columns. */}
        {(["encoder", "decoder"] as const).flatMap((stack) =>
          flowArrows(stack).map((a, i) => (
            <line
              key={`${stack}-${i}`}
              x1={a.x1}
              y1={a.y1}
              x2={a.x2}
              y2={a.y2}
              stroke="var(--border-variant)"
              strokeWidth={1.2}
              markerEnd={ARROW}
            />
          )),
        )}
        {RESIDUAL_LINKS.map(([from, sublayer, to]) => (
          <path
            key={`${from}-${to}`}
            d={residualPath(from, sublayer, to)}
            fill="none"
            stroke="var(--border-variant)"
            strokeWidth={1}
            strokeLinejoin="round"
            markerEnd={ARROW}
          />
        ))}
        <path
          d={crossAttentionPath()}
          fill="none"
          stroke="var(--border-variant)"
          strokeWidth={1.2}
          strokeLinejoin="round"
          markerEnd={ARROW}
        />
        {/* Over the horizontal run of the cross line, clear of both columns. */}
        <text x={121} y={157} textAnchor="middle" fontSize={10} fill="var(--text-dim)">
          K, V
        </text>

        {TRANSFORMER_COMPONENTS.map((c) => (
          <ComponentBox
            key={c.id}
            component={c}
            selected={c.id === selected.id}
            marking={marking}
            onPick={() => setSelectedId(c.id)}
          />
        ))}

        {/* What goes in at the bottom of each column. */}
        <text x={centreX(TRANSFORMER_COMPONENTS[0].box)} y={522} textAnchor="middle" fontSize={10} fill="var(--text-dim)">
          la frase de entrada
        </text>
        <text x={centreX(TRANSFORMER_COMPONENTS[6].box)} y={522} textAnchor="middle" fontSize={10} fill="var(--text-dim)">
          lo ya escrito
        </text>
      </svg>

      <div
        aria-live="polite"
        style={{
          padding: "0.75rem 0.85rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border-variant)",
          background: "var(--surface-lowest)",
        }}
      >
        <p style={{ margin: 0, fontSize: "0.9rem", fontWeight: 600, color: "var(--text)" }}>
          {selected.label.join(" ")}{" "}
          <span
            style={{
              fontWeight: 500,
              fontSize: "0.78rem",
              color: selected.mixesPositions ? "var(--green)" : "var(--text-dim)",
            }}
          >
            · {selected.mixesPositions ? "mezcla posiciones" : "una posición cada vez"}
          </span>
        </p>
        <p
          style={{
            margin: "0.4rem 0 0",
            fontSize: "0.85rem",
            color: "var(--text-dim)",
            lineHeight: 1.6,
          }}
        >
          {selected.description}
        </p>
        <p
          style={{
            margin: "0.5rem 0 0",
            fontSize: "0.8rem",
            color: "var(--text-muted)",
            lineHeight: 1.6,
          }}
        >
          Se construye en {lessonReference(selected.lesson)}.
          {selected.alsoLessons.length > 0 ? (
            <> Por dentro lleva {selected.alsoLessons.map((r) => lessonReference(r)).join(", y ")}.</>
          ) : null}
        </p>
      </div>
    </div>
  );
}

function ComponentBox({
  component,
  selected,
  marking,
  onPick,
}: {
  component: ArchComponent;
  selected: boolean;
  marking: boolean;
  onPick: () => void;
}) {
  const { box, label, mixesPositions } = component;
  // While marking, the three attention boxes take the accent and the rest step back —
  // that contrast IS lesson 1's claim, so it outranks the selection highlight.
  const lit = marking && mixesPositions;
  const dimmed = marking && !mixesPositions;

  return (
    <g
      onClick={onPick}
      onMouseEnter={onPick}
      style={{ cursor: "pointer" }}
      opacity={dimmed ? 0.45 : 1}
    >
      <rect
        x={box.x}
        y={box.y}
        width={box.w}
        height={box.h}
        rx={6}
        fill={lit ? "var(--green-container)" : "var(--surface-container)"}
        stroke={selected ? "var(--green)" : "var(--border-variant)"}
        strokeWidth={selected ? 2 : 1}
      />
      {label.map((line, i) => (
        <text
          key={line}
          x={centreX(box)}
          y={centreY(box) + (label.length === 1 ? 4 : i === 0 ? -3 : 11)}
          textAnchor="middle"
          fontSize={12}
          fill={lit ? "#04140d" : selected ? "var(--text)" : "var(--text-muted)"}
          style={{ pointerEvents: "none" }}
        >
          {line}
        </text>
      ))}
    </g>
  );
}
