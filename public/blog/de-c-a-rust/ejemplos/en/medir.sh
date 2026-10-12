#!/usr/bin/env bash
# Compiles and runs every example in the post "Why C is being replaced by Rust, and why
# C won't disappear" (gustavoai.dev/en/blog/de-c-a-rust).
#
# Needs gcc (with C23 support: gcc 14 or later) and rustc. The files that don't compile fail
# on purpose: the compiler error is the result. Identifiers and output stay in Spanish, as in
# the post; only the comments are translated.
# Usage: bash medir.sh        (from this folder; leaves the binaries in ./bin)
cd "$(dirname "$0")"
mkdir -p bin
C="gcc -std=c23 -Wall -Wextra"
paso() { printf '\n\033[1m== %s\033[0m\n' "$*"; }

paso "gcc and rustc"; gcc --version | head -1; rustc --version

paso "1. Reading past the end"
$C -O2 latido.c -o bin/latido && ./bin/latido
$C -g -fsanitize=address latido.c -o bin/latido_asan && ./bin/latido_asan 2>&1 | sed -n '2,3p'
rustc -O latido.rs -o bin/latido_rs && ./bin/latido_rs

paso "2. Using memory that has already been freed"
$C -O2 primero.c -o bin/primero && ./bin/primero
$C -g -fsanitize=address primero.c -o bin/primero_asan && ./bin/primero_asan 2>&1 | sed -n '2,3p'
$C -O2 primero_movido.c -o bin/primero_movido && ./bin/primero_movido && ./bin/primero_movido
rustc primero.rs -o bin/primero_rs

paso "3. NULL"
$C -O2 buscar.c -o bin/buscar && ./bin/buscar
rustc -O buscar.rs -o bin/buscar_rs && ./bin/buscar_rs

paso "4. Two threads, one counter"
for o in -O0 -O2; do $C $o contador.c -o bin/contador$o && echo "gcc $o:" && for i in 1 2 3; do ./bin/contador$o; done; done
rustc contador.rs -o bin/contador_rs
rustc -O contador_atomico.rs -o bin/contador_atomico && ./bin/contador_atomico

paso "5. The check the compiler deletes"
for o in -O0 -O2; do $C $o cabe.c -o bin/cabe$o && echo "gcc $o:" && ./bin/cabe$o; done
$C -fsanitize=undefined cabe.c -o bin/cabe_ubsan && ./bin/cabe_ubsan
$C -O2 cabe_ckd.c -o bin/cabe_ckd && echo "C23, ckd_add:" && ./bin/cabe_ckd
rustc cabe.rs -o bin/cabe_debug && echo "rustc, unoptimised:" && ./bin/cabe_debug
rustc -O cabe.rs -o bin/cabe_release && echo "rustc -O:" && ./bin/cabe_release

paso "Cost of checking the indices (takes a couple of minutes)"
gcc -std=c23 -O3 indices.c -o bin/indices_c && rustc -C opt-level=3 indices.rs -o bin/indices_rs
echo "-- table of 4096 ints (fits in the cache)"; ./bin/indices_c; ./bin/indices_rs
echo "-- table of 16 million (doesn't fit)"; ./bin/indices_c 16777216; ./bin/indices_rs 16777216

paso "Executable size"
gcc -O2 hola.c -o bin/hola_c && rustc -C opt-level=3 hola.rs -o bin/hola_rs
cp bin/hola_c bin/hola_c_strip && strip bin/hola_c_strip
cp bin/hola_rs bin/hola_rs_strip && strip bin/hola_rs_strip
ls -l bin/hola_c bin/hola_c_strip bin/hola_rs bin/hola_rs_strip | awk '{print $5, $9}'
