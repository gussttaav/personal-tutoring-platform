/*
 * COURSE-P5-01 — `bag-of-words`: two editable documents, and the matrix that Block 1
 * lesson 5 derives from them.
 *
 * One column per vocabulary entry, one row per TOKEN holding that token's one-hot
 * vector, and a summed row per document. That layout is the equation
 * x_d = Σ_t o_{w_t} read top to bottom: the student can see the 1s stack up into the
 * count. Edit either document and the columns, the rows and the sums all move.
 *
 * Two things the widget is built to make visible, both of them lesson claims:
 *   - swap two words in a document and the token rows reorder while the sum row does
 *     not change — it is a bag;
 *   - the corpus row (the bottom `tfoot`, sticky so it survives the vertical scroll)
 *     is topped by articles and prepositions, which is the observation TF-IDF corrects.
 *     It is deliberately a THIRD kind of quantity: an entry is uninformative because it
 *     is everywhere, and "everywhere" belongs to the corpus, not to one document — so it
 *     cannot be read off the per-document sums, which is why the row exists.
 *
 * All arithmetic is in ../math/bag-of-words (pure, tested). Local state only.
 * The table scrolls inside its own box: |V| columns is unbounded-ish and the page body
 * must never scroll sideways on a phone.
 */

"use client";

import { useMemo, useState } from "react";

import { buildBagOfWords, MAX_TOKENS_PER_DOC } from "../math/bag-of-words";
import { WidgetButton } from "../primitives/WidgetButton";

/*
 * Two documents on unrelated topics, each dominated by ONE article repeated four times,
 * and sharing `el`, `de` and `y` between them. That makes both readings visible at once:
 * per document the biggest coordinate is the entry that says least about it (el=4, la=4
 * against 1 for every content word), and in the corpus row the top four are el=5, la=4,
 * de=2, y=2 — every content word still at 1. Both fit the token cap with room to spare.
 */
const DEFAULTS = [
  "el portero paró el balón de penalti y el equipo ganó el partido",
  "la receta lleva la harina y la mantequilla de la abuela en el horno",
];

const LABELS = ["Documento 1", "Documento 2"];

const CELL = 26; // px — one matrix cell, wide enough for a two-digit count
const LABEL_COL = 104; // px — the sticky left column holding the token
/* The matrix scrolls inside this height instead of growing the widget: with two full
   documents it is ~44 rows, and an explorable that tall pushes the prose off the page. */
const TABLE_MAX_HEIGHT = 400; // px

function DocumentInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
      <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>{label}</span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        style={{
          width: "100%",
          padding: "0.45rem 0.6rem",
          borderRadius: "var(--radius)",
          border: "1px solid var(--border-variant)",
          background: "var(--surface-lowest)",
          color: "var(--text)",
          fontSize: "0.85rem",
        }}
      />
    </label>
  );
}

/** A matrix cell. `tone` picks the one-hot green or the sum's amber. */
function Cell({ value, tone }: { value: number; tone: "onehot" | "sum" }) {
  const lit = value > 0;
  const colour = tone === "sum" ? "var(--warning)" : "var(--green)";
  return (
    <td
      style={{
        width: CELL,
        minWidth: CELL,
        textAlign: "center",
        padding: "0.15rem 0",
        fontSize: "0.7rem",
        fontVariantNumeric: "tabular-nums",
        fontWeight: lit ? 700 : 400,
        color: lit ? colour : "var(--text-dim)",
        background: lit && tone === "onehot" ? "var(--green-dim)" : "transparent",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {value}
    </td>
  );
}

/** The sticky first column: what this row is. */
function RowLabel({ children, tone }: { children: React.ReactNode; tone: "token" | "sum" }) {
  return (
    <th
      scope="row"
      style={{
        position: "sticky",
        left: 0,
        zIndex: 1,
        width: LABEL_COL,
        minWidth: LABEL_COL,
        textAlign: "right",
        padding: "0.15rem 0.5rem",
        fontSize: "0.72rem",
        fontWeight: tone === "sum" ? 700 : 400,
        color: tone === "sum" ? "var(--warning)" : "var(--text-muted)",
        background: "var(--surface-lowest)",
        borderBottom: "1px solid var(--border)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

export default function BagOfWords() {
  const [texts, setTexts] = useState<string[]>(DEFAULTS);
  const model = useMemo(() => buildBagOfWords(texts), [texts]);
  const { vocab, documents, total } = model;

  const setText = (i: number, next: string) =>
    setTexts((prev) => prev.map((t, j) => (j === i ? next : t)));

  const truncated = documents.some((d) => d.truncated);
  const isDefault = texts.every((t, i) => t === DEFAULTS[i]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem", width: "100%" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
        {texts.map((text, i) => (
          <DocumentInput key={i} label={LABELS[i]} value={text} onChange={(v) => setText(i, v)} />
        ))}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.6rem" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-dim)" }}>
          Vocabulario del corpus: <strong style={{ color: "var(--text)" }}>{vocab.length}</strong>{" "}
          entradas, una por columna.
        </span>
        <WidgetButton onClick={() => setTexts(DEFAULTS)} disabled={isDefault}>
          Reset
        </WidgetButton>
      </div>

      <div
        style={{
          overflow: "auto",
          maxHeight: TABLE_MAX_HEIGHT,
          border: "1px solid var(--border-variant)",
          borderRadius: "var(--radius)",
        }}
      >
        {/* `separate` rather than `collapse`: a collapsed table drops the borders of
            sticky cells in every browser, and the header row here is sticky. */}
        <table
          style={{
            borderCollapse: "separate",
            borderSpacing: 0,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          <caption className="sr-only">
            Matriz de la bolsa de palabras: una fila por token, con su vector one-hot, una fila con
            la suma de cada documento y una última fila con la suma del corpus entero.
          </caption>
          <thead>
            <tr>
              {/* The corner: sticky on BOTH axes, so it has to sit above the row
                  labels (left-sticky) and the column heads (top-sticky) alike. */}
              <th
                scope="col"
                style={{
                  position: "sticky",
                  left: 0,
                  top: 0,
                  zIndex: 3,
                  width: LABEL_COL,
                  minWidth: LABEL_COL,
                  textAlign: "right",
                  padding: "0.4rem 0.5rem",
                  fontSize: "0.72rem",
                  color: "var(--text-dim)",
                  background: "var(--surface-lowest)",
                  borderBottom: "1px solid var(--border-variant)",
                  verticalAlign: "bottom",
                }}
              >
                token
              </th>
              {vocab.map((entry, i) => (
                <th
                  key={i}
                  scope="col"
                  style={{
                    position: "sticky",
                    top: 0,
                    zIndex: 2,
                    width: CELL,
                    minWidth: CELL,
                    padding: "0.3rem 0",
                    verticalAlign: "bottom",
                    background: "var(--surface-lowest)",
                    borderBottom: "1px solid var(--border-variant)",
                  }}
                >
                  <span
                    style={{
                      display: "block",
                      writingMode: "vertical-rl",
                      transform: "rotate(180deg)",
                      margin: "0 auto",
                      maxHeight: 92,
                      overflow: "hidden",
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      color: "var(--text)",
                    }}
                  >
                    {entry}
                  </span>
                  <span style={{ display: "block", fontSize: "0.6rem", color: "var(--text-dim)" }}>
                    {i}
                  </span>
                </th>
              ))}
            </tr>
          </thead>

          {documents.map((doc, d) => (
            <tbody key={d}>
              <tr>
                <th
                  scope="colgroup"
                  colSpan={vocab.length + 1}
                  style={{
                    textAlign: "left",
                    padding: "0.35rem 0",
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    color: "var(--text-dim)",
                    background: "var(--surface-low)",
                    borderTop: "1px solid var(--border-variant)",
                    borderBottom: "1px solid var(--border-variant)",
                  }}
                >
                  {/* Sticky on the span, not the cell: the row spans the full width, so
                      without this the label scrolls out of sight to the left. */}
                  <span style={{ position: "sticky", left: 0, display: "inline-block", padding: "0 0.5rem" }}>
                    {LABELS[d]}
                  </span>
                </th>
              </tr>

              {doc.rows.map((row, r) => (
                <tr key={r}>
                  <RowLabel tone="token">{doc.tokens[r]}</RowLabel>
                  {row.map((v, i) => (
                    <Cell key={i} value={v} tone="onehot" />
                  ))}
                </tr>
              ))}

              <tr>
                <RowLabel tone="sum">suma doc. {d + 1}</RowLabel>
                {doc.sum.map((v, i) => (
                  <Cell key={i} value={v} tone="sum" />
                ))}
              </tr>
            </tbody>
          ))}

          {/* The corpus row, sticky to the BOTTOM: it is the row the argument turns on,
              and the table is taller than its box, so pinning it means the reader can
              scroll through the tokens without losing sight of the total. */}
          <tfoot>
            <tr>
              <th
                scope="row"
                style={{
                  position: "sticky",
                  left: 0,
                  bottom: 0,
                  zIndex: 3,
                  width: LABEL_COL,
                  minWidth: LABEL_COL,
                  textAlign: "right",
                  padding: "0.25rem 0.5rem",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  color: "var(--text)",
                  background: "var(--surface-high)",
                  borderTop: "1px solid var(--border-variant)",
                  whiteSpace: "nowrap",
                }}
              >
                todo el corpus
              </th>
              {total.map((v, i) => (
                <td
                  key={i}
                  style={{
                    position: "sticky",
                    bottom: 0,
                    zIndex: 2,
                    width: CELL,
                    minWidth: CELL,
                    textAlign: "center",
                    padding: "0.25rem 0",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: v > 1 ? "var(--text)" : "var(--text-dim)",
                    background: "var(--surface-high)",
                    borderTop: "1px solid var(--border-variant)",
                  }}
                >
                  {v}
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>

      <p style={{ margin: 0, fontSize: "0.75rem", color: "var(--text-dim)", lineHeight: 1.5 }}>
        Cada fila verde es el one-hot de un token: un único <strong>1</strong>, en la columna de su
        entrada. La fila ámbar los suma, y esa suma es el vector del documento; la última fila suma
        los dos documentos, que es otra cosa. Cambia dos palabras de sitio: las filas se reordenan y
        las sumas no se mueven.
        {truncated ? ` Solo se muestran los primeros ${MAX_TOKENS_PER_DOC} tokens de cada documento.` : ""}
      </p>
    </div>
  );
}
