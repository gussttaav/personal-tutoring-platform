"""Medidas del artículo «El mismo examen, tres notas: qué mide de verdad un banco de pruebas».

Lee de varias formas las respuestas de dos modelos pequeños y abiertos a las mismas preguntas de
MMLU, en la CPU de un portátil, y guarda cada probabilidad en resultados/mmlu.json.

Uso:
    python3 -m venv venv && . venv/bin/activate
    pip install torch --index-url https://download.pytorch.org/whl/cpu
    pip install transformers pyarrow huggingface_hub
    python3 medir_mmlu.py HuggingFaceTB/SmolLM2-360M Qwen/Qwen2.5-0.5B

Descarga unos 2 GB (PyTorch, los dos modelos y las preguntas) y tarda unas tres horas y media en
un Intel Core i5-6300U de dos núcleos. LIMIT=10 mide sólo diez preguntas y no escribe nada.

El mismo modelo, el mismo prompt con cinco ejemplos y las mismas preguntas; sólo cambia cómo se
LEE la respuesta:

  letter      el código original de MMLU: la probabilidad de los cuatro tokens " A" … " D" justo
              después de "Answer:"; gana la mayor. El modelo no llega a escribir nada.
  nospace     lo mismo con los tokens "A" … "D", sin el espacio delante: la trampa de la
              tokenización. Después de "Answer:" el token siguiente es " A", así que "A" puntúa un
              token que el texto nunca contiene.
  generate    lo que ve una evaluación que deja escribir al modelo (como HELM): su token más
              probable entre TODO el vocabulario, sin espacios; acierta sólo si es la letra
              correcta. Un " The" o un salto de línea es un fallo aunque la letra correcta tenga
              más probabilidad que las otras tres.
  option      como el LM Evaluation Harness de 2023: la probabilidad de cada opción entera,
              " B. <texto>", como continuación del mismo prompt; gana la suma mayor.
              `option_norm` la divide por el número de tokens.
  cloze       la formulación «cloze» (CF en OLMES): las opciones NO se muestran; el prompt es
              "Question: …\\nAnswer:" y se puntúa el texto de cada opción como continuación,
              dividido por su longitud en caracteres, que es la normalización de OLMES para MMLU.
              `cloze_raw`: la suma sin dividir.
  rotations   la lectura de la letra otra vez, con las opciones rotadas para que la correcta
              quede en la A, la B, la C y la D por turno: si el modelo prefiere una letra, gana
              cuando la clave está ahí.

Preguntas: las de prueba de MMLU, PER_SUBJECT de cada una de las 57 materias, elegidas con
random.Random(SEED) entre los índices de cada materia, así que el promedio por preguntas y el
promedio por materias coinciden. Los cinco ejemplos son las cinco preguntas de dev de la materia,
como en el artículo original.

Tokens. Cada prompt (los cinco ejemplos más la pregunta) se tokeniza ENTERO. Los cinco ejemplos se
procesan una vez por materia y su caché de claves y valores se reutiliza cuando los tokens del
prompt empiezan por los suyos; cuando el tokenizador une algo a través de ese corte (una respuesta
de ejemplo que acaba en "." o en un espacio), el prompt se procesa desde el principio (lo cuenta
`uncached_prompts`), así que el modelo ve siempre exactamente los tokens del prompt entero. Las
opciones se tokenizan aparte y se añaden al final, como hace el Harness.

float32 en CPU, sin sorteo: el resultado es determinista salvo por el orden de las sumas en coma
flotante, así que otra CPU puede deshacer un empate casi exacto, es decir, mover un porcentaje en
una pregunta o así."""
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
LIMIT = int(os.environ.get("LIMIT", "0"))  # > 0: sólo esas preguntas, y no se escribe nada


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
    """La cabecera y los cinco ejemplos resueltos, cada uno seguido de una línea en blanco salvo el
    último: la línea en blanco anterior a la pregunta forma parte del texto de la pregunta (SmolLM2
    codifica un "\\n\\n" final como un token y un "\\n\\n" seguido de texto como dos, y este corte
    mantiene la caché utilizable)."""
    return header(subject) + SEP.join(example(r, True) for r in shots)


@dataclass
class State:
    ids: list
    cache: object
    last: torch.Tensor  # log-probabilidades del token siguiente


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
        """Procesa `ids` después del State `after` (o desde cero); devuelve (State, log-probabilidades en cada posición nueva)."""
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
        """El prompt entero pre_text + text, exactamente como una sola tokenización; usa la caché de `pre` cuando puede."""
        full = self.enc(pre_text + text)
        n = len(pre.ids)
        if full[:n] == pre.ids:
            return self.feed(full[n:], pre)[0]
        self.uncached += 1
        return self.feed(full)[0]

    def continuation(self, state, text):
        """(suma de log-probabilidades, número de tokens) de `text` añadido al prompt `state`."""
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
    """La misma pregunta con las opciones rotadas para que la correcta quede en la posición k."""
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
            print(f"  {name}: {n + 1}/{len(picked)}  {(time.time() - t0) / (n + 1):.1f} s/pregunta", flush=True)
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
    """Seis decimales bastan para cualquier comparación del artículo y reducen el fichero a la mitad."""
    if isinstance(x, float):
        return round(x, 6)
    if isinstance(x, list):
        return [rounded(v) for v in x]
    if isinstance(x, dict):
        return {k: rounded(v) for k, v in x.items()}
    return x


def cpu_name():
    """El modelo de procesador, de /proc/cpuinfo en Linux; si no, lo que diga platform."""
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
        print(name, m["seconds"], "s,", m["uncached_prompts"], "sin caché;", json.dumps(m["summary"]))
        results["models"][name] = m
        if not LIMIT:
            os.makedirs(os.path.dirname(OUT), exist_ok=True)
            with open(OUT, "w") as f:
                json.dump(rounded(results), f, ensure_ascii=False, indent=1)


if __name__ == "__main__":
    main()
