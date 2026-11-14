# El modelo del curso `llm-agents` — `train-minigpt.py`

**Tag:** `COURSE-C2-P0-03`, `COURSE-C2-P3-02` · Produce `public/courses/llm-agents/{bpe-merges,minigpt}.json` a partir de
`corpus.txt`, `bpe.py` y `minigpt.py` del mismo directorio, y con `--idioma en` sus hermanos ingleses
`{bpe-merges,minigpt}.en.json` a partir de `corpus.en.txt`, `bpe.en.py` y `minigpt.en.py` (sección
[«La versión inglesa»](#la-versión-inglesa---idioma-en)). **No corre en CI**: lo ejecuta el autor y
los ficheros que escribe se commitean; `src/lib/courses/__tests__/llm-agents-assets.test.ts` es lo
que CI comprueba.

## Camino tomado

El del plan: un Transformer solo-decoder sobre **BPE a nivel de byte** (|V| = 512), no el modelo de
caracteres de reserva. Las cuatro propiedades que el script aserta se cumplen a este tamaño dentro
del techo de 1,5 MB, con margen (sección «Los números»). Las lecciones 1·3–1·6 se escriben contra
este modelo.

| | |
|---|---|
| Vocabulario | 256 bytes + 256 fusiones = **512** |
| $T_{\text{ctx}}$ | 64 |
| $d_{\text{model}}$ · cabezas · $d_{\text{ff}}$ · capas | 64 · 4 · 256 · 2 |
| Parámetros | **136 448** (embeddings de entrada y salida atados; posiciones aprendidas) |
| Decisiones | pre-LN, ReLU en el FFN (como el primer curso), sin sesgos en las proyecciones de la atención, sin dropout |
| Checkpoint | **1 011 670 bytes (0,96 MB)** como JSON redondeado a 4 decimales |

## Cómo se ejecuta

Un entorno virtual **fuera del repositorio** (no hay `.venv` en el `.gitignore`), con NumPy fijado
a la versión que trae Pyodide 0.29.3 (`src/lib/courses/pyodide/protocol.ts`), para que los
números de aquí y los del navegador salgan de la misma NumPy:

```bash
python3 -m venv ~/.venvs/minigpt && ~/.venvs/minigpt/bin/pip install numpy==2.2.5
```

```bash
~/.venvs/minigpt/bin/python scripts/courses/llm-agents/train-minigpt.py
```

Opciones: `--idioma {es,en}` (por defecto `es`; ver «La versión inglesa»), `--corpus RUTA` (por
defecto `corpus.txt` o `corpus.en.txt` según el idioma), `--salida DIR`
(por defecto `public/courses/llm-agents/`), `--pasos N` (solo para experimentar; el checkpoint que
se publica es el de 2000).

**Tarda unos 11 minutos** (Python 3.12, NumPy 2.2.5 con OpenBLAS a **una hebra**, un portátil
x86-64 de 2020): 10 s de BPE, ~10 min de entrenamiento (2000 pasos de 32 × 64 tokens, ~250 ms
cada uno) y ~20 s de propiedades. La hebra única no es una optimización: es lo que hace que el
orden de las sumas no dependa de la máquina, y está fijada dentro del script antes de importar
NumPy.

**Reproducibilidad.** Semilla 0 en todo lo que echa a suertes (la inicialización, las ventanas,
el muestreo), float64 durante el entrenamiento, y los asertos corren sobre los pesos ya
redondeados. Ejecutado dos veces en la misma máquina, `sha256sum` de los dos ficheros idéntico:

```
bpe-merges.json  9086cb46c8560591…   (2 465 bytes)
minigpt.json     946ed0d49a97481a…   (1 011 670 bytes)
```

Entre máquinas con otra BLAS (otro núcleo de `dgemm`, otro orden de acumulación) las diferencias
de última cifra de float64 pueden amplificarse a lo largo de 2000 pasos de Adam y cambiar algún
cuarto decimal. Si en otra máquina el hash no coincide, es eso, no un fallo del script: lo que
tiene que coincidir son **las propiedades y los números de abajo**, y el checkpoint que se publica
es el que este README documenta.

## Lo que hace, paso a paso

1. **Corpus.** `corpus.txt` es *Marianela* (Galdós, 1878; dominio público), de Project Gutenberg
   [#17340](https://www.gutenberg.org/ebooks/17340), sin sus cabeceras ni su licencia, sin las
   marcas `_cursiva_`, con los párrafos desplegados en una línea y `--` convertido en raya. La
   primera línea del fichero dice esto mismo y `bpe.quitar_cabecera` la quita. 292 075 caracteres,
   302 566 bytes, 1 242 párrafos.
2. **BPE.** `bpe.entrenar(texto, 256)` sobre el corpus entero: 256 fusiones → vocabulario 512,
   139 765 tokens, **2,16 bytes por token**. Las primeras fusiones: ` d`, ` e`, ` l`, `os`, ` de`.
3. **Ventanas.** El último 10 % del corpus (13 976 tokens) es validación y no se entrena nunca:
   es la cola que las celdas usan para «seguir entrenando» sobre texto no visto.
4. **Entrenamiento.** Adam, $\eta_{\max} = 3\cdot10^{-3}$ con 200 pasos de calentamiento lineal y
   coseno hasta $\eta_{\max}/10$, recorte del gradiente a norma 1, 2000 pasos. Cada 250 se evalúa
   la validación y se guarda el mejor; el mejor cae en el **paso 1750** (perdida 3,204), y ese es
   el checkpoint. La pérdida arranca en $\ln 512 = 6{,}24$.
5. **Redondeo.** 4 decimales y a JSON. Todo lo que sigue corre sobre el modelo *recargado* de ese
   JSON, que es lo que las celdas cargarán.
6. **Propiedades.** Asertos; el script falla y no escribe nada si una no se cumple.
7. **Salida.** Los dos JSON, con su `sha256`.

## Los números

Los que el script imprime y las lecciones citan. Donde Pyodide difiera de CPython pasado el cuarto
decimal, se cita Pyodide (regla del primer curso); en las medidas de abajo **no difieren**: la
salida voraz, la de top-p con semilla 0 y las pérdidas de la celda de entrenamiento continuado
salieron idénticas en los dos.

| Propiedad | Umbral | Medido |
|---|---|---|
| 1. Perplejidad en validación (pesos redondeados) | < 30 | **24,62** (3,204 nats/token) |
| 2. La decodificación voraz repite un 4-grama en 32 tokens | ≥ 1 de 3 prompts | **3 de 3** |
| 3. Top-p 0,9, temperatura 1, semilla 0, no repite | 0 de 3 | **0 de 3** |
| 4. SFT de 200 pasos cambia continuación por respuesta | ver abajo | **sí** |
| 5. Una ida sobre 64 tokens en Pyodide | < 1 s | **18–20 ms** (portátil); teléfono: no medido, ver abajo |

Los tres prompts fijos y lo que sale (prompt excluido):

```
'La Nela'
   voraz  -> ' no debía decirle.\n\n—No, no, no, no, no, no, no, no, no, no,'
   top-p  -> ' no trafá como me dijo lo le jo. Dechase quedar más estrelas entre las pers'
'—¿Qué'
   voraz  -> ' haces?\n\n—No, señor, señor; pero no temal, no, no, no, no, no, no, no,'
   top-p  -> ' ha dena incapato? ¡Que sigan de Dios!, equéñ que no había hecho una mano'
'El sol se'
   voraz  -> ' apareció a la Nela, y apoyando su cabeza de la Nela, y decía, y apr'
   top-p  -> ' dio:\n\n—¿Qué haces en ricas?... ¿Porque sabes por el abierto adió'
```

**Propiedad 4, lo que mide y lo que no.** El SFT son 200 pasos de Adam ($\eta = 10^{-3}$, lote
entero) sobre los diez pares `Pregunta: ¿De qué color es X?\nRespuesta: X es Y.` del script, con la
pérdida **solo en los tokens de la respuesta** (`perdida(X, Y, peso)`). La pérdida baja de 3,76 a
0,004 en 50 pasos y a 0,001 en 200 — el modelo se los aprende de memoria. Sobre el prompt
reservado (`la tierra`, que no está en los diez), la continuación voraz pasa de

```
antes   -> '\n\n—No ves acarde todas'          (sigue el texto: Galdós)
después -> ' La leche es blanca.\n'             (responde: la plantilla, con una respuesta memorizada)
```

Lo que se aserta es (a) que los tokens iniciales de la respuesta reservada `' La tierra es'` que
coinciden pasan de 0 a ≥ 2 — el espacio y el artículo que concuerda, `La` — y (b) que la
continuación es una frase completa `El/La <algo> es <algo>.` y antes no lo era. Lo que **no** se
aserta, porque no ocurre, es que copie el sustantivo de la pregunta: diez ejemplos en 200 pasos
enseñan el *formato*, no el color ni la copia, y el modelo responde con una de las diez respuestas
que memorizó. Eso es la lección 2·3, no un defecto que arreglar. En el navegador 200 pasos de este
SFT no caben (10 pares × 40 tokens por paso); a $\eta = 3\cdot10^{-3}$ la pérdida ya es 0,001 en 50
pasos, que es el presupuesto que la lección tiene.

## Medido en el navegador (propiedad 5 y los criterios de aceptación)

Fixture `content/courses/llm-agents/es/00-pipeline-fixture.mdx` (`draft: true`; se publica en
local para ejecutarlo y se devuelve a borrador). Pyodide 0.29.3, Chromium del panel de la app,
portátil x86-64 de 2020, **con un entrenamiento del script corriendo a la vez en otro núcleo**, así
que los tiempos son conservadores. La NumPy de Pyodide **no trae BLAS**: `(64,64)@(64,192)` tarda
1,25 ms (~1 GFLOP/s), float32 no ayuda (1,05 ms), y el coste de un paso de entrenamiento es lineal
en los tokens: **~0,85 ms por token** de ida más vuelta.

**Celda 1** — `open_url` de `bpe.py`, `minigpt.py`, `bpe-merges.json`, `minigpt.json`; carga; 32
tokens voraz; 32 tokens top-p 0,9; diez idas sobre 64 tokens:

| | caché fría | caché caliente |
|---|---|---|
| cargar (3 ficheros + JSON + `np.array`) | 1,54 s | 0,24 s |
| 32 tokens voraz | 0,48 s | 0,27 s |
| 32 tokens top-p 0,9 | 0,39 s | 0,30 s |
| una ida sobre 64 tokens | 20 ms | 18 ms |
| **total de la celda** | **≈ 2,6 s** | ≈ 1,0 s |

**Celda 2** — codifica la cola del corpus (6 000 caracteres → 2 994 tokens: 0,09 s) y hace 200
pasos de Adam ($\eta = 5\cdot10^{-4}$, 50 de calentamiento) sobre **una ventana de 16 tokens por
paso**, midiendo cada 50 la pérdida sobre ocho ventanas fijas:

```
paso   0   perdida 3.476
paso  50   perdida 3.457
paso 100   perdida 3.243
paso 150   perdida 2.941
paso 200   perdida 2.904
200 pasos en 4.6 s
```

Por qué 16 tokens y no 64: con 2 × 32 tokens por paso la celda **superó los 10 s** hacia el paso
170 (~55 ms por paso). Y por qué calentamiento: Adam arranca con los momentos a cero, y sin él los
primeros pasos a $10^{-3}$ suben la pérdida (3,41 → 3,89) antes de bajarla.

**Teléfono: no medido.** No hay un teléfono en el entorno donde se hizo esta tarea. Con la regla
habitual de 2–3× respecto a un portátil, la celda 1 queda en 5–8 s con caché fría (dentro del
tope) y la celda 2 en **9–14 s, al borde o fuera**. Hasta que se mida en uno, una lección que
siga entrenando en el navegador debe presupuestar **100 pasos de 16 tokens** (≈ 2,3 s en
portátil) o vigilar el reloj dentro del bucle, y una que solo cargue y genere tiene margen.

## Ficheros

| Fichero | Qué es |
|---|---|
| `public/courses/llm-agents/minigpt.py` | El modelo: `MiniGPT` (ida, `perdida` con vuelta y máscara opcional, `generar` voraz/temperatura/top-k/top-p, `guardar`/`cargar`), `softmax`, `layer_norm`, `ventanas`, `muestrear`, `Adam`. Lo importa este script y lo `exec`utan las celdas |
| `public/courses/llm-agents/bpe.py` | BPE a nivel de byte: `entrenar`, `codificar`, `decodificar`, `vocabulario`, `quitar_cabecera` |
| `public/courses/llm-agents/corpus.txt` | *Marianela*, con la línea de cabecera |
| `public/courses/llm-agents/bpe-merges.json` | Las 256 fusiones, en orden: `[[a, b], …]`; la fusión $i$ crea el token $256 + i$ |
| `public/courses/llm-agents/minigpt.json` | `{"config": {…}, "pesos": {nombre: lista anidada}}`, 4 decimales |

Los hermanos ingleses (`*.en.*`, COURSE-C2-P3-02) están en la sección siguiente. Lo que sigue
dependiendo del corpus español, la prosa de las lecciones inglesas y los presets y figuras hechos con
el checkpoint español, está registrado en `SPANISH_BOUND_CORPORA`
(`src/features/courses/widgets/corpora.ts`).

## La versión inglesa (`--idioma en`)

**Tag:** `COURSE-C2-P3-02`. La MISMA receta con otro corpus: semilla, hiperparámetros, BLAS a una
hebra y NumPy 2.2.5 iguales. Cambian solo el corpus, los dos módulos que el script importa y los datos
de las propiedades 2–4 (`IDIOMAS` en el script). Todo fichero español queda byte a byte igual.

```bash
~/.venvs/minigpt/bin/python scripts/courses/llm-agents/train-minigpt.py --idioma en
~/.venvs/minigpt/bin/python scripts/courses/llm-agents/parity-en.py
```

**Sin Python 3.12 en la máquina** (esta tiene solo 3.14, para el que NumPy 2.2.5 no publica rueda),
el mismo entorno en Docker, con el repositorio de solo lectura y la salida a otro directorio:

```bash
docker run --rm --user $(id -u):$(id -g) -v $PWD:/repo:ro -v /tmp/mg:/s python:3.12-slim sh -c "python -m venv /s/venv && /s/venv/bin/pip install -q numpy==2.2.5 && PYTHONDONTWRITEBYTECODE=1 /s/venv/bin/python /repo/scripts/courses/llm-agents/train-minigpt.py --idioma en --salida /s"
```

Con ese entorno, `--idioma es` **reproduce los ficheros españoles publicados byte a byte**
(`9086cb46…`, `946ed0d4…`): el script parametrizado no cambia la ejecución española.

### Los módulos ingleses y `parity-en.py`

`bpe.en.py` y `minigpt.en.py` son `bpe.py` y `minigpt.py` con solo los nombres, los comentarios y los
docstrings traducidos, contra el mapa de identificadores de
`docs/courses/llm-agents/AUTHORING.en.md` §1 (`codificar` → `encode`, `Adam.paso` → `Adam.step`,
`n_capas` → `n_layers`, `pesos` → `weights`…). Comparados token a token sin comentarios ni docstrings,
cada par es el otro con un renombrado biyectivo, y las líneas de código coinciden una a una.

El script importa los módulos ingleses a través de `vista_inglesa()`, que solo les pone los nombres
españoles que el script usa: cada nombre delega en el inglés y la aritmética es la del fichero
inglés. **El JSON cambia de claves**: `minigpt.en.json` es `{"config": {…, "n_layers": 2},
"weights": {…}}`, y una celda que lea `cfg["n_capas"]` sobre él falla.

`parity-en.py` ejecuta cada par sobre las mismas entradas y exige salidas **iguales**, no parecidas:
`entrenar`/`train` (64 fusiones), `codificar`/`encode` y vuelta sobre cada corpus entero con su tabla,
`vocabulario`, la inicialización con semilla 0, `ventanas`, la ida, la pérdida y su gradiente con y sin
máscara, tres pasos de Adam, `muestrear` voraz/top-k/top-p y `generar` voraz y con semilla. Y carga
**el checkpoint español** con `minigpt.en.py` (claves renombradas): los mismos logits, y `save(4)` da
el mismo JSON con las claves inglesas. El modelo inglés es el mismo modelo; una diferencia entre los
números de los dos cursos es el corpus, nunca el código. Pasa entero (16 comprobaciones).

### El corpus: *Cousin Phillis*, y por qué

`corpus.en.txt` es *Cousin Phillis* (Elizabeth Gaskell, 1863–64; dominio público), de Project
Gutenberg [#4268](https://www.gutenberg.org/ebooks/4268), preparado como `corpus.txt`: sin cabeceras
ni licencia, sin las notas `[Illustration]`, párrafos desplegados en una línea, sin los números de
las cuatro partes. No tiene marcas `_cursiva_`. La primera línea dice esto y `strip_header` la quita.
213 640 caracteres, 217 774 bytes, 511 párrafos; *Phillis* aparece 208 veces; inglés británico
(`colour` 21 veces, `color` ninguna).

Se midieron los tres candidatos de la tarea **con la receta fija**, cada uno con sus tres prompts
decididos antes de entrenar (el nombre de la protagonista, `“What`, `The sun was`). El que se publica
es **el único que cumple las cuatro propiedades**:

| Candidato | Caracteres | vs *Marianela* | Perplejidad (< 30) | P2: la voraz repite | |
|---|---|---|---|---|---|
| *Under the Greenwood Tree* (Hardy, #2662) | 318 778 | +9 % | 21,21 | **0 de 3** | falla P2 |
| *Silas Marner* (Eliot, #550) | 391 287 | +34 % | 19,00 | **0 de 3** | falla P2 |
| ***Cousin Phillis*** (Gaskell, #4268) | 213 640 | −27 % | **28,64** | **3 de 3** | cumple 1–4 |

*Under the Greenwood Tree* era el mejor sobre el papel (tamaño, y *Dick* 359 veces frente a las 341
de *Nela*), pero ninguno de sus tres prompts entra en bucle voraz en 32 tokens, y tampoco los de
*Silas Marner*: los dos modelos ingleses mejores (perplejidad 21 y 19) no repiten, y la propiedad 2
es lo que 1·4 enseña. No se tocaron `PASOS`, la semilla ni los prompts para hacerlos pasar.

**Lo que cuesta *Cousin Phillis*, y que las lecciones inglesas tienen que contar como suyo:**

- **Es un 27 % más corto.** 85 886 tokens de entrenamiento frente a 125 789: con 2000 pasos de
  32 × 64 tokens el modelo ve cada token **47,7 veces**, no 32,6. El quiz de 1·3 cambia de valor.
- **Sobreajusta a partir del paso 1000.** La validación baja hasta el paso 1000 (3,355) y luego
  sube (3,471 en el 2000) mientras el entrenamiento sigue bajando; el checkpoint es el del **paso
  1000**, no el del 1750. La curva de 1·3 (`minigpt-entrenamiento.en.svg`) mostrará el sobreajuste,
  que la española no tiene.
- **Margen corto en la propiedad 1**: 28,64 frente al techo de 30 (el español: 24,62).

### Los números

Ejecutado en la máquina de esta tarea, **no la del README español**: Intel Core i5-6300U (2 núcleos,
4 hebras, portátil de 2016), Python 3.12.16 y NumPy 2.2.5 en Docker, una hebra de BLAS.
**676 s (11,3 min)** sola; la española, reproducida aquí en paralelo con otra ejecución, tardó
1038 s. Ejecutada dos veces (una dentro de la medición de candidatos), `sha256` idéntico:

```
bpe-merges.en.json  76b9a122567adb47…   (2 488 bytes)
minigpt.en.json     74467db1d74e312c…   (1 011 153 bytes, 0,96 MB)
```

| | Español | Inglés |
|---|---|---|
| Corpus (caracteres · bytes) | 292 075 · 302 566 | 213 640 · 217 774 |
| Tokens (bytes por token) | 139 765 (2,16) | 95 428 (**2,28**) |
| Entrenamiento · validación | 125 789 · 13 976 | **85 886 · 9 542** |
| Pasadas por token (2000 × 32 × 64) | 32,6 | **47,7** |
| Mejor validación | paso 1750, 3,204 | **paso 1000, 3,355** |
| Validación en el paso 2000 | 3,206 | 3,471 |
| 1. Perplejidad (pesos redondeados) | 24,62 | **28,64** |
| 2. La voraz repite (≥ 1 de 3) | 3 de 3 | **3 de 3** |
| 3. Top-p 0,9 semilla 0 repite (0 de 3) | 0 de 3 | **0 de 3** |
| 4. SFT: pérdida en el paso 50 · 200 | 0,004 · 0,001 | 0,006 · 0,001 |
| Una ida sobre 64 tokens, CPython | 3,8 ms (en paralelo con otra ejecución) | 2,7 ms |

Las primeras fusiones: ` t`, `he`, ` a`, `in`, ` w`, ` s`, ` o`, ` the`, **`E2 80`**, ` m`. El inglés
es casi todo de un byte, pero no del todo: los 2 067 caracteres no ASCII del corpus son **tipografía**
(`“` 594, `’` 591, `”` 572, `—` 287, `‘` 23), y la fusión 8 (desde cero: la novena) es `E2 80`, el
prefijo común de los tres bytes de todas ellas: **un token que no es un carácter**. Las fusiones 51, 52 y 54 completan
`“`, `’` y `”`. El argumento de 1·2 sobre las letras de varios bytes conserva su prueba en el corpus,
pero en la puntuación, no en las letras.

Los tres prompts (prompt excluido):

```
'Phillis'
   voraz  -> ', and I had to between the farmy round of the first, and I went to the first'
   top-p  -> '; and then she looked at meant on keeps with me; and trited her to least to husb'
'“What'
   voraz  -> '’s always always a breakfast cousin Holman’s always a blue'
   top-p  -> ' have can, if they had any one for very irreas to the labourers them why had so m'
'The sun was'
   voraz  -> ' alone, and then I had told meant to before. I had to better to before I had to better'
   top-p  -> ' thold iron to earth cact, as I see her monntly and prittence of her he'
```

**Propiedad 4, re-enunciada.** El SFT son los diez pares `Question: What colour is X?\nAnswer: The X
is Y.` (los del widget `chat-template` en inglés), 200 pasos con la pérdida solo en la respuesta. El
reservado es `the earth`, cuyo sustantivo no está en los diez. El inglés no tiene concordancia: ` The`
vale para los once pares, así que el artículo no es nada que el SFT enseñe y el mínimo español de 2
tokens («el espacio y el artículo que concuerda») no tiene equivalente. Se aserta (a) que la
coincidencia de tokens iniciales con ` The earth is` (5 tokens) **crece estrictamente** y (b) que la
plantilla `^ The [a-z]+ is [a-z]+\.` aparece después y no antes:

```
antes    0/5 tokens, plantilla no  -> ' I went to the fresh of their'     (sigue el texto: Gaskell)
después  1/5 tokens, plantilla sí  -> ' The milk is white.\n\n'           (responde: la plantilla, una respuesta memorizada)
```

El checkpoint base **no** empieza ya por ` The` (0 de 5): la propiedad mide algo que el SFT cambia.
Igual que en español, el modelo no copia el sustantivo: responde con una de las diez respuestas que
memorizó, y es la misma respuesta (`milk`) que dio el español (`leche`).

### Medido en el navegador (propiedad 5)

Una celda desechable (no commiteada) en el fixture `00-pipeline-fixture.mdx` publicado en local:
`open_url` de `bpe.en.py`, `minigpt.en.py`, `bpe-merges.en.json`, `minigpt.en.json`; carga; 32 tokens
voraz y 32 top-p 0,9 sobre `Phillis`; diez idas sobre 64 tokens. Pyodide 0.29.3, Chromium del panel
de la app, la misma máquina, sin nada más corriendo:

| | primera ejecución (ficheros ingleses sin caché) | caché caliente |
|---|---|---|
| cargar (2 módulos + 2 JSON) | 0,36 s | 0,19 s |
| 32 tokens voraz | 0,25 s | 0,16 s |
| 32 tokens top-p 0,9 | 0,32 s | 0,18 s |
| una ida sobre 64 tokens | 19 ms | 16 ms |
| **total de la celda** | **1,13 s** | 0,70 s |

Pyodide e intérprete ya estaban en la caché del navegador, así que la columna fría no incluye su
descarga (la española de 2,6 s se midió con un entrenamiento corriendo al lado). **La salida voraz y la
de top-p son idénticas a las de CPython**, carácter a carácter: las lecciones pueden citar las de
arriba. **Teléfono: no medido** (no hay uno en el entorno, como en P0-03); con la regla de 2–3×, la
celda queda en 2–4 s, dentro del tope de 10 s.

### Ficheros ingleses

| Fichero | Qué es |
|---|---|
| `public/courses/llm-agents/corpus.en.txt` | *Cousin Phillis*, con la línea de cabecera |
| `public/courses/llm-agents/bpe.en.py`, `minigpt.en.py` | Los módulos, traducidos 1:1 (`encode`, `MiniGPT.forward`, `loss`, `generate`, `save`/`load`, `Adam.step`…) |
| `public/courses/llm-agents/bpe-merges.en.json` | Las 256 fusiones inglesas |
| `public/courses/llm-agents/minigpt.en.json` | `{"config": {…, "n_layers": 2}, "weights": {…}}`, 4 decimales |
| `scripts/courses/llm-agents/parity-en.py` | La paridad de los dos pares de módulos; la ejecuta el autor, no CI |
