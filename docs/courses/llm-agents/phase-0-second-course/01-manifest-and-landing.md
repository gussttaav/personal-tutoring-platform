# P0-01 — The manifests and the «soon» landing

**Tag:** `COURSE-C2-P0-01` · **Effort:** S · **Owner:** _tbd_ · **Status:** ⬜

## TL;DR

Write `content/courses/llm-agents/course.es.yml` and `course.en.yml`, and let the existing
landing route render them as the lesson-less «soon» page it already knows how to render. Fix the
one thing that page gets wrong today: it is `robots: index` even when it lists no lessons and the
sitemap omits it.

## Context

- `src/lib/courses/registry.ts` scans `content/courses/*/course.<locale>.yml`; a course is
  "published" when it has ≥ 1 published lesson (`listCourses`) but its landing is enumerated
  regardless (`listCourseManifests`, P1-03) so it is reviewable on a preview deploy.
- `src/lib/courses/catalog-view.ts:getCatalogEntry` returns `null` for a course with no lessons in
  any locale → absent from `/cursos`, from `sitemap.ts`, and from `courseLocales()` (so no
  hreflang alternates). **Correct.**
- `src/app/[locale]/cursos/[courseSlug]/page.tsx:generateMetadata` sets `robots: { index: true }`
  whenever `getCourse()` resolves — including the lesson-less case. **Wrong:** a page the sitemap
  refuses to list should not invite the crawler either.
- `CourseManifestSchema` (`src/lib/schemas.ts`) is `z.strictObject`; `level` is a free string
  rendered raw by `CourseHero` and `CourseCard`; `heroMotif` is an optional enum with one member.
- Copy that is course-specific (prerequisites intro, CTA, FAQ) lives in the manifest by design
  (P1-03's rationale, quoted in the schema comment): «a second course must not inherit dl-nlp's
  "build a Transformer" pitch». This is that second course.

## Files affected

| File | Change |
|------|--------|
| `content/courses/llm-agents/course.es.yml` (new) | The manifest below |
| `content/courses/llm-agents/course.en.yml` (new) | Its English twin — same block ids, translated prose |
| `src/app/[locale]/cursos/[courseSlug]/page.tsx` | `generateMetadata`: `robots: { index: false, follow: true }` when `getCatalogEntry(courseSlug, locale)` is `null` |
| `src/components/seo/CourseStructuredData.tsx` | Verify only: JSON-LD with zero lessons must still validate (no empty `hasPart` array of the wrong shape) |
| `src/lib/schemas.ts`, `src/domain/types.ts`, `src/features/courses/HeroMotif.tsx` | **Optional:** a second `heroMotif`. If skipped, the manifest omits the key and the hero renders without a motif, which the component already supports |

## The manifest (`course.es.yml`)

```yaml
# COURSE-C2-P0-01 — Course manifest (Spanish). Same contract as dl-nlp's: per-locale prose,
# locale-invariant block ids and lesson slugs, validated by CourseManifestSchema at build time.

slug: llm-agents
title: "Modelos de Lenguaje: del Transformer al Agente"
tagline: "Construye, desde cero y en tu propia máquina, un modelo de lenguaje moderno y el agente de programación que lo convierte en herramienta."
level: avanzado
prerequisites:
  intro: "Este curso continúa el de Deep Learning para NLP. Antes de empezar, necesitas:"
  items:
    - title: "El curso anterior, o su equivalente"
      detail: "Un Transformer escrito desde cero en NumPy. La atención, backpropagation y la entropía cruzada no se vuelven a explicar."
    - title: "Python intermedio"
      detail: "Funciones, clases, NumPy. En el último bloque, también ficheros, procesos y JSON."
    - title: "Una terminal"
      detail: "Saber abrirla, moverte por directorios y ejecutar un script. El último bloque vive en ella."
cta:
  heading: "¿Listo para construir un agente?"
  body: "Empieza por la primera lección. No necesitas cuenta para leer, ni instalar nada hasta el último bloque."
faq:
  - q: "¿Cuánto cuesta?"
    a: "Nada. El curso es gratuito y el último bloque corre con un modelo local en tu ordenador: no hace falta ninguna clave de API ni ningún servicio de pago."
  - q: "¿Qué necesito saber antes de empezar?"
    a: "Lo que enseña el curso anterior, Deep Learning para NLP: un Transformer construido desde cero, backpropagation y entropía cruzada. Si vienes de otro sitio con eso mismo, sirve igual."
  - q: "¿Cuánto tiempo me llevará?"
    a: "Alrededor de 40 horas si haces los ejercicios y el proyecto final. Vas a tu ritmo; no hay fechas límite."
  - q: "¿Qué necesito instalar?"
    a: "Nada hasta el bloque 5. Los cuatro primeros bloques se ejecutan en el navegador, Python incluido. El bloque 5 construye un programa de terminal contra un modelo de lenguaje que corre en tu máquina: Ollama y un modelo de unos 5 GB. Basta un ordenador con 16 GB de RAM y sin GPU; con 8 GB hay un modelo más pequeño que también sirve."
  - q: "¿Hay tantas matemáticas como en el primer curso?"
    a: "Al principio sí y al final no, y es a propósito. Los bloques 1 y 2 derivan; el 3 mezcla; los bloques 4 y 5 son ingeniería: contratos, protocolos y un programa que crece lección a lección. El título va de las matemáticas a los sistemas, y el curso también."
  - q: "¿Está en inglés?"
    a: "De momento solo en español. La versión en inglés está planificada."
  - q: "¿Construyo un Claude Code de verdad?"
    a: "Construyes un agente de programación en la terminal con las mismas piezas: el bucle, las herramientas, el prompt de sistema, la compactación del contexto, los permisos, los subagentes. Mucho más pequeño, y con un modelo local. La última lección apunta la herramienta real al mismo modelo y compara las dos con las mismas tareas."
blocks:
  - id: 1
    title: "Del Transformer al modelo de lenguaje"
    summary: "Una sola columna, BPE de verdad, un mini-GPT entrenado en NumPy, cómo se muestrea de él y cuánto cuesta cada token."
  - id: 2
    title: "De predecir texto a seguir instrucciones"
    summary: "Ajuste supervisado, modelo de recompensa, RLHF y la derivación completa de DPO."
  - id: 3
    title: "Hablar con el modelo es programar"
    summary: "El prompt como especificación, la cadena de pensamiento, la salida estructurada, la recuperación y cómo evaluar."
  - id: 4
    title: "El puente: de texto a acciones"
    summary: "Llamar herramientas, el bucle, los errores como observaciones, los permisos y la memoria."
  - id: 5
    title: "Un agente de programación en la terminal"
    summary: "El bucle con un modelo local real, herramientas de ficheros, compactación, sandbox, subagentes y un benchmark."
```

The English manifest translates every prose field and keeps `slug`, block `id`s and `level`'s
meaning (`advanced`). Title: *Language Models: from the Transformer to the Agent*. Prerequisite
item 1 names the English title of the first course. Translate the "Claude Code" FAQ verbatim in
sense — it is the one search query that lands here, in both languages.

## Acceptance criteria

- [ ] `pnpm lint:content` validates both manifests (a typo'd key fails)
- [x] `/cursos/llm-agents` renders hero, prerequisites, empty syllabus with the five block titles,
      FAQ and the «soon» CTA state; `/en/cursos/llm-agents` the same in English
      — the five block titles landed later, in `COURSE-BUILD-01`; see the P0-01 deviations in
      [STATUS.md](../STATUS.md)
- [ ] `/cursos` and `/en/cursos` still show **one** card (`dl-nlp`); `sitemap.xml` unchanged
- [ ] The lesson-less landing carries `<meta name="robots" content="noindex, follow">`; the
      moment a lesson is published, it flips to `index` with no further change
- [ ] Course JSON-LD on the lesson-less page validates (Rich Results test, or the schema's own
      validator if one is wired)
- [ ] `e2e/courses-navigation.spec.ts`, `courses-progress.spec.ts`, `courses-search.spec.ts` pass
      unchanged (they name `dl-nlp` explicitly; confirm none assumes a single card)
- [ ] File-top comment on the manifests carries `COURSE-C2-P0-01`

## Test plan

- `pnpm lint:content`, `pnpm build`, then read both landings in the browser pane (360 px and
  1440 px). The `courses-*` e2e specs (Node 22; see the memory note on the local DB if
  `global-setup` fails — verify via DOM reads instead).
- Unit: `src/lib/courses/__tests__/catalog-view.test.ts` — add the case "manifest without
  lessons: `listCatalogEntries` omits it, `getCourse` still resolves".

## Notes / gotchas

- **Do not add the course to the catalog by hand** or "temporarily" publish a lesson to see the
  card. The card appears by itself with the first `draft: false` lesson (P1-01's last PR).
- `level` is rendered raw. `avanzado` / `advanced`, lowercase, like `intermedio`.
- The FAQ's hardware numbers (16 GB, ~5 GB, 8 GB) are the same numbers P1-05 verifies. If P1-05
  changes them, this file changes in the same PR.
- The `heroMotif` enum member `attention-matrix` is deliberately NLP-specific (see the comment on
  `CourseHeroMotif`). A second motif is a design task; the manifest omits the key until one
  exists.

## Out of scope

- Any lesson, template or content directory (`es/` is created by P1-01's first lesson).
- The hand-off from `dl-nlp`'s landing and last bridge — P2-01.
- The English lesson tree.
