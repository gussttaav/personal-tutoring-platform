/*
 * COURSE-P2-02 — Pure perceptron maths for `perceptron-boundary`.
 *
 * A single linear neuron in 2D: classify(x) = sign(w·x + b). The widget lets a
 * reader drag points and watch the boundary; the pedagogical payload is the XOR
 * preset, which is provably NOT linearly separable — the perceptron never reaches
 * zero errors, which is exactly why hidden layers exist. All DOM-free and tested.
 *
 * Labels are ±1. Convergence is used as the separability signal: the perceptron
 * convergence theorem guarantees it reaches zero errors iff the data is linearly
 * separable, so a run that exhausts its epoch budget means "not separable".
 */

export type Point2 = [number, number];

export interface LabeledPoint {
  point: Point2;
  label: 1 | -1;
}

export interface TrainOptions {
  lr?: number;
  maxEpochs?: number;
  initW?: Point2;
  initB?: number;
}

export interface TrainResult {
  w: Point2;
  b: number;
  converged: boolean;
  epochs: number;
}

/** sign(w·x + b), with the boundary (0) counted as the positive class. */
export function classify(point: Point2, w: Point2, b: number): 1 | -1 {
  return w[0] * point[0] + w[1] * point[1] + b >= 0 ? 1 : -1;
}

/**
 * The decision boundary w·x + b = 0 as two endpoints spanning the given view box.
 *
 * Solving for the more-stable axis (whichever weight is larger in magnitude) keeps
 * near-vertical and near-horizontal lines well-conditioned; returns `null` only
 * when both weights are ~0 (no boundary). Endpoints may fall outside the box — the
 * caller's SVG clips them.
 */
export function decisionBoundaryLine(
  w: Point2,
  b: number,
  xDomain: [number, number],
  yDomain: [number, number],
): [Point2, Point2] | null {
  const [w1, w2] = w;
  if (Math.abs(w1) < 1e-9 && Math.abs(w2) < 1e-9) return null;

  const z = (n: number) => (n === 0 ? 0 : n); // normalise -0 → 0 for clean output

  if (Math.abs(w2) >= Math.abs(w1)) {
    const yAt = (x: number) => z(-(w1 * x + b) / w2);
    return [
      [xDomain[0], yAt(xDomain[0])],
      [xDomain[1], yAt(xDomain[1])],
    ];
  }
  const xAt = (y: number) => z(-(w2 * y + b) / w1);
  return [
    [xAt(yDomain[0]), yDomain[0]],
    [xAt(yDomain[1]), yDomain[1]],
  ];
}

/**
 * One pass of the perceptron rule over the data: for each misclassified point,
 * w ← w + lr·y·x and b ← b + lr·y. Returns the updated params and how many points
 * were misclassified during the pass (0 ⇒ the current boundary separates the set).
 */
export function perceptronEpoch(
  data: readonly LabeledPoint[],
  w: Point2,
  b: number,
  lr: number,
): { w: Point2; b: number; errors: number } {
  let nw: Point2 = [w[0], w[1]];
  let nb = b;
  let errors = 0;
  for (const { point, label } of data) {
    if (classify(point, nw, nb) !== label) {
      errors++;
      nw = [nw[0] + lr * label * point[0], nw[1] + lr * label * point[1]];
      nb = nb + lr * label;
    }
  }
  return { w: nw, b: nb, errors };
}

/** Train until zero errors (converged) or the epoch budget runs out. */
export function trainPerceptron(data: readonly LabeledPoint[], opts: TrainOptions = {}): TrainResult {
  const lr = opts.lr ?? 0.1;
  const maxEpochs = opts.maxEpochs ?? 100;
  let w: Point2 = opts.initW ?? [0, 0];
  let b = opts.initB ?? 0;

  for (let epoch = 1; epoch <= maxEpochs; epoch++) {
    const step = perceptronEpoch(data, w, b, lr);
    w = step.w;
    b = step.b;
    if (step.errors === 0) return { w, b, converged: true, epochs: epoch };
  }
  return { w, b, converged: false, epochs: maxEpochs };
}

/** Linearly separable ⇔ the perceptron converges within a generous epoch budget. */
export function linearlySeparable(data: readonly LabeledPoint[], opts: TrainOptions = {}): boolean {
  return trainPerceptron(data, { ...opts, maxEpochs: opts.maxEpochs ?? 1000 }).converged;
}

/** XOR: the classic non-separable set. Opposite corners share a class. */
export const XOR_PRESET: readonly LabeledPoint[] = [
  { point: [-1, -1], label: -1 },
  { point: [1, 1], label: -1 },
  { point: [-1, 1], label: 1 },
  { point: [1, -1], label: 1 },
];

/** A cleanly separable two-blob set, for contrast with XOR. */
export const SEPARABLE_PRESET: readonly LabeledPoint[] = [
  { point: [-1.2, -1.0], label: -1 },
  { point: [-0.8, -1.4], label: -1 },
  { point: [-1.4, -0.6], label: -1 },
  { point: [1.1, 1.2], label: 1 },
  { point: [0.9, 0.8], label: 1 },
  { point: [1.4, 1.1], label: 1 },
];
