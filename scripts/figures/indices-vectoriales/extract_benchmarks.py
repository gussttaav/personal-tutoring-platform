"""BLOG-12 — Pulls the benchmark numbers the post `indices-vectoriales` cites into
benchmarks.json, so make_svgs.py (pure Python) and the article read the same values.

Nothing here is measured by us. Two published sources:

  - VIBE (Jääsaari, Hyvönen, Ceccarello, Roos, Aumüller; arXiv:2505.17810), the results the
    project publishes at https://vector-index-bench.github.io (results/summary.parquet).
    Dataset arxiv-nomic-768-normalized: 1 344 643 arXiv abstracts embedded with Nomic Text,
    768 dimensions, 1 000 queries, recall@100. CPU runs on ONE core of a Xeon Gold 6230.
  - ANN-Benchmarks (Aumüller, Bernhardsson, Faithfull), https://ann-benchmarks.com, results
    "as of April 2025" on an AWS r6i.16xlarge, one CPU per run, recall@10. We read the
    brute-force baseline from the gist-960-euclidean page (1 000 000 GIST image descriptors,
    960 dimensions), which VIBE does not run.

Needs pandas + pyarrow (a scratch venv is fine): python extract_benchmarks.py
-> writes benchmarks.json next to this file. Results fetched on 2026-10-05; both sites can
change, so the JSON is committed and is what the article quotes."""
import io, json, os, re, urllib.request

import pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
VIBE_URL = "https://vector-index-bench.github.io/results/summary.parquet"
ANNB_URL = "https://ann-benchmarks.com/gist-960-euclidean_10_euclidean.html"
DATASET = "arxiv-nomic-768-normalized"
N_VECTORS, DIM = 1_344_643, 768

# One representative per family, the ones the chart draws. Key -> (VIBE name, family label es, en)
CHART = {
    "annoy": ("annoy", "Árbol (Annoy)", "Tree (Annoy)"),
    "lsh": ("puffinn", "Hashing (PUFFINN)", "Hashing (PUFFINN)"),
    "ivf": ("ivf(faiss)", "Listas (Faiss IVF)", "Lists (Faiss IVF)"),
    "ivfpq": ("ivfpqfs(faiss)", "Listas + PQ (Faiss)", "Lists + PQ (Faiss)"),
    "hnsw": ("hnswlib", "Grafo (hnswlib)", "Graph (hnswlib)"),
    "glass": ("glass", "Grafo comprimido (Glass)", "Compressed graph (Glass)"),
}
# Extra rows for the article's table and prose (not drawn).
TABLE_EXTRA = ["scann", "vamana(diskann)", "nsg(faiss)", "rabitq-ivf", "rabitq-hnsw", "falconnpp"]


def fetch(url):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def frontier(g):
    """Pareto frontier: walking from high recall to low, keep a run only if it is faster
    than every run with higher recall."""
    pts = sorted(zip(g.recall, g.qps), key=lambda p: -p[0])
    out, best = [], 0.0
    for r, q in pts:
        if q > best:
            out.append([round(r, 4), round(q, 1)])
            best = q
    return sorted(out)


def best_at(g, target):
    c = g[g.recall >= target]
    if c.empty:
        return None
    row = c.loc[c.qps.idxmax()]
    return {
        "recall": round(float(row.recall), 4),
        "qps": round(float(row.qps), 1),
        "build_s": round(float(row.build_time), 1),
        # VIBE reports index_size in KiB (the ANN-Benchmarks convention it inherits).
        "index_gb": round(float(row.index_size) * 1024 / 1e9, 2),
        "params": row.params.split("|")[0],
    }


def main():
    d = pd.read_parquet(io.BytesIO(fetch(VIBE_URL)))
    x = d[(d.dataset == DATASET) & (d.k == 100)]
    out = {
        "_nota": __doc__.split("\n\n")[0] + " See the module docstring for sources.",
        "vibe": {
            "dataset": DATASET,
            "n_vectors": N_VECTORS,
            "dim": DIM,
            "raw_float32_gb": round(N_VECTORS * DIM * 4 / 1e9, 2),
            "k": 100,
            "fetched": "2026-10-05",
            "chart": {},
            "table": {},
        },
    }
    for key, (name, es, en) in CHART.items():
        g = x[x.algorithm == name]
        out["vibe"]["chart"][key] = {"algorithm": name, "label_es": es, "label_en": en,
                                     "frontier": [p for p in frontier(g) if p[0] >= 0.5]}
    for name in [v[0] for v in CHART.values()] + TABLE_EXTRA:
        g = x[x.algorithm == name]
        out["vibe"]["table"][name] = {str(t): best_at(g, t) for t in (0.9, 0.95, 0.99)}

    html = fetch(ANNB_URL).decode()
    sec = html.split('<canvas id="chartRecallQueries per second (1/s)"')[1].split("<canvas id=")[0]
    bf = re.search(r'label: "bruteforce-blas".*?\{ x: ([0-9.]+) , y: ([0-9.]+)', sec, re.S)
    hn = re.search(r'label: "hnswlib",.*?data: \[(.*?)\n\s*\]', sec, re.S)
    hn_pts = [(float(a), float(b)) for a, b in re.findall(r"\{ x: ([0-9.]+) , y: ([0-9.e+]+)", hn.group(1))]
    hn95 = max(q for r, q in hn_pts if r >= 0.95)
    out["ann_benchmarks"] = {
        "dataset": "gist-960-euclidean", "n_vectors": 1_000_000, "dim": 960, "k": 10,
        "as_of": "April 2025 (README)", "fetched": "2026-10-05",
        "bruteforce_blas_qps": round(float(bf.group(2)), 2),
        "hnswlib_qps_at_recall_095": round(hn95, 1),
    }
    with open(os.path.join(HERE, "benchmarks.json"), "w") as f:
        json.dump(out, f, indent=2, ensure_ascii=False)
        f.write("\n")


if __name__ == "__main__":
    main()
