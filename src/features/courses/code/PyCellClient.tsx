/*
 * COURSE-P2-03 — The interactive half of a runnable Python cell.
 *
 * THE LOAD GATE LIVES HERE. Pyodide is reached only through the `await import()`
 * inside `handleRun` — never on mount, never on hover, never on focus. That single
 * line is what keeps ~15 MB off a lesson the student is only reading, and
 * `scripts/check-bundle.ts` fails the build if anything drags it into a first-load
 * chunk. Do not hoist it to a top-level import for tidiness.
 *
 * The editor is a plain <textarea> with the pure helpers in `editing.ts`
 * (tab-to-indent, bracket matching, indent-aware Enter). CodeMirror/Monaco are
 * deliberately absent: ~2 MB would dwarf every widget on the page combined.
 *
 * When the cell is neither focused nor edited it shows the Shiki markup that
 * `PyCell.tsx` produced at BUILD time — a display swap, not an overlay, so nothing
 * can drift out of alignment. Known limitation: once edited, the code stays
 * unhighlighted, because re-highlighting would mean shipping Shiki to the client.
 *
 * The editor SCROLLS past `EDITOR_MAX_LINES` rather than growing (see
 * `./editor-metrics.ts` for the size and why). Two consequences are load-bearing and
 * must not be undone: the swap restores `scrollTop` across the two elements, and the
 * caret lands at the START of the code rather than the end. Without either, clicking
 * into — or running — a long cell yanks the box to its last line.
 *
 * All copy is hardcoded Spanish, matching the rest of the widget layer (P2-01/02).
 */

"use client";

import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

import { WidgetButton } from "@/features/courses/widgets/primitives/WidgetButton";
// Type-only — erased at build, so nothing under `lib/courses/pyodide/` reaches the
// lesson's first-load chunk. The runtime arrives through the `await import()` in
// `handleRun` and nowhere else.
import type { LoadStage, RunResult } from "@/lib/courses/pyodide/client";

import { CodeOutput, type CellPlot } from "./CodeOutput";
import { applyAutoClose, applyBackspacePair, applyEnter, applyTab } from "./editing";
import { EDITOR_MAX_HEIGHT, isCapped } from "./editor-metrics";
import { appendChunk, EMPTY_OUTPUT, type OutputBufferState } from "./output";

export interface PyCellClientProps {
  /** The author's original code — what Reiniciar restores. */
  code: string;
  /** Shiki markup for `code`, rendered at build time. */
  highlightedHtml: string;
  /** Pyodide packages this cell needs, e.g. ["numpy"]. */
  packages: string[];
}

type Status = "idle" | "loading" | "running";

const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace';

const STAGE_LABEL: Record<LoadStage, string> = {
  runtime: "Descargando el intérprete de Python…",
  packages: "Cargando paquetes…",
  preamble: "Preparando el entorno…",
  ready: "Ejecutando…",
};

/** Shared box metrics, so swapping <pre> ⇄ <textarea> doesn't move anything. */
const editorBox = {
  margin: 0,
  padding: "0.85rem 1rem",
  borderRadius: "var(--radius)",
  border: "1px solid var(--border)",
  background: "var(--surface-lowest)",
  fontFamily: mono,
  fontSize: "0.85rem",
  lineHeight: 1.6,
  tabSize: 4,
  overflowY: "auto",
} as const;

export function PyCellClient({ code, highlightedHtml, packages }: PyCellClientProps) {
  const [value, setValue] = useState(code);
  const [editing, setEditing] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [progress, setProgress] = useState<{ stage: LoadStage; pct: number; detail?: string } | null>(
    null,
  );
  const [output, setOutput] = useState<OutputBufferState>(EMPTY_OUTPUT);
  const [plots, setPlots] = useState<CellPlot[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [hasRun, setHasRun] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const editorId = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const highlighted = useRef<HTMLDivElement>(null);
  const scrollOffset = useRef(0);
  const pendingSelection = useRef<[number, number] | null>(null);
  const stop = useRef<(() => void) | null>(null);
  const release = useRef<(() => void) | null>(null);

  const dirty = value !== code;
  const busy = status !== "idle";
  const showHighlighted = !editing && !dirty && highlightedHtml.length > 0;
  const capped = isCapped(value);

  const rememberScroll = useCallback((event: React.UIEvent<HTMLElement>) => {
    scrollOffset.current = event.currentTarget.scrollTop;
  }, []);

  // Release this cell's claim on the shared interpreter. Only ever set if the cell
  // actually ran, so an unused cell never touches the Pyodide module graph.
  useEffect(() => () => release.current?.(), []);

  // Restore the caret after a helper-driven edit (setState resets it to the end).
  useEffect(() => {
    const selection = pendingSelection.current;
    if (selection && textarea.current) {
      textarea.current.setSelectionRange(selection[0], selection[1]);
      pendingSelection.current = null;
    }
  });

  // The highlighted <div> and the <textarea> are different elements, so the display
  // swap loses the scroll offset. In a capped box that is not cosmetic: scrolling to
  // line 100 and then clicking Ejecutar (which blurs the textarea, and so swaps back)
  // would snap the code to line 1 exactly when the student wants to keep their place.
  useLayoutEffect(() => {
    const element = showHighlighted ? highlighted.current : textarea.current;
    if (element) element.scrollTop = scrollOffset.current;
  }, [showHighlighted]);

  // Entering edit mode replaces the <pre> with the textarea — move focus with it.
  // The caret goes to the START, not the end: `setSelectionRange` scrolls the caret
  // into view, so a cell capped at 20 lines would jump to line 142 the moment the
  // student clicked near its top. `preventScroll` keeps the PAGE still for the same
  // reason, and the offset is reapplied last because the selection call moves it.
  useEffect(() => {
    if (!editing || !textarea.current) return;
    const element = textarea.current;
    element.focus({ preventScroll: true });
    element.setSelectionRange(0, 0);
    element.scrollTop = scrollOffset.current;
  }, [editing]);

  const handleRun = useCallback(async () => {
    setOutput(EMPTY_OUTPUT);
    setPlots([]);
    setError(null);
    setNotice(null);
    setStatus("loading");
    setProgress({ stage: "runtime", pct: 0 });

    // ── The load gate. Everything Pyodide is behind this line. ──
    const { getPyodideClient, retainPyodide } = await import("@/lib/courses/pyodide/spawn");
    if (!release.current) release.current = retainPyodide();

    const client = getPyodideClient();
    stop.current = () => client.reset();

    const result: RunResult = await client.run(value, packages, {
      onLoading: (stage, pct, detail) => {
        setProgress({ stage, pct, detail });
        if (stage === "ready") setStatus("running");
      },
      onOutput: (stream, text) => setOutput((prev) => appendChunk(prev, stream, text)),
      onPlot: (plot) => setPlots((prev) => prev.concat(plot)),
    });

    setStatus("idle");
    setProgress(null);
    setHasRun(true);
    stop.current = null;

    if (result.ok) return;
    switch (result.kind) {
      case "python":
        setError(result.error);
        break;
      case "timeout":
        setNotice(
          result.phase === "run"
            ? `La ejecución superó los ${Math.round(result.ms / 1000)} s y se detuvo. El intérprete ` +
              "se reinició, así que se perdió el estado de las celdas anteriores: vuelve a " +
              "ejecutarlas si tu código dependía de ellas."
            : "La descarga del intérprete tardó demasiado. Comprueba tu conexión y vuelve a intentarlo.",
        );
        break;
      case "stopped":
        setNotice(
          "Ejecución detenida. El intérprete se reinició, así que se perdió el estado de las " +
            "celdas anteriores.",
        );
        break;
      case "crashed":
        setNotice(`El intérprete se cerró inesperadamente: ${result.error}`);
        break;
    }
  }, [value, packages]);

  const handleReset = useCallback(() => {
    setValue(code);
    setEditing(false);
    setOutput(EMPTY_OUTPUT);
    setPlots([]);
    setError(null);
    setNotice(null);
  }, [code]);

  const handleKeyDown = useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const element = event.currentTarget;
    const state = {
      value: element.value,
      selectionStart: element.selectionStart,
      selectionEnd: element.selectionEnd,
    };

    const edit =
      event.key === "Tab"
        ? applyTab(state, event.shiftKey)
        : event.key === "Enter"
          ? applyEnter(state)
          : event.key === "Backspace"
            ? applyBackspacePair(state)
            : event.key.length === 1
              ? applyAutoClose(state, event.key)
              : null;

    if (!edit) return;
    event.preventDefault();
    pendingSelection.current = [edit.selectionStart, edit.selectionEnd];
    setValue(edit.value);
  }, []);

  const lineCount = value.split("\n").length;
  // `none` while expanded so the textarea's `resize: vertical` handle works again —
  // a max-height clamps the height the drag sets, which reads as a broken control.
  const maxHeight = expanded ? "none" : EDITOR_MAX_HEIGHT;

  return (
    <div style={{ margin: "1.75rem 0" }}>
      {showHighlighted ? (
        <div
          id={editorId}
          ref={highlighted}
          className="pycell-editor"
          role="button"
          tabIndex={0}
          aria-label="Editar el código de esta celda"
          onClick={() => setEditing(true)}
          onFocus={() => setEditing(true)}
          onScroll={rememberScroll}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setEditing(true);
            }
          }}
          // `white-space: pre` is not cosmetic here: Shiki's inline structure emits
          // the indentation as plain spaces, and in Python indentation is syntax.
          style={{
            ...editorBox,
            cursor: "text",
            whiteSpace: "pre",
            overflowX: "auto",
            maxWidth: "100%",
            maxHeight,
            color: "var(--text)",
          }}
          // Build-time Shiki output from PyCell.tsx — never student input.
          dangerouslySetInnerHTML={{ __html: highlightedHtml }}
        />
      ) : (
        <textarea
          id={editorId}
          ref={textarea}
          className="pycell-editor"
          value={value}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          aria-label="Código Python editable"
          rows={lineCount}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setEditing(true)}
          onBlur={() => setEditing(false)}
          onScroll={rememberScroll}
          style={{
            ...editorBox,
            display: "block",
            width: "100%",
            minHeight: "3rem",
            maxHeight,
            resize: "vertical",
            color: "var(--text)",
            whiteSpace: "pre",
            overflowWrap: "normal",
            overflowX: "auto",
          }}
        />
      )}

      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "0.5rem",
          marginTop: "0.6rem",
        }}
      >
        <WidgetButton onClick={handleRun} disabled={busy} style={{ minWidth: "5.5rem" }}>
          {busy ? "Ejecutando…" : "Ejecutar"}
        </WidgetButton>
        {busy ? <WidgetButton onClick={() => stop.current?.()}>Detener</WidgetButton> : null}
        <WidgetButton onClick={handleReset} disabled={busy || (!dirty && !hasRun)}>
          Reiniciar
        </WidgetButton>
        {/* Only when something is actually hidden — and it doubles as the affordance
            that the box is capped, which the scrollbar alone cannot be: on macOS the
            overlay bar fades out and the cell just looks like a short cell. */}
        {capped ? (
          <WidgetButton
            onClick={() => setExpanded((previous) => !previous)}
            aria-expanded={expanded}
            aria-controls={editorId}
          >
            {expanded ? "Contraer" : `Ver las ${lineCount} líneas`}
          </WidgetButton>
        ) : null}
        {packages.length > 0 ? (
          <span style={{ fontSize: "0.78rem", color: "var(--text-dim)" }}>
            {packages.join(" · ")}
          </span>
        ) : null}
      </div>

      {!hasRun && !busy ? (
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.78rem", color: "var(--text-dim)" }}>
          La primera ejecución descarga el intérprete de Python (~15 MB). Después queda en la caché
          del navegador.
        </p>
      ) : null}

      {progress ? <LoadProgress stage={progress.stage} pct={progress.pct} detail={progress.detail} /> : null}

      <CodeOutput
        output={output}
        plots={plots}
        error={error}
        notice={notice}
        running={status === "running"}
      />
    </div>
  );
}

/**
 * Named stages, not a bare spinner. Pyodide gives no byte-level progress without
 * hand-rolling the wasm fetch, but "Descargando el intérprete…" at 15% still tells
 * the student something is happening — a spinner on a 15 MB download reads as broken.
 */
function LoadProgress({ stage, pct, detail }: { stage: LoadStage; pct: number; detail?: string }) {
  return (
    <div style={{ marginTop: "0.6rem" }}>
      <div
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={STAGE_LABEL[stage]}
        style={{
          height: 4,
          borderRadius: 999,
          background: "var(--surface-low)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: "100%",
            background: "var(--green)",
            transition: "width 240ms linear",
          }}
        />
      </div>
      <p style={{ margin: "0.35rem 0 0", fontSize: "0.78rem", color: "var(--text-dim)" }}>
        {STAGE_LABEL[stage]}
        {detail ? ` ${detail}` : ""}
      </p>
    </div>
  );
}

export default PyCellClient;
