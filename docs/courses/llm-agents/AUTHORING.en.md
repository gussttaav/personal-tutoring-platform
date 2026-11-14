# AUTHORING.en.md — `llm-agents` in English

**Tag:** `COURSE-C2-P3-03` · Delta on [`AUTHORING.md`](AUTHORING.md) (this course's) and on
[`../AUTHORING.en.md`](../AUTHORING.en.md) (English's) · Notation: [NOTATION.md](NOTATION.md),
unchanged but for the words inside `\text{…}` (§2, last paragraph)

**This is the fourth member of the delta mechanism**, and the only one that is about two things at
once. The shared [`../AUTHORING.md`](../AUTHORING.md) governs every lesson; this course's
[`AUTHORING.md`](AUTHORING.md) replaces what a course of two shapes does differently; the shared
[`../AUTHORING.en.md`](../AUTHORING.en.md) replaces what English does differently. **This file holds
only what is both this course's and English's**: the names its code carries across five blocks, the
English form of its terminology table, and what English changes in the terminal form. Read the
other three first, in that order ([`../README.md`](../README.md#which-file-governs)); this one is
useless on its own.

| Where | What is replaced or added |
|---|---|
| — (added) | **The identifier map** (§1): every public name of the seven frozen modules and of the companion repository, in English, with every collision decided |
| `AUTHORING.md` §4, terminology | **The English glossary** (§2): every row of the Spanish table, distinctions kept, the "Not" column rewritten for English |
| `../AUTHORING.en.md` §6, the glossary | Nothing removed. That table is `dl-nlp`'s; this course's terms are §2 here. Where a term exists in both courses (*greedy*, *step*, *pre-training*), §2 says which reading this course takes |
| `AUTHORING.md` §1, Block 5's terminal form | Four English rules added (§3). Its four bullets and the verification rule are unchanged |

Everything else in the three files applies verbatim; §5 names the parts most likely to be re-decided.

---

## 1. The identifier map

### Why it is fixed up front

The course's terms are its identifiers, in seven frozen modules and the companion repository, and
a name chosen in 1·2 is still being typed in 5·9. So the whole map is decided before the first
English module is written, and **a lesson may add a name to it but may not rename an
entry once a module, a `<PyCell>` asserted against a module, or an `en-b5-l*` tag has frozen it**.
An English module (`<name>.en.py`, `../AUTHORING.en.md` §7) is written from this table alone; a name
its author has to decide on the spot is a gap in this file, fixed here first.

### The rules the tables follow

- **The term of art where English has one, and the protocol's own name where the protocol names
  it.** `tool_use`, `tool_result`, `input_schema`, `stop_reason`, `max_tokens`, `usage`, `content`,
  `role` and the JSON-RPC fields are the Messages format's and MCP's, already English, and do not
  move. Neither do the symbols (`E`, `Wqkv`, `T_ctx`, `d_model`, `M`, `B`, `T`): notation is
  locale-invariant.
- **en-GB for words the course owns** (`normalise`, `initialise`), **source spelling for names it
  does not** (`np.random.normal`, `json.loads`, `shutil.copytree`).
- **Agree with `dl-nlp`'s English.** This course picks up the first course's code by name, and
  `dl-nlp/en/` has already fixed `generate` (en/25), `step` for one step of a sequence (en/20),
  `forward` / `backward` for `adelante` / `atras` (en/25) and `inputs` for `entrada`.
- **Full words, as the Spanish wrote them.** `environment`, not `env` (which reads as
  `os.environ`); `call`, not `ll`.
- **A collision is resolved in the name, not left to the prose.** Each one is decided below the
  tables, with its reason.
- **File names.** A module served from `public/courses/llm-agents/` keeps its Spanish name with the
  `.en` infix (`modelo.en.py`, `entorno.en.py`): the sibling rule of `../AUTHORING.en.md` §7, and a
  URL is not prose. The companion repository's `en` branch is its own tree (D1), so its files take
  English names.

### The frozen modules

**`bpe.py` → `bpe.en.py`** (1·2; Blocks 1–3 and `train-minigpt.py`)

| Spanish | English | Note |
|---|---|---|
| `PATRON` | `PATTERN` | |
| `N_BYTES` | `N_BYTES` | |
| `quitar_cabecera(raw)` | `strip_header(raw)` | |
| `pares(ids)` | `pairs(ids)` | |
| `fusionar(ids, par, nuevo)` | `merge(ids, pair, new)` | |
| `entrenar(texto, m, veces=None)` | `train(text, m, counts=None)` | its local `donde`, which 1·2's prose names, is `where` |
| `codificar(texto, fusiones)` | `encode(text, merges)` | |
| `vocabulario(fusiones)` | `vocabulary(merges)` | |
| `decodificar(ids, fusiones)` | `decode(ids, merges)` | 1·4 and 3·3 argue from this name: see *greedy generation*, §2 |
| `bpe-merges.json`, `corpus.txt` | `bpe-merges.en.json`, `corpus.en.txt` | a list of pairs and a text: no keys to translate |

**`minigpt.py` → `minigpt.en.py`** (P0-03 / Block 1; Blocks 1–3 and `train-minigpt.py`)

| Spanish | English | Note |
|---|---|---|
| `CONFIG`: `n_v`, `T_ctx`, `d_model`, `h`, `d_ff`, `n_capas` | `CONFIG`: the same, and `n_layers` | |
| `softmax(Z)`, `layer_norm(X, g, b, eps)` | unchanged | already English |
| `layer_norm_atras(dY, cache)` | `layer_norm_backward(dY, cache)` | |
| `ventanas(ids, B, T, rng)` | `windows(ids, B, T, rng)` | prose: always *training window* (collision 3) |
| `MiniGPT(cfg=CONFIG, semilla=0)` | `MiniGPT(cfg=CONFIG, seed=0)` | attributes `cfg`, `p` and every weight key (`E`, `P`, `lnf_g`, `0.Wqkv` …) unchanged |
| `.n_parametros()` | `.n_parameters()` | |
| `.atencion(H, l)`, `.ffn(H, l)` | `.attention(H, l)`, `.ffn(H, l)` | |
| `.adelante(X)` | `.forward(X)` | the `cache` it returns is a Python name the prose never borrows |
| `.atencion_atras(…)`, `.ffn_atras(…)` | `.attention_backward(…)`, `.ffn_backward(…)` | |
| `.perdida(X, Y, peso=None)` | `.loss(X, Y, weight=None)` | `weight` is a Python name; the prose term is *loss mask* |
| `.generar(prompt, n, temperatura=1.0, top_k=None, top_p=None, rng=None)` | `.generate(prompt, n, temperature=1.0, top_k=None, top_p=None, rng=None)` | |
| `.guardar(decimales=4)`, `MiniGPT.cargar(texto)` | `.save(decimals=4)`, `MiniGPT.load(text)` | |
| `muestrear(z, temperatura, top_k, top_p, rng)` | `sample(z, temperature, top_k, top_p, rng)` | |
| `Adam(p, eta, beta1, beta2, eps)`, attributes `m`, `v`, `t` | unchanged | |
| `Adam.paso(p, g, eta=None)` | `Adam.step(p, g, eta=None)` | collision 2 |
| checkpoint JSON `config`, `pesos`, `config.n_capas` | `config`, `weights`, `config.n_layers` | in `minigpt.en.json` |

**`modelo.py` → `modelo.en.py`** (1·9; Blocks 2–3)

| Spanish | English | Note |
|---|---|---|
| `modelo(prompt, max_tokens=32, temperatura=1.0, top_p=0.9, parar=None, semilla=None) -> texto` | `model(prompt, max_tokens=32, temperature=1.0, top_p=0.9, stop=None, seed=None) -> text` | the contract's keywords |
| `red` | `net` | 1·9's rename survives: "`model` was the `MiniGPT` object; from here `model` is the function, and the object is called `net`" |
| `hacer_modelo(red, fusiones)` | `make_model(net, merges)` | |
| `llenar(red, ids)` | `fill(net, ids)` | the prefill, as a function; *prefill* stays the noun |
| `avanzar(red, x, cache)` | `advance(net, x, cache)` | never `step` |
| `F`, `T_ctx`, `T_min` | unchanged | |

**`guionizado.py` → `guionizado.en.py`** (3·1; Blocks 3–4)

| Spanish | English | Note |
|---|---|---|
| `ModeloGuionizado(guion)` | `ScriptedModel(script)` | collision 7 |
| `.guion`, `.turno` | `.script`, `.turn` | |
| the signature `modelo(mensajes, herramientas) -> respuesta` | `model(messages, tools) -> response` | held to the end of the course |
| a message `(rol, contenido)` | `(role, content)` | |
| roles `"sistema"`, `"usuario"`, `"asistente"` | `"system"`, `"user"`, `"assistant"` | collision 1, decided before 4·2 freezes them |

**`entorno.py` → `entorno.en.py`** (4·2; Block 4 and the companion repository)

| Spanish | English | Note |
|---|---|---|
| `ENTORNO` | `ENVIRONMENT` | |
| its keys `lista.txt`, `notas.txt`, `recetas/gazpacho.txt`, `recetas/tortilla.txt` | `shopping.txt`, `notes.txt`, `recipes/gazpacho.txt`, `recipes/tortilla.txt` | not `list.txt`: `list` is a tool. The contents are 4·2's to write |
| tools `leer`, `escribir`, `listar`, `buscar` | `read`, `write`, `list`, `search` | |
| fields `ruta`, `contenido`, `carpeta`, `patron` | `path`, `content`, `folder`, `pattern` | |
| `FUNCIONES`, `HERRAMIENTAS` | `FUNCTIONS`, `TOOLS` | |
| `objeto(**campos)` | `object_schema(**fields)` | never `object`, Python's builtin |
| `texto(t)`, `llamada(id, nombre, **argumentos)`, `resultado(id, contenido)` | `text(t)`, `tool_use(id, name, **arguments)`, `tool_result(id, content)` | the builders take the block's protocol name (collision 4) |
| `muestra(b)` | `show(b)` | never `sample`, the sampler's |
| `TIPOS` | `TYPES` | |
| `incumple(b)` | `violation(b)` | returns why, or `None` |
| `guion_de(inicio, respuestas, vistos)` | `script_for(start, responses, seen)` | |

**`harness.py` → `harness.en.py`** (4·4; Block 4)

| Spanish | English | Note |
|---|---|---|
| `leer(entorno, ruta)` | `read(environment, path)` | the contract version, raising `FileNotFoundError` |
| `error(id, contenido)` | `error(id, content)` | |
| `ejecutar(ll, entorno)` | `execute(call, environment)` | collision 5 |
| `bucle(modelo, inicio, entorno, tope)` | `loop(model, start, environment, limit)` | |
| its result `("fin" \| "tope", texto, M)` | `("end" \| "limit", text, M)` | the loop's own reasons, not a `stop_reason` |

**`permisos.py` → `permisos.en.py`** (4·5; Block 4's project and the companion repository)

| Spanish | English | Note |
|---|---|---|
| `CLASES` | `CLASSES` | |
| classes `"lectura"`, `"escritura"`, `"ejecución"` | `"reading"`, `"writing"`, `"execution"` | collision 8 |
| `PERMISOS` | `PERMISSIONS` | |
| decisions `"permitir"`, `"preguntar"`, `"denegar"` | `"allow"`, `"ask"`, `"deny"` | |
| `permiso(ll, permisos=PERMISOS)` | `permission(call, permissions=PERMISSIONS)` | |
| `preguntar(ll)` | `ask(call)` | the scripted user; shares its word with the decision, as in Spanish |
| `ejecutar(ll, entorno)` | `execute(call, environment)` | |

### Names that cross lessons without a module

| Where | Spanish | English |
|---|---|---|
| `dl-nlp` 5.9, quoted by 1·9 | `genera(paso, go, eos, max_pasos)`, `paso(entrada)` | `generate(step, go, eos, max_steps)`, `step(inputs)` (collision 2) |
| 2·2 on | `<\|sistema\|>`, `<\|usuario\|>`, `<\|asistente\|>`, `<\|fin\|>`; `mascara(ids)` | `<\|system\|>`, `<\|user\|>`, `<\|assistant\|>`, `<\|end\|>`; `mask(ids)` |
| 2·1 | the frame `Pregunta: … Respuesta:` | `Question: … Answer:` (a string the lesson writes, not the term *response*) |
| 3·1 | `cumple(y)` | `meets(y)` |
| 3·3, 3·7 | JSON keys `personaje`, `fecha`, `respuesta`, `pasaje`; the abstention `no lo sé` | `character`, `date`, `response`, `passage`; `I don't know` |
| 3·5 | `encajar(T_ctx, reserva) -> mensajes` | `fit(T_ctx, reserve) -> messages` |
| 3·6, 3·7, 5·8 | `wilson(k, n)` | unchanged |
| 3·7 | `asistente(modelo, pregunta, k=3, tope=2) -> (respuesta, citado)` | `assistant(model, question, k=3, limit=2) -> (response, cited)` |
| 4·1 | `{"pide": …, "ruta": …}`, `receta.txt` | `{"asks": …, "path": …}`, `recipe.txt` |
| 4·4 | the hypothetical tool `añadir` | `append` |
| 4·5 | `recetas/salmorejo.txt`; the wrapper `Observación:` | `recipes/salmorejo.txt`; `Observation:` |
| 4·7 | `agente(modelo, pedido, entorno, tope=10) -> (motivo, texto, M)` | `agent(model, request, environment, limit=10) -> (reason, text, M)` |

### The strings more than one module prints

Block 4's tests compare observations character for character, and three modules print them, so they
are fixed here, not in each lesson. Block 5's own strings (`edit`'s refusal, the timeout message,
`main.py`'s trace) are written by the lesson that writes the code and quoted from the English run.

| Spanish | English |
|---|---|
| «no se ha ejecutado: » (the prefix) | `not executed: ` |
| «permiso denegado» · «el usuario no lo ha permitido» | `permission denied` · `the user did not allow it` |
| «no existe el fichero %r» | `no such file %r` |
| «no hay ninguna herramienta %r» · «input no es un objeto» · «falta el campo %r» · «sobra el campo %r» · «el campo %r no es de tipo %s» | `there is no tool %r` · `input is not an object` · `missing field %r` · `unexpected field %r` · `field %r is not of type %s` |
| «el guion se acabó en el turno %d» · «turno %d: el mensaje %d no es el del guion» | `the script ran out at turn %d` · `turn %d: message %d is not the script's` |
| «%s está fuera de la carpeta de trabajo» (Block 5) | `%s is outside the working directory` |

### The companion repository: `agente-minimo`, branch `en`

Every file in the `b5-l9` tag, and its name on `en`. A project folder under `bench/`, `example/`,
`cookbook/` or `foreign/` is re-authored in English by its lesson (5·3, 5·5, 5·6, 5·8); if the English
content changes what a file is about, the lesson renames it **here first**, before its `en-b5-l*` tag.

| Spanish (`main`, `b5-l9`) | English (`en`) |
|---|---|
| `.gitignore`, `LICENSE`, `Modelfile`, `README.md` | unchanged (the `Modelfile`'s comment line is 5·1's decision) |
| `protocolo.py` · `api.py` · `agente.py` · `bucle.py` · `correr.py` | `protocol.py` · `api.py` · `agent.py` · `loop.py` · `main.py` |
| `entorno.py` · `guionizado.py` · `permisos.py` · `coste.py` · `compactar.py` | `environment.py` · `scripted.py` · `permissions.py` · `cost.py` · `compact.py` |
| `subagente.py` · `medir.py` | `subagent.py` · `measure.py` |
| `cliente_mcp.py` · `servidor_incidencias.py` · `mcp_a_mano.py` · `incidencias.json` | `mcp_client.py` · `issue_server.py` · `mcp_by_hand.py` · `issues.json` |
| `herramientas/`: `__init__.py`, `comun.py`, `leer.py`, `buscar.py`, `editar.py`, `escribir.py`, `ejecutar.py`, `delegar.py` | `tools/`: `__init__.py`, `common.py`, `read.py`, `search.py`, `edit.py`, `write.py`, `run.py`, `delegate.py` |
| `tests/`: `__init__.py`, `test_agente`, `test_api`, `test_banco`, `test_compactar`, `test_herramientas`, `test_inicio`, `test_mcp`, `test_permisos`, `test_subagente` | `tests/`: `__init__.py`, `test_agent`, `test_api`, `test_bench`, `test_compact`, `test_tools`, `test_start`, `test_mcp`, `test_permissions`, `test_subagent` (all `.py`) |
| `ejemplo/`: `AGENTE.md`, `compra.py`, `test_compra.py` | `example/`: `AGENT.md`, `shopping.py`, `test_shopping.py` |
| `recetario/`: `AGENTE.md`, `recetario.py`, `compra.py`, `recetas.txt`, `test_recetario.py`, `test_compra.py` | `cookbook/`: `AGENT.md`, `cookbook.py`, `shopping.py`, `recipes.txt`, `test_cookbook.py`, `test_shopping.py` |
| `ajeno/`: `AGENTE.md`, `precios.py`, `test_precios.py` | `foreign/`: `AGENT.md`, `prices.py`, `test_prices.py` |
| `banco/<task>/`: `pedido.txt`, `evaluador.py`, `repo/`, `repo/AGENTE.md`, `solucion/` | `bench/<task>/`: `request.txt`, `grader.py`, `repo/`, `repo/AGENT.md`, `solution/` |
| `1-tiempos/`: `tiempos.py`, `test_tiempos.py` | `1-times/`: `times.py`, `test_times.py` |
| `2-despensa/`: `despensa.py`, `fechas.py`, `avisos.py`, `test_despensa.py`, `test_avisos.py` | `2-pantry/`: `pantry.py`, `dates.py`, `notices.py`, `test_pantry.py`, `test_notices.py` |
| `3-renombrar/`: `cuentas.py`, `ticket.py`, `test_cuentas.py`; `suma_precios` → `importe` | `3-rename/`: `bills.py`, `receipt.py`, `test_bills.py`; `sum_prices` → `amount` |
| `4-anadir/`: `unidades.py`, `test_unidades.py`; `a_kilos(gramos)` | `4-add/`: `units.py`, `test_units.py`; `to_kilos(grams)` |
| `5-proyecto/`: `ofertas.py`, `test_ofertas.py`; `descuento(precio, por_ciento)` | `5-project/`: `offers.py`, `test_offers.py`; `discount(price, percent)` |

The repository's public names, beyond those it inherits from Block 4's modules above:

| File (English) | Spanish → English |
|---|---|
| `protocol.py`, `api.py` | `URL` · `CLAVE` → `KEY` · `ROLES` → **none** (collision 1) · `peticion(nombre, max_tokens, mensajes, herramientas)` → `payload(name, max_tokens, messages, tools)` · `enviar(p)` → `send(payload)` · `ModeloAPI(nombre="local", max_tokens=1024)` → `APIModel(name="local", max_tokens=1024)`, attributes `name`, `max_tokens`, `usage` |
| `agent.py` | `SISTEMA` → `SYSTEM` · `PROYECTO = "AGENTE.md"` → `PROJECT = "AGENT.md"` · `inicio(pedido, entorno=None, sistema=SISTEMA)` → `start(request, environment=None, system=SYSTEM)` · `agente(modelo, pedido, entorno, tope=10, usuario=None, compactar=None, delegar=None, servidor=None)` → `agent(model, request, environment, limit=10, user=None, compact=None, delegate=None, server=None)` |
| `loop.py` | `bucle(…, usuario=None, compactar=None, herramientas=HERRAMIENTAS, funciones=FUNCIONES)` → `loop(…, user=None, compact=None, tools=TOOLS, functions=FUNCTIONS)` |
| `tools/` | per tool: `HERRAMIENTA` → `TOOL`, `CLASE` → `CLASS`, `RUTAS` → `PATHS`; `MODULOS` → `MODULES`, `CLASES`, `RUTAS`, `FUNCIONES`, `HERRAMIENTAS` as above · `objeto` → `object_schema`, `visible(ruta)` → `visible(path)`, `dentro(entorno, ruta)` → `inside(environment, path)` · fields: `search` (`pattern`, `path`), `edit` (`path`, `old`, `new`), `write` (`path`, `content`), `run` (`command`), `delegate` (`brief`) · `run.py`: `LIMITE` → `TIMEOUT`, `partes(comando)` → `parts(command)` |
| `environment.py` | as `entorno.en.py`, plus `error` and `violation(b, tools=TOOLS)` |
| `permissions.py` | `COMANDOS` → `COMMANDS` · `AJENAS` → `FOREIGN` · `en_la_lista(comando, comandos=COMANDOS)` → `on_the_list(command, commands=COMMANDS)` · `permiso(ll, permisos, comandos)` → `permission(call, permissions, commands)` · `fuera(ll, entorno)` → `outside(call, environment)` · `ejecutar(ll, entorno, usuario=None, herramientas, funciones)` → `execute(call, environment, user=None, tools, functions)` |
| `compact.py`, `cost.py` | `UMBRAL` → `THRESHOLD` · `RECIENTES` → `RECENT` · `INSTRUCCION` → `INSTRUCTION` · `tokens(modelo)` → `tokens(model)` · `compactar(modelo, M, umbral, k, herramientas)` → `compact(model, M, threshold, k, tools)` · `VENTANA` → `WINDOW` · `tokens(mensajes, herramientas=())` → `tokens(messages, tools=())` |
| `subagent.py` | `REGLA` → `RULE` · `LECTURAS` → `READING` · `TOPE` → `LIMIT` · `SISTEMA` → `SYSTEM` · `subagente(modelo, encargo, entorno, tope=TOPE)` → `subagent(model, brief, environment, limit=LIMIT)` · `con_delegar(modelo)` → `with_delegate(model)` |
| `main.py`, `measure.py` | `linea(b)` → `line(b)` · `Traza(modelo, sangria="")` → `Trace(model, indent="")`, `.escribe` → `.echo` · `usuario(ll)` → `user(call)` · `BANCO` → `BENCH` · `LIMITE` → `TIMEOUT` · `evaluar(prueba, entorno)` → `grade(item, environment)` · `Cuenta(modelo)` → `Tally(model)`, attributes `turns`, `compactions`, `peak` · `intento(prueba)` → `attempt(item)` |
| `mcp_client.py` | `VERSION`, `META` unchanged · `LIMITE` → `TIMEOUT` · `ServidorMCP(*comando, traza=False)` → `MCPServer(*command, trace=False)`; `.leer()` → `.read()`, `.pedir(metodo, **params)` → `.rpc(method, **params)` (collision 6), `.herramientas()` → `.tools()`, `.llamar(nombre, argumentos)` → `.call(name, arguments)`, `.cerrar()` → `.close()` · `herramienta(t)` → `tool(t)` · `con_servidor(servidor, herramientas, funciones)` → `with_server(server, tools, functions)` |
| `issue_server.py`, `issues.json` | `DATOS` → `DATA` · `HERRAMIENTA` → `TOOL` · `error(codigo, mensaje, **datos)` → `error(code, message, **data)` · `completo(**campos)` → `complete(**fields)` · `incidencias(estado)` → `issues(state)` · `responder(metodo, params)` → `respond(method, params)` · the tool `incidencias` (`estado`: `abierta` / `cerrada`) → `issues` (`state`: `open` / `closed`) · JSON keys `id`, `estado`, `fichero`, `titulo` → `id`, `state`, `file`, `title` · `FOREIGN = {"issues": "reading"}` |

### Collisions, decided

1. **The roles are the protocol's: `system`, `user`, `assistant`.** Decided before 4·2 freezes them.
   The Spanish M carries `usuario` / `asistente` and 5·2's adapter translates them (`ROLES`); in
   English the course's own words for the two voices *are* the protocol's, so a translation table
   would map every word to itself, a step that teaches nothing. The English `api.py` has no
   `ROLES`: its one remaining clause is that the system messages go to the `system` field and the
   rest go as they are. That is 5·2's rewrite to absorb (its contract clause and `q-que-cambia`'s
   distractor (b) need a new point, which is the one left: the protocol has no `system` role inside
   `messages`). The `user` callable (Block 5's human at the terminal) and the role `"user"` name the
   same person, as `usuario` did twice in Spanish; 3·7's `assistant(…)` and the role `"assistant"`
   share a word the way `asistente` did, and 3·7 is the only lesson with both.
2. **`step` is `dl-nlp`'s and `Adam`'s, and never the loop's.** `dl-nlp/en/` already writes `step`
   for one step of a sequence (en/20's `step(h, x, …)`, en/23's `lstm_step`) and `generate`
   (en/25), so 5.9's `genera(paso, go, eos, max_pasos)` can only come out as
   `generate(step, go, eos, max_steps)` with `step(inputs)` "the model made a function". **That
   binds `dl-nlp`'s P11-08 when it translates 5.9** (it is not translated yet; this is the name it
   must take, not one taken from it). The training step is `Adam.step`, PyTorch's own name for it.
   The two never meet: the first is a bare function passed to `generate` and appears only in 1·9's
   quotation, named "the first course's `step`"; the second is always a method, written `Adam.step`
   or `opt.step(…)`. The prose word *step* belongs to neither the loop (*turn*) nor the prefill
   (`fill` / `advance`, never `step`), and appears only in *training step*.
3. **`windows()` keeps its name, and the prose always qualifies.** *Training window* (a slice of
   $T + 1$ tokens) and *context window* ($T_{\text{ctx}}$, what one call may hold) are the same shape
   at two sizes, which is the Spanish table's reason for spending one word on both, and it holds in
   English. Bare *window* is never written in a lesson that has both (Block 1 from 1·5, and 3·5's
   pickup); Blocks 4–5 mean the context window and write the compound on first use.
4. **`call` is the model's; the builders are named after their blocks.** A call is one `tool_use`
   block, the model's request (from 4·1, as in Spanish; Blocks 2–3 spend the word on calls to the
   model). The parameter that holds one is `call`, and `MCPServer.call(name, arguments)` is the same
   act through MCP. So the builder cannot also be `call`: `texto` / `llamada` / `resultado` become
   `text` / `tool_use` / `tool_result`, the three block types they build.
5. **`execute` is the harness's, `run` is a tool, `main.py` is the program.** The Spanish spends
   `ejecutar` on the harness's function and on Block 5's tool, and `correr.py` on the program the
   student launches. English separates all three in the name: the harness *executes* a call
   (`execute(call, environment)`), the tool `run` runs a command, and the entry point is `main.py`,
   because `run.py` would be the tool's module (`tools/run.py`) a second time. The noun *run* has no
   job: one try of an item is an *attempt*.
6. **`request` is the user's; the wire has other words.** The user's `pedido` is the `request`
   (`agent(model, request, …)`, `request.txt`). The HTTP body the adapter sends is a `payload`
   (`payload(…)`, `send(payload)`); a JSON-RPC message to an MCP server is an `rpc`
   (`MCPServer.rpc(method, **params)`). In prose: "the POST", "an RPC and its result". *Request*
   and *response* in 5·9's wire prose would read as the course's terms, and they are not.
7. **`script` is the scripted model's.** `ScriptedModel(script)` is the natural English, and the
   word's other sense, a Python file the student runs (`AUTHORING.md` §4's `cuaderno` row), gives it
   up: in English that is a **program** or a file, never a script.
8. **Tool classes are nouns, tool names are verbs.** `read` and `"reading"`, `write` and
   `"writing"`, `run` and `"execution"`. With `"read"` / `"write"` as classes, `CLASSES["write"]
   == "write"` would read as if the class were taken off the tool's name, which is exactly what the
   class row forbids. In prose: "a reading tool", "the writing class".
9. **Three Python names step aside.** `objeto` → `object_schema` (not `object`), `muestra` → `show`
   (not `sample`, the sampler), `lista.txt` → `shopping.txt` (not `list.txt`, beside the `list`
   tool).
10. **`AGENT.md`.** The model reads this name: the system prompt's rules and the bench's tasks
    mention it. `AGENT.md` is the Spanish `AGENTE.md`'s exact counterpart, a name the course owns
    and defines (one file, read once, deciding no permission). `AGENTS.md`, the cross-tool
    convention, would import that convention's semantics (nested files, precedence) without the
    course implementing them; a lesson that wants to mention it does so in a reading note.
11. **`test` is Block 4's; Block 3's `prueba` is an `item`.** Both would be *test* in English. The
    agent test (4·7) keeps the word unittest gives it; a benchmark entry is an **item** (`bench/`,
    `grade(item, …)`, `attempt(item)`).
12. **Tolerated, as in Spanish.** `path` is a tool field from Block 4 and 3·2's *path* through the
    network's rows; the two never share a block. `"ask"` (the decision) and `ask(call)` (the
    scripted user) are one act. The `tools` package and a `tools=` parameter coexist as
    `herramientas` did.

## 2. The glossary

The rule is the shared one, **one concept, one word, course-wide**, and the row goes in before the
lesson that needs it. This table is the Spanish table's distinctions in English, row for row and in
its order, so a translator reading a Spanish lesson finds the term by its Spanish name.

### model, harness, agent

Unchanged as a split: **model** is the trained artefact held as the function
`model(messages, tools) -> response`; **harness** is everything around it that makes it act (the
loop, the tools, the prompts, the permissions, compaction); **agent** is a harness with a model
behind it, running against an environment. *Neural network*, "the network", appears only when a
lesson looks inside the model (`net` in code). *System* names the role and the system prompt, and
nothing else: never the harness.

### The table

Rows the English makes plain are plain: harness, sandbox, prompt, checkpoint, batch, test, prefill,
pre-token, embedding, reward hacking are course vocabulary, bold at their definition and unmarked
after. *Never* lists the drift a reader would take for a second concept.

| Spanish row | Use | Never |
|---|---|---|
| `herramienta` | tool | function (the Python one); action, capability |
| `llamada` | call; "tool call" on first use per lesson. Blocks 2–3: a call to the model; from 4·1, the model's (said once there). The verbs hold: the harness calls the model, the model makes calls | function call, invocation, tool invocation, request |
| `observación` | observation | result (names the block), output, return value; response (the model's) |
| `respuesta` | response (see below) | output, completion, reply, answer as the term |
| `turno` | turn (see below) | iteration, round, step; a message and its reply |
| `entorno` | environment | world, workspace, system; context |
| `permiso` | permission | authorisation, approval, confirmation, consent |
| `ventana (de contexto)` | context window | context length, memory, limit; bare window where the training window is near |
| `compactación`, `compactar` | compaction, to compact; "start", "middle", "recent" are loose words | summarisation (the summary is the instrument), compression, truncation |
| *sandbox* | sandbox | jail, isolation, confinement; the command list (the permission's) |
| `subagente` | subagent | sub-agent, child agent, worker, thread |
| `protocolo` | protocol; the Messages format; MCP for tools | API as a synonym, format, standard |
| *prompt*, `prompt de sistema`, `fichero de proyecto` | prompt, system prompt, project file (`AGENT.md`); "voice" loose, prose only | instructions (the user's), memory, project context; the file name as the term |
| `logits` | logits | scores, activations; output pre-activation as the term (named once at the collision) |
| `regla de la cadena` (probabilidad) | chain rule (of probability), with the first course's chain rule of derivatives named once | autoregressive factorisation as the term, decomposition |
| `ventana (de entrenamiento)` | training window, `windows()` | chunk, slice, fragment, sequence; bare window |
| `byte` | byte | octet |
| `fusión`, `fusionar` | merge, to merge; the merge list | rule, combination, union, join |
| *pre-token* | pre-token | word, chunk, piece |
| `codificar`, `decodificar` | encode, decode | tokenise for one direction (tokenisation is the whole choice) |
| `paso (de entrenamiento)` | training step; `Adam.step` | iteration, update; bare step (collision 2) |
| *batch* | batch | mini-batch, lot |
| *checkpoint* | checkpoint | snapshot, saved weights as the term; a repository tag |
| `media móvil` | moving average | EMA in prose, running mean; bare mean (that is $\mathbb{E}$) |
| `recorte (del gradiente)` | gradient clipping, to clip the gradient | bare clipping, norm capping |
| `calendario` | (learning-rate) schedule | plan, programme, scheduler |
| `calentamiento` | warm-up | ramp-up, burn-in |
| `decaimiento de pesos` | weight decay; AdamW's W named once | L2 regularisation (the coupled version) |
| `muestrear`, `muestreo`, `sorteo` | to sample, sampling; one draw is a draw | pick, extract; sample as a noun for a training example |
| `generación voraz` | greedy generation, with *greedy decoding* named once | greedy decoding as the term, greedy search, argmax as a noun |
| `favorita` | favourite | winner, top-1, the maximum |
| `corte`, `cortar` | cut, to cut; top-k, top-p | clipping, truncation, pruning, filtering |
| `núcleo` | nucleus, with *nucleus sampling* named once | top-p set |
| `renormalizar` | renormalise | normalise again, rescale |
| `masa` | mass | weight, cumulative probability as a noun |
| `cola` | tail | rest as the term |
| `ciclo` | cycle | loop (the code's), repetition as the term |
| `caché` | cache, with *KV cache* named once | memory, buffer, store |
| *prefill* | prefill | preload, prefilling; `fill` is the function |
| `texto reservado` | held-out text | validation set, test set |
| `perplejidad` | perplexity, $\text{PPL}$ | confusion; branching factor as the term |
| `nat`, `bit` | nat, bit | nit |
| `bits por byte` | bits per byte (bpb) | BPB, bits per character, compression as the term |
| `modelo de unigramas` | unigram model | frequency model, zero-order model |
| `suavizado de Laplace` | Laplace smoothing; *add-one* named once | smoothing alone |
| `ley de potencia` | power law | power relation |
| `ley de escala` | scaling law | scaling rule |
| `cálculo` | compute, $C$, counted in FLOPs (expanded once) | computation, cost as the term; FLOPS |
| `presupuesto (de cálculo)` | compute budget, budget | limit, spend |
| `reparto óptimo` | compute-optimal allocation; optimal for a model on it | Chinchilla-optimal as the term |
| `valle`, `fondo` | valley, its bottom; *IsoFLOP* named once | profile, IsoFLOP curve as the term; floor (that is the irreducible loss) |
| `pérdida irreducible` | irreducible loss; floor is its picture | entropy of the text as the term, bound |
| `época` | epoch | pass (the network's), sweep |
| `tokens distintos` | distinct tokens | unique tokens, new text |
| `aprendizaje en contexto` | in-context learning (ICL) | few-shot learning as the term; bare learning ($\theta$ moving) |
| `ejemplo` | example; zero-, one-, few-shot named once | demonstration, shot, exemplar, sample |
| `tarea` | task, $\omega$ | problem, skill, capability |
| `caso` | case, $x$ | query (attention's), question; input as the term |
| `firma` | signature | header, prototype, interface |
| `contrato` | contract | specification (Block 3's), guarantees, promise |
| `cadena de parada` | stop sequence, `stop` | stop string, terminator, delimiter |
| `rellenar (la caché)`, `relleno` | refill | slide, reset, reload; padding (`dl-nlp`'s) |
| `preentrenamiento` | pre-training, to pre-train | prior training, pretraining |
| `instrucción` | instruction | order, directive; command (`run`'s) |
| `obedecer` | obey (see below) | follow an instruction, comply, heed |
| `buena` | good, the event $\text{good}$ | correct, useful, helpful |
| `mensaje` | message | turn, utterance, entry |
| `rol` | role: `system`, `user`, `assistant` | speaker; author (fine in passing) |
| `contenido` | content | text (the corpus's), body |
| `política` | policy, $\pi_\theta$ | strategy; model |
| `plantilla (de chat)` | chat template | format as its name, prompt format |
| `token especial` | special token; `<\|end\|>` glossed once per lesson as the end-of-message token | marker, symbol, tag, control token |
| `máscara (de la pérdida)` | loss mask | weight (`loss`'s parameter), filter |
| `ajuste supervisado` | supervised fine-tuning (SFT); to fine-tune; fine-tuning, the general operation | retraining; supervised learning as its name |
| `verosimilitud` | likelihood | probability as the term |
| `olvido catastrófico` | catastrophic forgetting | forgetting alone, interference, degradation |
| `comparación`, `preferida`, `rechazada` | comparison; the preferred and the rejected response | preference pair (a pair is SFT's), vote as the term, chosen, winner / loser |
| `anotador` | labeller | annotator, rater, evaluator, judge |
| `recompensa`, `modelo de recompensa` | reward, reward model | score, grade, prize; judge |
| `margen` | margin | difference as the term, advantage, gap |
| `capa lineal` | linear layer | head, projection as the term |
| `aprendizaje por refuerzo` | reinforcement learning | RL outside RLHF and its kin, reinforcement alone |
| `referencia` | reference, $\pi_{\text{ref}}$; the starting model, before the term | reference policy as the term, anchor, base model |
| `divergencia de Kullback–Leibler` | Kullback–Leibler divergence, then the KL | relative entropy; distance as the term |
| `truco de la derivada logarítmica` | log-derivative trick; REINFORCE, a proper name | score-function trick, policy gradient as the estimator's name |
| `línea base` | baseline | advantage, reference |
| `descontar`, `recompensa descontada` | to penalise, the penalised reward (see below) | discount, discounted reward; punishment |
| *reward hacking* | reward hacking | specification gaming, over-optimisation as the term |
| `factor` | factor | weight, coefficient |
| `apagarse` | to fade: the comparison fades | saturate, vanish, go silent |
| `función de partición` | partition function | normalising constant as the term, normaliser |
| `recompensa implícita` | implicit reward | hidden reward, latent reward; reward model |
| `guía (de anotación)` | labelling guidelines, the guidelines | instructions, rules, manual |
| `utilidad`, `veracidad`, `inocuidad` | helpfulness, truthfulness, harmlessness | honesty as the criterion, safety |
| `constitución`, `principio` | constitution, principle; Constitutional AI | rules, values, code |
| `crítica`, `revisión` | critique, revision; to critique, to revise | correction, rewrite as the term |
| `juez` | judge; Block 3's model grader is one | evaluator, feedback model as the term |
| `alineado`, `alineamiento` | aligned, alignment | obedient, tuned |
| `complacencia` | sycophancy, sycophantic | flattery, servility |
| `modelo preentrenado` | pre-trained model; *base* and *instruct* named once as labels | base model as the term, foundation model, raw model |
| `cuaderno (de Colab)` | (Colab) notebook | workbook; script (collision 7) |
| `especificación` | specification | requirements, instructions, contract, spec |
| `cumplir` | to meet (a specification), the event $\text{meets}$ | obey, satisfy, comply, validate |
| `comprobación` | check, to check; `meets(y)` | validation, test, verification |
| `guion`, `modelo guionizado` | script, scripted model, `ScriptedModel` | mock, fake, stub, simulated model |
| `pasada` | pass, forward pass | step, call; `forward` is the Python name |
| `cadena de pensamiento` | chain of thought (CoT) | reasoning as the term, scratchpad, thinking alone |
| `camino` | path | route, trajectory |
| `profundidad`, `anchura` | depth, width | layers as the count, levels, parallelism |
| `gramática`, `esquema`, `campo` | grammar, schema, field | formal language as the term, format, template; key |
| `texto (de la gramática)` | string (of the grammar) | word, sentence, chain |
| `válida` | valid | correct, good, meets |
| `permitidas` | allowed (entries) | valid, admissible, legal |
| `máscara (sobre los logits)`, `generación restringida` | logit mask, to mask; constrained generation, with *constrained decoding* named once | constrained decoding as the term, guided generation, filter |
| `condicionada` | conditioned (on $\mathcal{G}$) | restricted, constrained, filtered |
| `muestreo por rechazo`, `intento` | rejection sampling, attempt | retry (the harness's), trial |
| `pasaje` | passage | document, chunk, fragment, window |
| *embedding* (de un texto) | text embedding | document vector as the term, encoding |
| `recuperación`, `recuperador` | retrieval, to retrieve, retriever; RAG | search as the term, lookup, extraction |
| `pieza (del prompt)` | piece | segment, block, part, chunk |
| `bloque (de contenido)` | content block; "block" alone after it, never beside a numbered Block | piece, part, segment |
| `bucle (del agente)` | agent loop, `loop`; one pass is a turn | cycle, iteration, run |
| `tope (de turnos)` | turn limit, `limit` | cap, max turns, budget |
| `stop_reason` | `stop_reason`; "why the model stopped" in prose | stop reason as a prose term |
| `fallar`, `error` | to fail (a call), error | failure as the term, exception (Python's) |
| `idempotente` | idempotent, idempotence | repeatable, retry-safe |
| `repetir (una llamada)` | to repeat (a call) | retry, redo, relaunch |
| `clase (de herramienta)` | (tool) class: reading, writing, execution | type (the schema's), category, level, scope |
| `tabla de permisos` | permission table, `PERMISSIONS`; allow, ask, deny | policy ($\pi_\theta$), configuration, rules |
| `contenido no fiable` | untrusted content | malicious content, external data |
| `inyección de instrucciones` | prompt injection | instruction injection, injection attack |
| `pedido` | request (collision 6) | task ($\omega$), prompt, query, order |
| `desactualizada` | stale | outdated, obsolete, invalid |
| *test* (del agente), `batería` | test, test suite; a test passes or does not pass (see below) | item (Block 3's), case; fail for a test |
| `harness roto` | broken harness; *mutation testing* named once | mutant, faulty version |
| `historial` | history | memory, conversation as the term, context |
| `reserva` | reserve | margin, budget, headroom |
| `truncar` | truncate, truncation | clip, cut, refill |
| `descartar` | discard (a piece) | drop, remove, prune, filter, truncate |
| *lost in the middle* | *lost in the middle*, Liu et al.'s name; the U-shaped curve | position bias as the term |
| `prueba`, `respuesta esperada`, `banco de pruebas` | item, expected response, benchmark; Block 5's item is a folder under `bench/` | test (Block 4's), example, eval; reference answer |
| `evaluar`, `evaluador` | evaluate, evaluation; grader | scorer, metric as the grader's name, eval; check |
| `acertar`, `acierto`, `tasa de acierto` | get right, correct; accuracy | precision (`../AUTHORING.en.md` §6), exactness; meets |
| `prueba exacta`, `normalizar` | exact item; normalise (the response) | exact match as the term; clean; renormalise |
| `intervalo de confianza`, `cobertura` | confidence interval, interval; coverage; the normal (Wald) interval, the Wilson interval | margin of error, error bars |
| `comparación emparejada` | paired comparison | pairwise comparison, difference of means |
| `acuerdo`, `kappa de Cohen` | agreement, Cohen's kappa | concordance, correlation |
| `contaminación` | contamination | leakage, memorisation as the term |
| `carpeta de trabajo` | working directory (see below) | root, workspace, project folder as the term |
| `código de salida`, `stdout`, `stderr` | exit code; `stdout`, `stderr` | return code, status; output, errors for the streams |
| `límite de tiempo` | timeout, `TIMEOUT` | time limit as a second name, deadline |
| `cita`, `citar` | quote, to quote: `old` is a quote | fragment, pattern (`search`'s), reference |
| `umbral` | (compaction) threshold, `THRESHOLD` | limit (the turn limit), cap, margin |
| `lista de comandos` | command list, `COMMANDS` | allowlist, whitelist; allowed list |
| `agente principal` | main agent; "outer", "inner" are loose words | parent agent, orchestrator, lead agent, root agent |
| `encargo` | brief, `brief` | task, request (the user's), instruction, prompt |
| `delegar` | delegate, `delegate` | spawn, launch, invoke, assign |
| `intento` (Block 5) | attempt | run, trial, execution, repetition; item |
| `servidor MCP` | MCP server, *Model Context Protocol* expanded once per lesson; client, prose only | provider, plugin; bare server (Block 5's runner) |
| `herramienta ajena` | foreign tool, `FOREIGN` | external, remote, third-party or MCP tool |

### Where the distinctions change shape

**The "Not" column changed jobs.** The Spanish one bans English words as anglicisms (*tool*,
*response*, *merge*, *encode*, *system prompt*). In English those are the terms. What the Spanish
rows were also preventing was synonym drift, and that is all the "Never" column above holds: *function
call* and *invocation* for a call, *output* and *completion* for a response, *iteration* and *round*
for a turn. Likewise, a row the Spanish glossed "with *X* given once" needs no gloss in English when
*X* is the term itself (*prompt injection*, *catastrophic forgetting*, *reward model*); the gloss
survives only where the English term differs from the literature's (*greedy decoding* for greedy
generation, *constrained decoding*, *KV cache*, *nucleus sampling*), and then it is italic, as
`../AUTHORING.en.md` §1 says.

**Turn.** In chat usage a turn is one user message and its reply. The course's **turn** is one call
to the model and everything the harness does with what came back, until the next call; one request
in Block 5 takes many turns, and the loop's whole point is that a call and a turn are not the same
size. 4·3, which defines it, says which one the course means in one sentence; Block 2, which has
chats and no loop, never says *turn* for a message and its reply (a message, an exchange).

**Response.** *Response* is also the HTTP response in Block 5's `urllib` code, and the two are the
same reply: the server's JSON is the protocol's response object, whose `content` list is the
model's response, and `APIModel.__call__` returns exactly that list. Lucky, and deliberate to keep:
a later lesson must not rename either side to keep them apart. The protocol's other fields
(`stop_reason`, `usage`) are read off the object and never called the response.

**Obey, not follow.** Spanish chose `obedecer` because `seguir` is the continuation's verb («lo que
sigue al prompt»). English *follow* has the same two senses ("what follows the prompt"), so the
decision carries over: the block title says "Following Instructions", the lesson that needs both says
once that obeying is the title's following, and every later lesson writes *obey*.

**Penalise, not discount.** In reinforcement learning *discount* is $\gamma$, the weighting of
future rewards. The Spanish `descontar` (subtracting $\beta$ times the log ratio) therefore becomes
*penalise* / *the penalised reward*, the reading the KL-penalty literature uses, and *discount* is
never written in Block 2.

**Greedy generation, because `decode` is taken.** 1·4 argues from the name: it does not call
always-take-the-favourite "decoding" because `decode` already turns ids into text. English keeps both
the argument and the name: *greedy generation*, with *greedy decoding* named once as the field's and
`dl-nlp`'s word. *Constrained generation* follows (3·3).

**A call fails; a test does not pass.** unittest prints `FAIL`, and English pulls hard towards
"the test fails". The Spanish keeps `fallar` for a call (an error observation) and *pasa / no pasa*
for a test, because 4·4 and 4·7 sit in the same block; so does English. `FAIL` quoted from output
stays in a fence.

**Working directory, and folder.** *Working directory* is the term of art (`cwd=`, the tool
descriptions), and Block 5's term. Any other directory is a **folder** in prose, matching Block 4's
`folder` field; *directory* alone is not used.

**Acronyms** follow `../AUTHORING.en.md` §6: expanded on first use in every lesson, then bare, with
one English expansion. A method's name keeps its source spelling (en-GB is for words the course
owns): *reinforcement learning from human feedback (RLHF)*, *direct preference optimization (DPO)*,
*proximal policy optimization (PPO)*, *group relative policy optimization (GRPO)*, *reinforcement
learning from AI feedback (RLAIF)*, *reinforcement learning with verifiable rewards (RLVR)*,
*retrieval-augmented generation (RAG)*, *Model Context Protocol (MCP)*, *supervised fine-tuning
(SFT)*, *in-context learning (ICL)*, *chain of thought (CoT)*.

**Inside `\text{…}`** (`../AUTHORING.en.md` §8): this course's NOTATION spells Spanish words the
table above translates, and an English lesson writes the English one with symbol, shape and meaning
unchanged: $\text{good}$, $\text{obeys}$, $\text{meets}$, $\text{text}$, $\text{accuracy}$,
$\text{correct}$, $\text{attempts}$, $\text{agreement}$, $\text{margin}$, $\text{valid}$,
$\text{judge}$, $\text{template}$, $\text{encode}$, $T_{\text{min}}$; the rest by the same rule.
`SFT`, `ref`, `ctx`, `PPL`, `bpb`, `KL`, `DPO` are already English.

## 3. The terminal form in English

`AUTHORING.md` §1's Block 5 rules (the opening `<Callout>`, fenced step 4 between two `<RepoLink>`s,
the reproduced run, the fenced budget, verification from a clean clone) apply unchanged. English adds
four:

- **Transcripts are measured, never translated.** A quoted model reply, a token count, a timing, a
  failure, an observation string or a `unittest -v` line is copied from an English run of the
  English code on the pinned chain, with the run's date and versions in the block md and its raw log
  beside it. A Spanish transcript with its words swapped is a fabricated measurement, however close
  it looks: the English system prompt, `AGENT.md` and requests change what the model does, and the
  token counts move with every word.
- **The opening `<Callout>`** pins the same chain as the Spanish lesson: Ollama 0.40.13,
  `qwen3:4b-instruct`, the 8K `Modelfile`. Its words are translated; its versions are not, and a
  version that is no longer installable stops the block (the phase README's locked decision).
- **`<RepoLink>` tags are the `en` branch's**: `en-b5-l1` … `en-b5-l9` in `agente-minimo` (D1),
  and `git clone --branch en-b5-lN`. The tag is the one thing in a Block 5 lesson that differs
  across locales by design, and `validate-repolinks.ts` (P3-01) fails a tag in the wrong locale's
  tree. Every file a fence names is §1's English name.
- **The model's language is not a finding in English.** Where the Spanish lesson reports the model
  answering in English (5·2's gazpacho run, 5·3's two sentences, the instruction 5·4 adds and 5·7
  repeats), the English lesson reports the failure its own run produced instead, and an instruction
  that only fixed the language («Escribe en español») is replaced by one that fixes what the English
  run got wrong. The full list is 08-block-5.md's table of sentences that report the model's
  language.

## 4. The two-reader test across the course boundary

`../AUTHORING.en.md` §8's two-reader test runs against the English neighbours, and 1·1's previous
lesson is in another course: `dl-nlp`'s last, `fine-tuning-colab`. When its English version exists,
1·1's pickup is written against it, and 1·1's quotation of `dl-nlp`'s closing words is that English
lesson's text. Until it exists, 1·1 is written against `dl-nlp`'s Spanish closing, and the Block 1
md records that 1·1 must be re-read once `dl-nlp`'s 5.11 lands in English. The same holds for 1·9's
`step(inputs)` against `dl-nlp`'s 5.9 (collision 2): if 5.9 is translated after 1·9, it takes the
name from here.

## 5. What this file does not replace

Named because these are the parts most likely to be re-decided by an author with this file open:

- **`AUTHORING.md` (this course's) unchanged**: the two shapes of a lesson and the systems lesson's
  step 3, the density announcement, every lesson naming the model it runs on (its English words:
  "the mini-GPT", "your mini-GPT from Block 1", "the scripted model", "a local model"), the
  prerequisites and the cite-never-re-derive rule, the product-name rule, `hasCode: false` and
  `minutes` in Block 5.
- **`../AUTHORING.en.md` unchanged**: the five marks, *you* and *we*, English examples throughout,
  Block and Lesson capitalised, the budget reading low, en-GB, the sibling rule for every asset and
  the `.en.py` parity test, and its §8.
- **All of [`../AUTHORING.md`](../AUTHORING.md)**: the six steps, the bridge rules, the budget, the
  components, the gotchas, the checklist.
- **Notation**, both files, except the `\text{…}` words in §2.
