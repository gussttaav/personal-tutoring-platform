# P2-02 — First explorables (Blocks 1–2)

**Tag:** `COURSE-P2-02` · **Effort:** L · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Build the widget set for Blocks 1 and 1 on top of the P2-01 registry. These are the widgets that
prove the format works — and Block 2's backprop visualisations are where the "mathematical
rigour, made intuitive" promise either lands or doesn't.

## Context

- Blocks 1–2 are the first content written (P5-01/02), so these widgets unblock content.
- Widgets for Blocks 3–5 are deliberately deferred to P5 and authored next to their lessons —
  building them now would be guessing at what the prose needs.

## Files affected

| File | Change |
|------|--------|
| `src/features/courses/widgets/nlp/` (new) | `TokenizerPlayground`, `OneHotVsEmbedding`, `EmbeddingProjection` |
| `src/features/courses/widgets/nn/` (new) | `ActivationExplorer`, `PerceptronBoundary`, `GradientDescent2D`, `BackpropTrace`, `LossLandscape` |
| `src/features/courses/widgets/registry.ts` | Register the eight ids |
| `src/features/courses/widgets/math/` | Extend as needed (keep new maths pure + tested) |
| `public/courses/dl-nlp/embeddings-sample.json` (new) | Small precomputed 2D projection (~200 words) |

## The widgets

**Block 1 — Fundamentos**

| Id | What it does | Why it earns its place |
|---|---|---|
| `tokenizer-playground` | Type a sentence, see word / character / subword segmentation side by side | Makes "tokenisation is a *choice*" concrete in five seconds |
| `onehot-vs-embedding` | Same vocabulary as sparse one-hot vs. dense vector; dimensionality counter | The bridge argument of Block 1, made visual |
| `embedding-projection` | 2D scatter of precomputed embeddings; hover a word, see nearest neighbours; the king−man+woman vector drawn | The single most persuasive demo in NLP teaching |

**Block 2 — Perceptrón Multicapa**

| Id | What it does | Why it earns its place |
|---|---|---|
| `activation-explorer` | Overlay σ/tanh/ReLU/GELU + their derivatives; highlight saturation regions | Saturation is *seen*, which sets up vanishing gradients in Block 3 |
| `perceptron-boundary` | Drag 2D points, watch the decision boundary; XOR preset that cannot be separated | The classic motivation for hidden layers, felt rather than asserted |
| `gradient-descent-2d` | Contour plot, adjustable learning rate, step-through or animate; divergence at high lr | Learning rate intuition |
| `backprop-trace` | Small network diagram; click an output, see the chain rule propagate backwards term by term | **The centrepiece.** Backprop is the hardest thing in the course to teach |
| `loss-landscape` | Loss surface with the optimiser's path traced on it | Ties gradient descent to what the loss actually is |

**Precomputed embeddings, not a runtime model.** `embedding-projection` reads a small committed
JSON of ~200 common Spanish words already projected to 2D. No model download, no API call,
~30 KB. Choose the vocabulary so the analogy examples actually work — verify before committing.

## Acceptance criteria

- [ ] All eight widgets render, are keyboard-operable and work at 360px
- [ ] `backprop-trace` shows each chain-rule factor with its numeric value at every step, and steps both directions
- [ ] `activation-explorer` marks saturation regions where the derivative ≈ 0
- [ ] `perceptron-boundary` XOR preset visibly fails to separate — the pedagogical point
- [ ] `gradient-descent-2d` diverges visibly at a high learning rate rather than silently clipping
- [ ] `tokenizer-playground` handles Spanish accents and `ñ` correctly in all three modes
- [ ] All new maths is pure + unit-tested
- [ ] Each widget ≤ ~15 KB gzipped; embeddings JSON ≤ 50 KB
- [ ] `prefers-reduced-motion` respected by the two animated widgets
- [ ] `pnpm test` + `pnpm build` green

## Test plan

- **Unit:** new pure functions (tokenisation modes, decision-boundary computation, chain-rule
  factor extraction, contour generation). `backprop-trace`'s gradient values must be verified
  against a hand-computed example — a wrong number in the centrepiece widget is worse than no widget.
- **Manual:** every widget at 360px and on a real phone; keyboard-only pass; reduced-motion pass.
- **Content:** widgets embedded in the P1-01 fixture lesson so they're covered by the render check.

## Notes / gotchas

- **Verify `backprop-trace` numerically against a worked example.** This widget's entire value is
  that a student trusts it. Unit-test the displayed values, not just that it renders.
- Subword tokenisation in `tokenizer-playground` should use a small committed BPE vocabulary, not
  a library — pulling a tokenizer package for a teaching demo is not worth the bytes.
- Spanish text: normalise Unicode (NFC) before character-level tokenisation or `ñ` and accented
  vowels may split into base + combining mark and the demo will look broken.
- Reuse `WidgetFrame`'s reset control rather than each widget rolling its own.
- Resist making these configurable from MDX beyond one or two props. Presets in the component.

## Out of scope

- Widgets for Blocks 3–5 (RNN unrolling, LSTM gates, attention alignment, self-attention heat
  maps, positional encoding) — authored with their content in P5-03/04/05 using this same registry.
- Any Python execution (P2-03).
