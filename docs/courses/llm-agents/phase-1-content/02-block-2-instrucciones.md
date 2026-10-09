# P1-02 — Block 2: De predecir texto a seguir instrucciones

**Tag:** `COURSE-C2-P1-02` · **Effort:** XL · **Owner:** _tbd_ · **Status:** 🔄
**Depends on:** P1-01 · Block 2 widgets (built in this task) · the Colab notebook (written here)
**Course:** `llm-agents` → `content/courses/llm-agents/es/` · **Shape:** derivation
**Runs on:** the mini-GPT (every method is applied to it in a cell); Colab for the project
**Publication:** lesson by lesson, `draft: false` on merge

## TL;DR

Why a model that predicts text does not do what it is told, and the three ideas that changed
that: supervised fine-tuning on a *format* (the chat template is trained, not magic), a reward
learned from human comparisons, and optimising against it without drifting — RLHF, and then DPO,
which removes the reward model by algebra. **DPO is the block's star derivation**, in the style
of the first course's backpropagation lessons: every line, the $Z(x)$ cancellation shown, the
gradient interpreted. Project: SFT of a small open model on Spanish instructions, in Colab.

Mathematics: **high**. The last block where it is.

## New widgets (built here)

| Id | Lesson | Purpose |
|---|---|---|
| `chat-template` | 2 | A messages list on the left, the token string on the right — special tokens visible — and the positions that carry loss highlighted; toggle the mask |
| `bradley-terry` | 4 | Two responses with sliders for $r_A$, $r_B$; $\sigma(r_A - r_B)$ drawn; the loss for "A was chosen" as the gap moves; shows the additive-constant invariance |
| `dpo-loss` | 6 | The two log-ratios as axes, $\beta$ as a slider; the loss surface and the gradient weight $\sigma(\hat r_l - \hat r_w)$ — where it is large and where it "goes quiet" |

## Lessons

| # | Slug | Title | Widgets | Code | Quiz | Challenge |
|---|---|---|---|---|---|---|
| 10 | `predecir-no-es-obedecer` | Predecir no es obedecer | — | 1 | 4 | — |
| 11 | `plantilla-de-chat` | La plantilla de chat es un formato entrenado | `chat-template` | 2 | 4 | 1 |
| 12 | `sft` | Ajuste supervisado: máxima verosimilitud sobre un formato | — | 2 | 4 | 1 |
| 13 | `modelo-de-recompensa` | Preferencias y el modelo de recompensa | `bradley-terry` | 2 | 5 | 1 |
| 14 | `rlhf` | RLHF: mejorar la recompensa sin alejarse | — | 1 | 5 | — |
| 15 | `dpo` | DPO: la derivación completa | `dpo-loss` | 2 | 5 | 1 |
| 16 | `de-donde-salen-las-preferencias` | De dónde salen las preferencias: humanos, constituciones y modelos | — | — | 4 | — |
| 17 | `proyecto-sft-colab` | Proyecto: ajustar un modelo pequeño en Colab | — | — (Colab) | 3 | — |

**Bridge in:** lesson 10 picks up Block 1's project — the function that continues a question
instead of answering it — and shows it on the checkpoint in its one cell.

**Bridge out:** lesson 17 ends on what an instruction-tuned model still cannot do: it answers
from what it was trained on, in the words it was trained on, and nothing it says is checked. What
you *put in the prompt* is the next block.

## Lesson progress

- [x] 10. `predecir-no-es-obedecer`
- [x] 11. `plantilla-de-chat`
- [x] 12. `sft`
- [x] 13. `modelo-de-recompensa`
- [x] 14. `rlhf`
- [x] 15. `dpo`
- [ ] 16. `de-donde-salen-las-preferencias`
- [ ] 17. `proyecto-sft-colab`

## Mathematical content

- The chat template as a *format*: special tokens for roles, the string the model actually
  sees; SFT as $\mathcal{L}_{\text{SFT}} = -\sum_{t \in \text{resp}} \log \pi_\theta(y_t \mid x, y_{<t})$
  — **the same cross-entropy with a mask**, and its gradient is Block 1's gradient restricted to
  the masked positions (show it; it is two lines)
- Bradley–Terry: $P(y_w \succ y_l \mid x) = \sigma\big(r(x,y_w) - r(x,y_l)\big)$; the reward-model
  loss $-\log \sigma(\cdot)$; **why comparisons and not scores** (raters do not share a scale);
  the reward is defined **up to an additive per-prompt constant** — plant this, DPO harvests it
- The RLHF objective $\max_\pi \mathbb{E}_{y \sim \pi_\theta}[r_\phi(x,y)] - \beta\,
  \mathbb{D}_{\text{KL}}\big(\pi_\theta \,\|\, \pi_{\text{ref}}\big)$; the log-derivative trick
  $\nabla_\theta \mathbb{E}_{\pi_\theta}[r] = \mathbb{E}_{\pi_\theta}[\,r\,\nabla_\theta \log \pi_\theta\,]$
  **derived** (REINFORCE); the per-token KL estimate; **reward hacking shown on the mini-GPT**
  (a reward that counts a letter, and what the policy becomes without the KL term). PPO's
  clipping is a `reading` signpost
- DPO, entire: the optimum of the KL-regularised objective
  $\pi^*(y \mid x) = \frac{1}{Z(x)}\,\pi_{\text{ref}}(y \mid x)\,\exp\!\big(r(x,y)/\beta\big)$
  (the Gibbs/variational argument, in `<Details>` at full length); invert for
  $r(x,y) = \beta \log \frac{\pi^*(y \mid x)}{\pi_{\text{ref}}(y \mid x)} + \beta \log Z(x)$;
  substitute into Bradley–Terry; **$Z(x)$ cancels** because it is the additive constant of
  lesson 13; the loss
  $\mathcal{L}_{\text{DPO}} = -\log \sigma\!\Big(\beta \log \tfrac{\pi_\theta(y_w)}{\pi_{\text{ref}}(y_w)} - \beta \log \tfrac{\pi_\theta(y_l)}{\pi_{\text{ref}}(y_l)}\Big)$;
  its gradient, with the weight $\sigma(\hat r_l - \hat r_w)$ read as "how wrong the implicit
  reward still is" — the widget's whole content
- Lesson 16 has no new mathematics; it is the map: where pairs come from (raters, a
  constitution + critique/revision, another model), what "aligned" does and does not mean.
  Short, like `bert-y-gpt`

## Acceptance criteria

- [ ] All 8 lessons published, within budget
- [ ] SFT (12), the reward head (13), REINFORCE with a hackable reward (14) and DPO (15) **each
      run on the mini-GPT in a cell** under the cap, with a printed number the prose quotes: the
      changed completion, the pair accuracy, the reward-vs-KL pair, the implicit-reward margin
- [ ] The DPO derivation is complete on the page (with `<Details>`), and the $Z(x)$
      cancellation is stated as the payoff of lesson 13's invariance
- [ ] Reward hacking is *shown*, not described
- [ ] The Colab notebook: pinned library versions, a pinned model with a permissive licence
      (candidates at authoring time: a ~0.5B `Qwen2.5` or `SmolLM2` — verify the licence and that
      it fits the free tier; **LoRA as the fallback if full fine-tuning does not**, stated not
      derived), Spanish instruction data with its source named; runs end-to-end from a fresh
      account; lives in `docs/courses/llm-agents/notebooks/` and is linked at a pinned revision
- [ ] Lesson 17 states plainly that this does not run in the browser, and why, with the number
      (the `fine-tuning-colab` precedent)
- [ ] The three widgets registered, bilingual, maths unit-tested
- [ ] `lint:content` green

## Test plan

- Every cell on a phone, from the production build.
- `math/__tests__/dpo.test.ts`: the loss at $\beta \to 0$ and at equal log-ratios; the gradient
  weight at the two extremes; a reference value the lesson prints.
- The notebook from a fresh Google account, on the free GPU runtime, twice (the second time a
  week later, to catch a silently bumped dependency).

## Notes / gotchas

- **Ten instruction pairs are enough for the mini-GPT to visibly change and are not enough for
  anything else.** Say so. The point of the in-browser SFT is the mechanism, and P0-03's
  property 4 guarantees the change is visible.
- The reward model on the mini-GPT is a **linear head over mean-pooled final hidden states**
  with the body frozen. Training it is cheap and the pair accuracy is a real number. Do not
  unfreeze the body in a 10 s cell.
- REINFORCE on the mini-GPT: one step is a batch of sampled continuations + a backward pass.
  Keep the batch small (8) and the continuation short (16 tokens); the reward-goes-up-KL-goes-up
  curve over 30 steps is the lesson.
- Lesson 16 will attract expansion (safety, the alignment debate). It is a map; hold it to the
  budget's floor, not its ceiling.
- Notebooks rot. The first course's rule stands: pin everything, link a revision, add to the
  maintenance list.

## Out of scope

- PPO in detail, GRPO, RLVR, process rewards — signposts in `reading` and in lesson 16.
- Preference data collection at scale, rater guidelines.
- Safety evaluation as a discipline.
