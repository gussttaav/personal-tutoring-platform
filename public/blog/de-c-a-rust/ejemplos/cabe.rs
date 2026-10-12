/// ¿Se puede sumar y (positivo) a x sin pasarse del máximo de un i32?
fn cabe(x: i32, y: i32) -> bool {
    x + y > x
}

/// La forma correcta: checked_add devuelve None si la suma se desborda.
fn cabe_bien(x: i32, y: i32) -> bool {
    x.checked_add(y).is_some()
}

fn main() {
    let y: i32 = std::env::args().nth(1).map_or(1, |s| s.parse().unwrap());
    println!("cabe_bien(i32::MAX, {y}) = {}", cabe_bien(i32::MAX, y));
    println!("cabe(i32::MAX, {y}) = {}", cabe(i32::MAX, y));
}
