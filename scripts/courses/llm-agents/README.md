# El modelo del curso `llm-agents` — `train-minigpt.py`

**Tag:** `COURSE-C2-P0-03` · Produce `public/courses/llm-agents/{bpe-merges,minigpt}.json` a partir de
`corpus.txt`, `bpe.py` y `minigpt.py` del mismo directorio. **No corre en CI**: lo ejecuta el autor y
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

Opciones: `--corpus RUTA` (otro corpus: la versión inglesa necesitará el suyo), `--salida DIR`
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

La versión inglesa del curso necesitará **su corpus y su checkpoint** (`--corpus`, `--salida`) y
prosa nueva en las lecciones que citan estas muestras: está registrado en `SPANISH_BOUND_CORPORA`
(`src/features/courses/widgets/corpora.ts`).
