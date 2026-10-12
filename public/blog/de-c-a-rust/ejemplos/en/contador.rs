// Doesn't compile, on purpose: error[E0499].
use std::thread;

fn main() {
    let mut contador: u64 = 0;
    thread::scope(|s| {
        for _ in 0..4 {
            s.spawn(|| {
                for _ in 0..1_000_000 { contador += 1; }
            });
        }
    });
    println!("contador = {contador}");
}
