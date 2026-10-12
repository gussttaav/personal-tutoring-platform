// Lo mismo que indices.c, con tres versiones de la suma salteada.
use std::hint::black_box;
use std::time::Instant;

const N: usize = 1 << 24;
const REPS: usize = 21;

#[inline(never)]
fn salteada(tabla: &[u32], idx: &[u32]) -> u64 {
    let mut s = 0u64;
    for i in 0..idx.len() {
        s += tabla[idx[i] as usize] as u64;      // comprueba tabla[...] cada vez
    }
    s
}

#[inline(never)]
fn salteada_iterador(tabla: &[u32], idx: &[u32]) -> u64 {
    idx.iter().map(|&j| tabla[j as usize] as u64).sum()
}

#[inline(never)]
fn salteada_sin_comprobar(tabla: &[u32], idx: &[u32]) -> u64 {
    let mut s = 0u64;
    for i in 0..idx.len() {
        s += unsafe { *tabla.get_unchecked(*idx.get_unchecked(i) as usize) } as u64;
    }
    s
}

#[inline(never)]
fn seguida(v: &[u32]) -> u64 {
    let mut s = 0u64;
    for i in 0..v.len() {
        s += v[i] as u64;                         // el compilador quita la comprobación
    }
    s
}

fn mediana(f: impl Fn() -> u64) -> f64 {
    let mut t: Vec<f64> = (0..REPS)
        .map(|_| {
            let a = Instant::now();
            black_box(f());
            a.elapsed().as_secs_f64() * 1e3
        })
        .collect();
    t.sort_by(|a, b| a.partial_cmp(b).unwrap());
    t[REPS / 2]
}

fn main() {
    let tam: usize = std::env::args().nth(1).map_or(4096, |s| s.parse().unwrap());
    let tabla: Vec<u32> = (0..tam as u32).collect();
    let mut x: u64 = 42;
    let idx: Vec<u32> = (0..N)
        .map(|_| {
            x ^= x << 13; x ^= x >> 7; x ^= x << 17;
            (x % tam as u64) as u32
        })
        .collect();
    let v: Vec<u32> = (0..N as u32).collect();
    let (tabla, idx, v) = (black_box(tabla), black_box(idx), black_box(v));

    println!("salteada:                 {:6.1} ms", mediana(|| salteada(&tabla, &idx)));
    println!("salteada (iterador):      {:6.1} ms", mediana(|| salteada_iterador(&tabla, &idx)));
    println!("salteada (sin comprobar): {:6.1} ms", mediana(|| salteada_sin_comprobar(&tabla, &idx)));
    println!("seguida:                  {:6.1} ms", mediana(|| seguida(&v)));
    println!("(sumas: {} {})", salteada(&tabla, &idx), seguida(&v));
}
