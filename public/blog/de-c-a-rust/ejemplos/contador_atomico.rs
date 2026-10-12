use std::sync::atomic::{AtomicU64, Ordering};
use std::thread;

fn main() {
    let contador = AtomicU64::new(0);
    thread::scope(|s| {
        for _ in 0..4 {
            s.spawn(|| {
                for _ in 0..1_000_000 { contador.fetch_add(1, Ordering::Relaxed); }
            });
        }
    });
    println!("contador = {}", contador.into_inner());
}
