/*
 * COURSE-P5-04 — The counting bound on a fixed-size context vector (Block 4 lesson 2).
 *
 * A seq2seq encoder hands the decoder one vector c ∈ R^{d_h}. Assume each coordinate
 * is only reliable to q distinguishable levels — the modelling assumption the lesson
 * states out loud, and the one knob whose value does not change the conclusion. Then
 * the encoder has at most q^{d_h} distinct codes to spend, while a source of length
 * T_x over a vocabulary V_x has |V_x|^{T_x} possibilities. Any decoder is a FUNCTION
 * from codes to sequences, so it can return at most q^{d_h} sequences correctly:
 *
 *   fraction reconstructed exactly ≤ min(1, q^{d_h} / |V_x|^{T_x})
 *
 * which is a bound on every decoder that exists, fitted or not. That last clause is
 * the teaching claim: the wall is a property of the code size, not of the training.
 *
 * Everything here is computed in ORDERS OF MAGNITUDE (log₁₀ of a count), never as the
 * counts themselves: q^{d_h} overflows a double at d_h = 256, and the two quantities
 * the widget compares are straight lines on that scale — a flat capacity against a
 * demand growing one |V_x| per token, crossing exactly once.
 */

/** log₁₀ of how many distinct codes fit in d_h coordinates of q levels each. */
export function codeOrders(stateWidth: number, levels: number): number {
  assertWidth(stateWidth);
  assertLevels(levels);
  return stateWidth * Math.log10(levels);
}

/** log₁₀ of how many source sequences of `length` tokens exist over `vocabSize`. */
export function sequenceOrders(length: number, vocabSize: number): number {
  assertLength(length);
  assertVocab(vocabSize);
  return length * Math.log10(vocabSize);
}

/**
 * The longest source the counting argument does NOT yet rule out — the largest T with
 * |V_x|^T ≤ q^{d_h}, i.e. ⌊d_h · log q / log |V_x|⌋. Linear in d_h: doubling the state
 * doubles the length, which is the trade the lesson calls a bad one.
 */
export function maxExactLength(
  stateWidth: number,
  levels: number,
  vocabSize: number,
): number {
  assertVocab(vocabSize);
  const ratio = codeOrders(stateWidth, levels) / Math.log10(vocabSize);
  // The +1e-9 recovers the exact integer when the ratio is one in exact arithmetic
  // (q = 8, |V_x| = 4096 is exactly d_h/4) and floating point lands a hair below it.
  return Math.floor(ratio + 1e-9);
}

/**
 * log₁₀ of the ceiling on the fraction of sources of length T_x that ANY decoder can
 * reconstruct exactly. Zero (a ceiling of 1, i.e. no constraint) up to `maxExactLength`,
 * then falling by log₁₀|V_x| per extra token.
 */
export function log10Ceiling(
  length: number,
  stateWidth: number,
  levels: number,
  vocabSize: number,
): number {
  const slack = codeOrders(stateWidth, levels) - sequenceOrders(length, vocabSize);
  return Math.min(0, slack);
}

export interface BottleneckCurves {
  /** Flat line: log₁₀ of the code count, one point per length in 0..maxLength. */
  capacity: [number, number][];
  /** Rising line: log₁₀ of the sequence count, same lengths. */
  demand: [number, number][];
  /** Where the two cross — `maxExactLength`. */
  crossing: number;
  /** Shared y range, padded, always including 0. */
  yDomain: [number, number];
}

/**
 * The two lines the widget draws, plus their crossing. Both are exact straight lines;
 * they are returned sampled so the plot primitive can draw them like any other series.
 */
export function bottleneckCurves(
  stateWidth: number,
  levels: number,
  vocabSize: number,
  maxLength: number,
): BottleneckCurves {
  assertLength(maxLength);
  const codes = codeOrders(stateWidth, levels);
  const capacity: [number, number][] = [
    [0, codes],
    [maxLength, codes],
  ];
  const demand: [number, number][] = [
    [0, 0],
    [maxLength, sequenceOrders(maxLength, vocabSize)],
  ];
  const top = Math.max(codes, sequenceOrders(maxLength, vocabSize));
  return {
    capacity,
    demand,
    crossing: maxExactLength(stateWidth, levels, vocabSize),
    yDomain: [0, Math.ceil(top / 50) * 50],
  };
}

function assertWidth(stateWidth: number): void {
  if (!Number.isInteger(stateWidth) || stateWidth < 1) {
    throw new Error(`context-bottleneck: d_h must be a positive integer, got ${stateWidth}`);
  }
}

function assertLevels(levels: number): void {
  if (!(levels >= 2)) {
    throw new Error(`context-bottleneck: q must be at least 2 levels, got ${levels}`);
  }
}

function assertVocab(vocabSize: number): void {
  if (!(vocabSize >= 2)) {
    throw new Error(`context-bottleneck: |V_x| must be at least 2, got ${vocabSize}`);
  }
}

function assertLength(length: number): void {
  if (!Number.isInteger(length) || length < 0) {
    throw new Error(`context-bottleneck: T_x must be a non-negative integer, got ${length}`);
  }
}
