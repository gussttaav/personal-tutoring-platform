/*
 * COURSE-P2-03 — Pure text transforms for the code cell's <textarea>.
 *
 * The cell deliberately uses a plain textarea, not CodeMirror or Monaco: Monaco is
 * ~2 MB and would dwarf every widget on the lesson combined. These four helpers are
 * what make a textarea tolerable for Python — where indentation is syntax — without
 * that cost.
 *
 * They are pure `(value, selection) -> edit | null` functions with no DOM anywhere,
 * following the `widgets/math/*` precedent, so the fiddly cases (dedent at column 0,
 * indenting a multi-line selection, skipping over a closing bracket) are unit-tested
 * rather than eyeballed. `null` means "not handled — let the browser do its thing".
 */

/** Python convention, and what the rest of the course's code samples use. */
export const INDENT = "    ";

export interface EditState {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/** Pairs that auto-close. Quotes are in here too — they behave the same way. */
const PAIRS: Record<string, string> = {
  "(": ")",
  "[": "]",
  "{": "}",
  '"': '"',
  "'": "'",
};

const CLOSERS = new Set(Object.values(PAIRS));

/* ── Tab / Shift+Tab ───────────────────────────────────────────────────── */

/**
 * Tab indents, Shift+Tab dedents. With a selection spanning lines, every touched
 * line moves — the single most missed keystroke when a student is fixing a loop body.
 */
export function applyTab(state: EditState, shift: boolean): EditState | null {
  const { value, selectionStart, selectionEnd } = state;
  const multiline = value.slice(selectionStart, selectionEnd).includes("\n");

  if (!multiline && !shift) {
    // Plain insert at the caret (replacing any single-line selection).
    return {
      value: value.slice(0, selectionStart) + INDENT + value.slice(selectionEnd),
      selectionStart: selectionStart + INDENT.length,
      selectionEnd: selectionStart + INDENT.length,
    };
  }

  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEndIndex = value.indexOf("\n", selectionEnd);
  const lineEnd = lineEndIndex === -1 ? value.length : lineEndIndex;

  const block = value.slice(lineStart, lineEnd);
  const lines = block.split("\n");

  let firstDelta = 0;
  let totalDelta = 0;

  const shifted = lines.map((line, index) => {
    if (shift) {
      const removable = leadingSpaces(line, INDENT.length);
      if (index === 0) firstDelta = -removable;
      totalDelta -= removable;
      return line.slice(removable);
    }
    // Never indent a blank line into trailing whitespace.
    if (line.length === 0) return line;
    if (index === 0) firstDelta = INDENT.length;
    totalDelta += INDENT.length;
    return INDENT + line;
  });

  const next = shifted.join("\n");
  if (next === block) return null;

  return {
    value: value.slice(0, lineStart) + next + value.slice(lineEnd),
    selectionStart: Math.max(lineStart, selectionStart + firstDelta),
    selectionEnd: Math.max(lineStart, selectionEnd + totalDelta),
  };
}

function leadingSpaces(line: string, max: number): number {
  let count = 0;
  while (count < max && line[count] === " ") count += 1;
  return count;
}

/* ── Enter ─────────────────────────────────────────────────────────────── */

/**
 * Keep the current line's indentation on the new line, and add one level after a
 * line ending in `:` — `for i in range(10):` then Enter should land inside the body.
 */
export function applyEnter(state: EditState): EditState | null {
  const { value, selectionStart, selectionEnd } = state;
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const line = value.slice(lineStart, selectionStart);
  const indent = line.slice(0, leadingSpaces(line, line.length));
  const extra = /:\s*$/.test(line) ? INDENT : "";
  const insert = `\n${indent}${extra}`;

  if (insert === "\n") return null; // no indentation to carry — let the browser handle it

  const caret = selectionStart + insert.length;
  return {
    value: value.slice(0, selectionStart) + insert + value.slice(selectionEnd),
    selectionStart: caret,
    selectionEnd: caret,
  };
}

/* ── Bracket matching ──────────────────────────────────────────────────── */

/**
 * Auto-close a bracket or quote; wrap the selection when there is one; and type
 * *through* a closer the editor just inserted rather than doubling it.
 */
export function applyAutoClose(state: EditState, key: string): EditState | null {
  const { value, selectionStart, selectionEnd } = state;

  // Typing the closer that is already sitting under the caret just moves past it.
  if (CLOSERS.has(key) && selectionStart === selectionEnd && value[selectionStart] === key) {
    return { value, selectionStart: selectionStart + 1, selectionEnd: selectionStart + 1 };
  }

  const close = PAIRS[key];
  if (!close) return null;

  if (selectionStart !== selectionEnd) {
    const selected = value.slice(selectionStart, selectionEnd);
    return {
      value: value.slice(0, selectionStart) + key + selected + close + value.slice(selectionEnd),
      selectionStart: selectionStart + 1,
      selectionEnd: selectionEnd + 1,
    };
  }

  // Don't auto-close a quote in the middle of a word ( don't, it's, … ).
  if (key === close && /[\w]/.test(value[selectionStart - 1] ?? "")) return null;

  return {
    value: value.slice(0, selectionStart) + key + close + value.slice(selectionEnd),
    selectionStart: selectionStart + 1,
    selectionEnd: selectionStart + 1,
  };
}

/** Backspace between a freshly-inserted pair deletes both halves. */
export function applyBackspacePair(state: EditState): EditState | null {
  const { value, selectionStart, selectionEnd } = state;
  if (selectionStart !== selectionEnd || selectionStart === 0) return null;

  const before = value[selectionStart - 1];
  const after = value[selectionStart];
  if (!before || PAIRS[before] !== after) return null;

  return {
    value: value.slice(0, selectionStart - 1) + value.slice(selectionStart + 1),
    selectionStart: selectionStart - 1,
    selectionEnd: selectionStart - 1,
  };
}
