"""Measurements for the article "Same exam, three scores: what a benchmark really measures".

English-commented copy of ../medir_mmlu.py: same code, and the result fields keep their names.

Reads, in several ways, the answers of two small open models to the same MMLU questions, on a
laptop CPU, and saves every probability to resultados/mmlu.json.

Usage:
    python3 -m venv venv && . venv/bin/activate
    pip install torch --index-url https://download.pytorch.org/whl/cpu
    pip install transformers pyarrow huggingface_hub
    python3 medir_mmlu.py HuggingFaceTB/SmolLM2-360M Qwen/Qwen2.5-0.5B

It downloads about 2 GB (PyTorch, both models and the questions) and takes about three and a half
hours on a dual-core Intel Core i5-6300U. LIMIT=10 measures only ten questions and writes nothing.

Same model, same five-example prompt, same questions; only the way the answer is READ changes:

  letter      MMLU's original code: the probability of the four tokens " A" … " D" right after
              "Answer:"; the highest wins. The model never writes anything.
  nospace     the same with the tokens "A" … "D", without the leading space: the tokenisation
              trap. After "Answer:" the next token is " A", so "A" scores a token the text never
              contains.
  generate    what an evaluation that lets the model write sees (as HELM does): its most likely
              token over the WHOLE vocabulary, stripped of spaces; right only if it is the right
              letter. A " The" or a line break is wrong even when the right letter has more
              probability than the other three.
  option      as the 2023 LM Evaluation Harness did: the probability of each whole option,
              " B. <text>", as a continuation of the same prompt; the highest sum wins.
              `option_norm` divides it by the number of tokens.
  cloze       the cloze formulation (OLMES's CF): the options are NOT shown; the prompt is
              "Question: …\\nAnswer:" and each option's text is scored as a continuation, divided
              by its length in characters, which is OLMES's normalisation for MMLU.
              `cloze_raw`: the undivided sum.
  rotations   the letter reading again, with the options rotated so that the right one sits in
              A, B, C and D in turn: if the model prefers a letter, it gains when the key is there.

Questions: MMLU's test questions, PER_SUBJECT from each of the 57 subjects, picked with
random.Random(SEED) among each subject's indices, so the average over questions and the average
over subjects coincide. The five examples are the subject's five dev questions, as in the original
paper.

Tokens. Each prompt (the five examples plus the question) is tokenised WHOLE. The five examples are
run once per subject and their key/value cache is reused when the prompt's tokens start with
theirs; when the tokenizer merges something across that cut (an example answer ending in "." or a
space), the prompt is run from scratch instead (counted in `uncached_prompts`), so the model always
sees exactly the whole prompt's tokens. The options are tokenised separately and appended, as the
Harness does.

float32 on CPU, no sampling: the result is deterministic up to the order of floating-point sums, so
another CPU can flip a near-exact tie, i.e. move a percentage by a question or so."""
import copy, json, os, platform, random, sys, time
from dataclasses import dataclass

import pyarrow.parquet as pq
import torch
from huggingface_hub import hf_hub_download
from transformers import AutoModelForCausalLM, AutoTokenizer

PER_SUBJECT = 10
SEED = 0
LETTERS = "ABCD"
SEP = "\n\n"
REVISIONS = {
    "HuggingFaceTB/SmolLM2-360M": "f8027fd0eaeea54caa13c31d31b9fdc459c38b49",
    "Qwen/Qwen2.5-0.5B": "060db6499f32faf8b98477b0a26969ef7d8b9987",
}
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "resultados", "mmlu.json")
LIMIT = int(os.environ.get("LIMIT", "0"))  # > 0: only that many questions, and nothing is written


def load(split):
    path = hf_hub_download("cais/mmlu", f"all/{split}-00000-of-00001.parquet", repo_type="dataset")
    return pq.read_table(path).to_pylist()


def header(subject):
    return f"The following are multiple choice questions (with answers) about {subject.replace('_', ' ')}.\n\n"


def mcf_example(row, with_answer):
    s = row["question"].strip() + "\n"
    for letter, choice in zip(LETTERS, row["choices"]):
        s += f"{letter}. {choice}\n"
    s += "Answer:"
    if with_answer:
        s += f" {LETTERS[row['answer']]}"
    return s


def cf_example(row, with_answer):
    s = f"Question: {row['question'].strip()}\nAnswer:"
    if with_answer:
        s += f" {row['choices'][row['answer']]}"
    return s


def prefix(subject, shots, example):
    """The header and the five solved examples, each followed by a blank line except the last: the
    blank line before the question is part of the question's text (SmolLM2 encodes a trailing
    "\\n\\n" as one token and "\\n\\n" followed by text as two, and this cut keeps the cache usable)."""
    return header(subject) + SEP.join(example(r, True) for r in shots)


@dataclass
class State:
    ids: list
    cache: object
    last: torch.Tensor  # log-probabilities of the next token


class Scorer:
    def __init__(self, name):
        self.tok = AutoTokenizer.from_pretrained(name, revision=REVISIONS[name])
        self.model = AutoModelForCausalLM.from_pretrained(
            name, revision=REVISIONS[name], dtype=torch.float32
        ).eval()
        self.letter_ids = [self.single(" " + l) for l in LETTERS]
        self.nospace_ids = [self.single(l) for l in LETTERS]
        self.uncached = 0

    def enc(self, text):
        return self.tok(text, add_special_tokens=False).input_ids

    def single(self, text):
        ids = self.enc(text)
        assert len(ids) == 1, (text, ids)
        return ids[0]

    @torch.no_grad()
    def feed(self, ids, after=None):
        """Runs `ids` after the State `after` (or from scratch); returns (State, log-probabilities at each new position)."""
        out = self.model(
            torch.tensor([ids]),
            past_key_values=copy.deepcopy(after.cache) if after else None,
            use_cache=True,
        )
        logp = torch.log_softmax(out.logits[0].float(), dim=-1)
        return State((after.ids if after else []) + ids, out.past_key_values, logp[-1]), logp

    def start(self, text):
        return self.feed(self.enc(text))[0]

    def prompt(self, pre, pre_text, text):
        """The whole prompt pre_text + text, exactly as one tokenisation; uses `pre`'s cache when it can."""
        full = self.enc(pre_text + text)
        n = len(pre.ids)
        if full[:n] == pre.ids:
            return self.feed(full[n:], pre)[0]
        self.uncached += 1
        return self.feed(full)[0]

    def continuation(self, state, text):
        """(sum of log-probabilities, number of tokens) of `text` appended to the prompt `state`."""
        ids = self.enc(text)
        total = state.last[ids[0]].item()
        if len(ids) > 1:
            _, logp = self.feed(ids[:-1], state)
            total += sum(logp[i, t].item() for i, t in enumerate(ids[1:]))
        return total, len(ids)


def sample(test):
    by_subject = {}
    for i, row in enumerate(test):
        by_subject.setdefault(row["subject"], []).append(i)
    rng = random.Random(SEED)
    picked = []
    for subject in sorted(by_subject):
        picked += sorted(rng.sample(by_subject[subject], PER_SUBJECT))
    return picked


def rotate(row, k):
    """The same question with its options rotated so that the right one is at position k."""
    shift = (row["answer"] - k) % len(row["choices"])
    return {**row, "choices": row["choices"][shift:] + row["choices"][:shift], "answer": k}


def measure(name, test, dev, picked):
    s = Scorer(name)
    shots_by_subject = {}
    for row in dev:
        shots_by_subject.setdefault(row["subject"], []).append(row)
    rows, t0, cached = [], time.time(), {}
    for n, i in enumerate(picked):
        row = test[i]
        subj = row["subject"]
        if subj not in cached:
            shots = shots_by_subject[subj]
            assert len(shots) == 5
            mcf_text, cf_text = prefix(subj, shots, mcf_example), prefix(subj, shots, cf_example)
            cached = {subj: (mcf_text, s.start(mcf_text), cf_text, s.start(cf_text))}
        mcf_text, mcf, cf_text, cf = cached[subj]

        q = s.prompt(mcf, mcf_text, SEP + mcf_example(row, False))
        top = int(q.last.argmax())
        option = [s.continuation(q, f" {l}. {c}") for l, c in zip(LETTERS, row["choices"])]
        c = s.prompt(cf, cf_text, SEP + cf_example(row, False))
        cloze = [s.continuation(c, f" {choice}") for choice in row["choices"]]
        rotations = []
        for k in range(4):
            r = s.prompt(mcf, mcf_text, SEP + mcf_example(rotate(row, k), False))
            rotations.append(max(range(4), key=lambda j: r.last[s.letter_ids[j]].item()))

        rows.append({
            "i": i,
            "subject": subj,
            "answer": row["answer"],
            "letter_logp": [q.last[t].item() for t in s.letter_ids],
            "nospace_logp": [q.last[t].item() for t in s.nospace_ids],
            "letter_mass": sum(torch.exp(q.last[t]).item() for t in s.letter_ids),
            "top_token": s.tok.decode([top]),
            "top_prob": torch.exp(q.last[top]).item(),
            "option_logp": [lp for lp, _ in option],
            "option_tokens": [nt for _, nt in option],
            "cloze_logp": [lp for lp, _ in cloze],
            "cloze_chars": [len(f" {choice}") for choice in row["choices"]],
            "rotation_pred": rotations,
        })
        if n % 10 == 9:
            print(f"  {name}: {n + 1}/{len(picked)}  {(time.time() - t0) / (n + 1):.1f} s/question", flush=True)
    return {
        "model": name,
        "revision": REVISIONS[name],
        "seconds": round(time.time() - t0),
        "uncached_prompts": s.uncached,
        "questions": rows,
    }


def argmax(xs):
    return max(range(len(xs)), key=lambda j: xs[j])


def summary(m):
    q = m["questions"]
    n = len(q)
    acc = lambda pred: sum(pred(r) == r["answer"] for r in q) / n
    return {
        "n": n,
        "letter": acc(lambda r: argmax(r["letter_logp"])),
        "nospace": acc(lambda r: argmax(r["nospace_logp"])),
        "generate": sum(r["top_token"].strip() == LETTERS[r["answer"]] for r in q) / n,
        "generate_not_a_letter": sum(r["top_token"].strip() not in LETTERS for r in q) / n,
        "option": acc(lambda r: argmax(r["option_logp"])),
        "option_norm": acc(lambda r: argmax([lp / nt for lp, nt in zip(r["option_logp"], r["option_tokens"])])),
        "cloze": acc(lambda r: argmax([lp / nc for lp, nc in zip(r["cloze_logp"], r["cloze_chars"])])),
        "cloze_raw": acc(lambda r: argmax(r["cloze_logp"])),
        "letter_mass_mean": sum(r["letter_mass"] for r in q) / n,
        "rotation_acc": [sum(r["rotation_pred"][k] == k for r in q) / n for k in range(4)],
        "rotation_pred_share": [sum(p == k for r in q for p in r["rotation_pred"]) / (4 * n) for k in range(4)],
        "key_share": [sum(r["answer"] == k for r in q) / n for k in range(4)],
    }


def rounded(x):
    """Six decimals are enough for every comparison in the article and halve the file."""
    if isinstance(x, float):
        return round(x, 6)
    if isinstance(x, list):
        return [rounded(v) for v in x]
    if isinstance(x, dict):
        return {k: rounded(v) for k, v in x.items()}
    return x


def cpu_name():
    """The processor model, from /proc/cpuinfo on Linux; otherwise whatever platform reports."""
    try:
        with open("/proc/cpuinfo") as f:
            for line in f:
                if line.startswith("model name"):
                    return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or platform.machine()


def main():
    torch.manual_seed(0)
    torch.set_num_threads(int(os.environ.get("THREADS", torch.get_num_threads())))
    test, dev = load("test"), load("dev")
    picked = sample(test)[: LIMIT or None]
    results = json.load(open(OUT)) if os.path.exists(OUT) and not LIMIT else {"models": {}}
    results["setup"] = {
        "per_subject": PER_SUBJECT, "seed": SEED, "subjects": 57, "shots": 5,
        "cpu": cpu_name(), "threads": torch.get_num_threads(),
        "torch": torch.__version__, "dtype": "float32",
    }
    for name in sys.argv[1:]:
        m = measure(name, test, dev, picked)
        m["summary"] = summary(m)
        print(name, m["seconds"], "s,", m["uncached_prompts"], "uncached;", json.dumps(m["summary"]))
        results["models"][name] = m
        if not LIMIT:
            os.makedirs(os.path.dirname(OUT), exist_ok=True)
            with open(OUT, "w") as f:
                json.dump(rounded(results), f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
