// No compila, a propósito: error[E0502].
fn main() {
    let mut v = vec![1, 2, 3, 4];

    let primero = &v[0];
    v.push(5);
    println!("primero = {primero}");
}
