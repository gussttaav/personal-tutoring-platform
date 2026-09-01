/*
 * COURSE-P5-05 — `multi-head-view`: the same Spanish sentence seen by several attention
 * heads at once (Block 5 lesson 4). One map per head, plus the SINGLE-head map of lesson
 * 2 for the comparison the lesson is built on.
 *
 * WHERE THE HEADS COME FROM, and why this is not a new pile of hand-set numbers. Lesson
 * 2's widget already builds its one head out of four rank-1 rules (`RULES` in
 * math/self-attention), so its score is
 *
 *     e_ij = (1/√4) · Σ_r (x_i·u_r)(x_j·w_r)
 *
 * — the four rules ADDED INSIDE ONE SOFTMAX. This module takes the same four rules and
 * gives each one its own head: W^Q_r is the single column u_r, W^K_r the single column
 * w_r, so d_k = 1 per head and the head's score is one rule and nothing else. The two
 * therefore hold exactly the same numbers and differ only in WHERE the softmax goes,
 * which is the lesson's whole claim — and it is checked as an identity in the tests:
 *
 *     e_ij(una cabeza) = (1/2) · Σ_r e_ij(cabeza r).
 *
 * Two consequences the component says out loud rather than hiding:
 *
 *   - d_k = 1 here because one rule per head is what makes a head readable, NOT because
 *     a real layer uses it. A real one splits d_model between its heads (the lesson
 *     derives d_k = d_model/h); this widget's job is to show that the maps differ.
 *   - A head with nothing to say about a position scores that whole row 0, and the row
 *     comes out EXACTLY uniform. That is not a bug to smooth over: «esta cabeza no opina
 *     sobre esta posición» is a real state, and `isFlatRow` names it. Ties are the same
 *     kind of fact — the verb→noun head cannot tell «llaves» from «coche», so it splits
 *     its weight between them, and `rowPeak` reports the tie instead of picking one.
 *
 * The vectors, the rules and their weights are all lesson 2's, and they are mine, set by
 * hand for the course. Pure and DOM-free like every other widget's numbers.
 */

import { scaledDotProductAttention } from "./attention";
import { matmul, type Matrix } from "./linalg";
import {
  D_MODEL,
  PRESETS,
  RULES,
  embedTokens,
  selfAttentionMap,
  tokeniseSentence,
  type TokenisedSentence,
} from "./self-attention";

/** One head per rule. */
export const H = RULES.length;

/** One column of W^Q and one of W^K per head — see the header. */
export const D_K_HEAD = 1;

/** Button-sized names; `RULES[r].name` is the full sentence the panel prints. */
const SHORT = [
  "verbo → sustantivo",
  "concordancia",
  "sustantivo → det./mod.",
  "det./mod. → sustantivo",
] as const;

/**
 * Lesson 2's three sentences plus this lesson's own, which is the one its motivation
 * argues from: two verbs whose subjects sit on opposite sides of a relative clause, so
 * «duerme» has to reach «ratón» and «persiguen» has to reach «gatos». No single rule
 * separates them — the verb→noun head ties the two nouns exactly, and the agreement head
 * gives both verbs' rows nearly the same shape — which is what the panel shows.
 */
export const MH_PRESETS = [...PRESETS, "el ratón pequeño que persiguen los gatos duerme"] as const;

export interface HeadSpec {
  /** The rule, spelled out — lesson 2's own wording. */
  name: string;
  /** Two or three words, for a control on a phone. */
  short: string;
}

export const HEADS: HeadSpec[] = RULES.map((rule, r) => ({ name: rule.name, short: SHORT[r] }));

/** Head r's W^Q (side "query") or W^K (side "key"): shape (d_model × 1). */
function headProjection(side: "query" | "key", r: number): Matrix {
  return Array.from({ length: D_MODEL }, (_, f) => [RULES[r][side][f]]);
}

export interface HeadMap extends HeadSpec {
  /** The head's scores, shape (T × T). With d_k = 1 the divisor is 1. */
  scores: Matrix;
  /** Its map, shape (T × T). Every row sums to 1. */
  weights: Matrix;
}

export interface MultiHeadMap extends TokenisedSentence {
  /** X, shape (T × d_model) — row t is the vector of token t. */
  x: Matrix;
  /** One entry per head, in the order of `HEADS`. */
  heads: HeadMap[];
  /** Lesson 2's layer: the same four rules summed before a single softmax. */
  single: { scores: Matrix; weights: Matrix };
}

const EMPTY = { scores: [] as Matrix, weights: [] as Matrix };

/**
 * The h maps of one sentence, and the one-head map beside them.
 *
 * The kernel wants a V to mix, and this widget draws maps rather than outputs, so it
 * gets X and the output is dropped.
 */
export function multiHeadMaps(text: string): MultiHeadMap {
  const { tokens, known, truncated } = tokeniseSentence(text);
  const x = embedTokens(tokens);
  if (tokens.length === 0) {
    return {
      tokens,
      known,
      truncated,
      x,
      heads: HEADS.map((head) => ({ ...head, ...EMPTY })),
      single: EMPTY,
    };
  }

  const heads = HEADS.map((head, r) => {
    const q = matmul(x, headProjection("query", r));
    const k = matmul(x, headProjection("key", r));
    const { scores, weights } = scaledDotProductAttention(q, k, x);
    return { ...head, scores, weights };
  });

  const one = selfAttentionMap(text, true);
  return {
    tokens,
    known,
    truncated,
    x,
    heads,
    single: { scores: one.scores, weights: one.weights },
  };
}

/**
 * Is this row exactly the uniform 1/T? A head whose rule says nothing about the asking
 * position scores its whole row 0, and the softmax of a constant row is uniform.
 */
export function isFlatRow(row: number[], tol = 1e-9): boolean {
  if (row.length === 0) return false;
  return row.every((w) => Math.abs(w - 1 / row.length) < tol);
}

export interface Peak {
  /** The heaviest column; the first of them when several tie. */
  index: number;
  weight: number;
  /** Every column within `tol` of that weight — length > 1 means a genuine tie. */
  tied: number[];
}

/** Where a row sends its weight, ties reported rather than broken. */
export function rowPeak(row: number[], tol = 1e-9): Peak {
  const weight = Math.max(...row);
  const tied = row.flatMap((w, j) => (Math.abs(w - weight) < tol ? [j] : []));
  return { index: tied[0], weight, tied };
}
