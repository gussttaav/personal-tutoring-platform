# COURSE-C2-P3-02 — Byte-level BPE: the tokeniser of the llm-agents course's mini-GPT.
# The English sibling of bpe.py (COURSE-C2-P0-03): the same file with only its names,
# comments and docstrings translated, against the identifier map in
# docs/courses/llm-agents/AUTHORING.en.md §1. Same arithmetic, same order of operations;
# `scripts/courses/llm-agents/parity-en.py` asserts both files give the same outputs.
#
# Block 1 lesson 2 writes it; this file is the frozen copy that
# `scripts/courses/llm-agents/train-minigpt.py --idioma en` imports to train and that the
# cells load with `exec(open_url("/courses/llm-agents/bpe.en.py").read())`. One file, two
# consumers: that way the tokeniser that produced `bpe-merges.en.json` is, byte for byte,
# the one the student reads.
#
# No dependencies: only `re` and `collections`, which Pyodide ships with.
import re
from collections import Counter, defaultdict

# Pre-tokenisation, like GPT-2's in miniature: a word with its leading space, a number, a
# run of symbols, or the leftover whitespace. A merge never crosses these borders, so no
# token mixes the end of one word with the start of the next.
#
# COURSE-C2-P1-01: the run of symbols was `[^\w\s]`, which leaves out `_` (it is `\w`, but
# neither a letter nor a digit), so no alternative caught it and `findall` dropped it: "a_b"
# came back as "ab". With `(?:[^\w\s]|_)` every character falls into a pre-token and
# decode(encode(x)) is x for any text. The corpus has no `_`: the merges do not change.
PATTERN = re.compile(r" ?[^\W\d_]+| ?\d+| ?(?:[^\w\s]|_)+|\s+(?!\S)|\s+")

N_BYTES = 256  # the first 256 tokens are the bytes; merge i creates token 256 + i


def strip_header(raw):
    """The corpus carries one header line (source and licence) that is not text."""
    return raw.split("\n", 1)[1].lstrip()


def pairs(ids):
    """The pairs of neighbours in a list of tokens: (ids[0], ids[1]), (ids[1], ids[2]), ..."""
    return zip(ids, ids[1:])


def merge(ids, pair, new):
    """Replaces each consecutive occurrence of `pair` with the token `new`."""
    out, i = [], 0
    while i < len(ids):
        if i + 1 < len(ids) and (ids[i], ids[i + 1]) == pair:
            out.append(new)
            i += 2
        else:
            out.append(ids[i])
            i += 1
    return out


def train(text, m, counts=None):
    """Learns `m` merges on `text` and returns them in order: [(a, b), ...].

    Merge number i (from zero) joins tokens a and b into token 256 + i. It is the whole
    algorithm: count the pairs of neighbours, merge the most frequent, repeat. The
    counting happens once; after that, each merge only recounts the pre-tokens where the
    pair was, because nothing changes in the others. If `counts` is a list, it receives
    the frequency of each pair at the moment it is merged.

    COURSE-C2-P1-01 (lesson 1·2): it used to recount the whole corpus on every merge.
    Same merges, byte for byte (`bpe-merges.json` does not change), and about four times
    faster, which is what lets 64 merges train inside a cell.
    """
    words = Counter(PATTERN.findall(text))               # each distinct pre-token, with its count
    pieces = {w: list(w.encode("utf-8")) for w in words}
    f, where = Counter(), defaultdict(set)               # f[pair], and which pre-tokens it is in
    for w, n in words.items():
        for pair in pairs(pieces[w]):
            f[pair] += n
            where[pair].add(w)
    merges = []
    for i in range(m):
        best = max(f, key=lambda p: (f[p], -p[0], -p[1]), default=None)   # tie: the smaller pair
        if best is None or f[best] <= 0:
            break
        merges.append(best)
        if counts is not None:
            counts.append(f[best])
        for w in where.pop(best):                        # it only changes where the pair was
            n, old = words[w], pieces[w]
            pieces[w] = merge(old, best, N_BYTES + i)
            for pair in pairs(old):
                f[pair] -= n
            for pair in pairs(pieces[w]):
                f[pair] += n
                where[pair].add(w)
        del f[best]
    return merges


def encode(text, merges):
    """Text -> list of ids, applying the merges in the order they were learnt."""
    rank = {pair: i for i, pair in enumerate(merges)}
    cache, out = {}, []
    for w in PATTERN.findall(text):
        if w not in cache:
            ids = list(w.encode("utf-8"))
            while len(ids) > 1:
                pair = min(pairs(ids), key=lambda p: rank.get(p, len(rank)))
                if pair not in rank:
                    break
                ids = merge(ids, pair, N_BYTES + rank[pair])
            cache[w] = ids
        out.extend(cache[w])
    return out


def vocabulary(merges):
    """id -> bytes, for the 256 bytes and for each merge."""
    vocab = {i: bytes([i]) for i in range(N_BYTES)}
    for i, (a, b) in enumerate(merges):
        vocab[N_BYTES + i] = vocab[a] + vocab[b]
    return vocab


def decode(ids, merges):
    """List of ids -> text. A lone byte in the middle of a character comes out as U+FFFD."""
    vocab = vocabulary(merges)
    return b"".join(vocab[i] for i in ids).decode("utf-8", errors="replace")
