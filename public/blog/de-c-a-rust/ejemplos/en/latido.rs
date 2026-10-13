/// Answers a heartbeat: returns the `longitud` bytes the client says it sent.
fn responder(mensaje: &[u8], longitud: usize) -> Vec<u8> {
    mensaje[..longitud].to_vec()
}

/// The version that doesn't stop: if the length doesn't add up, there's no answer.
fn responder_bien(mensaje: &[u8], longitud: usize) -> Option<Vec<u8>> {
    mensaje.get(..longitud).map(|trozo| trozo.to_vec())
}

fn main() {
    let mensaje = b"HOLA".to_vec();              // the client sends 4 bytes
    let clave = String::from("clave-privada-del-servidor");

    match responder_bien(&mensaje, 64) {
        Some(r) => println!("{}", String::from_utf8_lossy(&r)),
        None => println!("latido mal formado: se descarta"),
    }
    let r = responder(&mensaje, 64);             // but says it sent 64
    println!("{} {}", String::from_utf8_lossy(&r), clave.len());
}
