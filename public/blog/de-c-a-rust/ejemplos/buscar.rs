struct Alumno { nombre: &'static str, nota: u8 }

/// Devuelve el alumno con ese nombre, si está.
fn buscar<'a>(clase: &'a [Alumno], nombre: &str) -> Option<&'a Alumno> {
    clase.iter().find(|a| a.nombre == nombre)
}

fn main() {
    let clase = [Alumno { nombre: "Ana", nota: 9 },
                 Alumno { nombre: "Luis", nota: 6 },
                 Alumno { nombre: "Sara", nota: 8 }];

    // println!("Marta: {}", buscar(&clase, "Marta").nota);   // descomentada: error[E0609]

    for nombre in ["Sara", "Marta"] {
        match buscar(&clase, nombre) {
            Some(alumno) => println!("{nombre}: {}", alumno.nota),
            None => println!("{nombre}: no está en la clase"),
        }
    }
    println!("{} bytes, {} bytes", size_of::<&Alumno>(), size_of::<Option<&Alumno>>());
}
