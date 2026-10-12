/// Responde a un latido: devuelve los `longitud` bytes que el cliente dice haber enviado.
fn responder(mensaje: &[u8], longitud: usize) -> Vec<u8> {
    mensaje[..longitud].to_vec()
}

/// La versión que no se detiene: si la longitud no cuadra, no hay respuesta.
fn responder_bien(mensaje: &[u8], longitud: usize) -> Option<Vec<u8>> {
    mensaje.get(..longitud).map(|trozo| trozo.to_vec())
}

fn main() {
    let mensaje = b"HOLA".to_vec();              // el cliente envía 4 bytes
    let clave = String::from("clave-privada-del-servidor");

    match responder_bien(&mensaje, 64) {
        Some(r) => println!("{}", String::from_utf8_lossy(&r)),
        None => println!("latido mal formado: se descarta"),
    }
    let r = responder(&mensaje, 64);             // pero dice que ha enviado 64
    println!("{} {}", String::from_utf8_lossy(&r), clave.len());
}
