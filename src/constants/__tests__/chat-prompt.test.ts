// CHAT-CONTENT-01 — the chat assistant's system prompt renders the site's content facts.
//
// The builder is pure: prices + `ChatPromptContent` in, text out. What matters is that each
// state a course or a post can be in reads truthfully (finished vs. being written, translated
// vs. Spanish-only, a block with no lessons yet), that an empty catalog is said plainly rather
// than rendered as an empty heading, and that the App Store line follows the env var exactly
// like the home's showcase does.

import type {
  ChatPromptContent,
  ChatPromptCourse,
  ChatPromptPost,
  ChatPromptPrices,
} from "@/constants/chat-prompt";

const PRICES: ChatPromptPrices = {
  session1h: 1600,
  session2h: 3050,
  pack5: 7500,
  pack10: 14000,
  packValidityDays: 180,
  cancelHours: 2,
};

const SITE = "https://gustavoai.dev";

function course(overrides: Partial<ChatPromptCourse> = {}): ChatPromptCourse {
  return {
    title:         "Deep Learning para NLP",
    tagline:       "Del perceptrón al Transformer.",
    level:         "intermedio",
    url:           `${SITE}/cursos/dl-nlp`,
    urlEn:         `${SITE}/en/cursos/dl-nlp`,
    prerequisites: { intro: "Antes de empezar, necesitas:", items: ["Python intermedio: NumPy básico."] },
    faq:           [{ q: "¿Cuánto cuesta?", a: "Nada." }],
    complete:         true,
    publishedLessons: 2,
    plannedLessons:   2,
    english:          { translated: 2, total: 2 },
    blocks: [
      {
        id: 1, title: "Fundamentos", summary: "Tokenización.", planned: 2,
        lessons: [
          { slug: "texto-como-numeros", title: "El problema de representar el lenguaje" },
          { slug: "tokenizacion", title: "Tokenización" },
        ],
      },
    ],
    ...overrides,
  };
}

function post(overrides: Partial<ChatPromptPost> = {}): ChatPromptPost {
  return {
    title:   "Por qué AdamW",
    date:    "2026-09-15",
    summary: "El optimizador de los modelos de lenguaje.",
    areas:   ["ia", "matematicas"],
    tags:    ["optimizacion"],
    url:     `${SITE}/blog/de-newton-a-adamw`,
    urlEn:   `${SITE}/en/blog/de-newton-a-adamw`,
    ...overrides,
  };
}

function content(overrides: Partial<ChatPromptContent> = {}): ChatPromptContent {
  return { siteUrl: SITE, courses: [course()], posts: [post()], ...overrides };
}

/** Loads the module fresh, so `APP_STORE_URL` is read from the env set by the caller. */
function loadBuilder(appStoreUrl?: string) {
  const previous = process.env.NEXT_PUBLIC_APP_STORE_URL;
  if (appStoreUrl === undefined) delete process.env.NEXT_PUBLIC_APP_STORE_URL;
  else process.env.NEXT_PUBLIC_APP_STORE_URL = appStoreUrl;

  let build!: typeof import("@/constants/chat-prompt").buildChatSystemPrompt;
  jest.isolateModules(() => {
    build = require("@/constants/chat-prompt").buildChatSystemPrompt;
  });

  if (previous === undefined) delete process.env.NEXT_PUBLIC_APP_STORE_URL;
  else process.env.NEXT_PUBLIC_APP_STORE_URL = previous;
  return build;
}

const build = loadBuilder();

describe("buildChatSystemPrompt — prices", () => {
  it("still injects the live prices and policy figures", () => {
    const prompt = build(PRICES, content());
    expect(prompt).toContain("| 1 hora   | 16 €   |");
    expect(prompt).toContain("| 2 horas  | 30,50 €   |");
    expect(prompt).toContain("Validez de 180 días");
    expect(prompt).toContain("hasta 2 horas antes");
  });
});

describe("buildChatSystemPrompt — courses", () => {
  it("lists a finished, translated course with its links, FAQ and lessons", () => {
    const prompt = build(PRICES, content());
    expect(prompt).toContain("## Deep Learning para NLP");
    expect(prompt).toContain(`Página del curso: ${SITE}/cursos/dl-nlp (en inglés: ${SITE}/en/cursos/dl-nlp)`);
    expect(prompt).toContain("Estado: completo, 2 lecciones.");
    expect(prompt).toContain("Idioma: disponible por completo también en inglés.");
    expect(prompt).toContain("  - Python intermedio: NumPy básico.");
    expect(prompt).toContain("  - ¿Cuánto cuesta? Nada.");
    expect(prompt).toContain("  - Tokenización (tokenizacion)");
    // The lesson-link rule comes with a real example built from the first lesson.
    expect(prompt).toContain(`(por ejemplo ${SITE}/cursos/dl-nlp/texto-como-numeros)`);
  });

  it("says a course is being written, block by block, including the blocks with no lesson yet", () => {
    const prompt = build(PRICES, content({
      courses: [course({
        complete: false,
        publishedLessons: 3,
        plannedLessons: 16,
        english: { translated: 0, total: 3 },
        urlEn: null,
        blocks: [
          { id: 1, title: "Uno", summary: "S1.", planned: 9, lessons: [{ slug: "a", title: "A" }, { slug: "b", title: "B" }] },
          { id: 2, title: "Dos", summary: "S2.", planned: 7, lessons: [] },
          { id: 3, title: "Tres", summary: "S3.", planned: 1, lessons: [{ slug: "c", title: "C" }] },
        ],
      })],
    }));
    expect(prompt).toContain("Estado: en elaboración: 3 de 16 lecciones publicadas.");
    expect(prompt).toContain("Idioma: solo en español por ahora");
    expect(prompt).toContain(`Página del curso: ${SITE}/cursos/dl-nlp\n`);
    expect(prompt).toContain("**Bloque 1 · Uno** (2 de 9 lecciones publicadas): S1.");
    expect(prompt).toContain("**Bloque 2 · Dos** (7 lecciones, próximamente): S2.");
    expect(prompt).toContain("**Bloque 3 · Tres** (1 lección): S3.");
  });

  it("gives the split while a translation is under way", () => {
    const prompt = build(PRICES, content({
      courses: [course({ english: { translated: 32, total: 43 } })],
    }));
    expect(prompt).toContain("traducción al inglés en curso: 32 de 43 lecciones ya están en inglés");
  });

  it("does not invent a total when a block declares no plan", () => {
    const prompt = build(PRICES, content({
      courses: [course({ complete: false, plannedLessons: null, publishedLessons: 5 })],
    }));
    expect(prompt).toContain("Estado: en elaboración: 5 lecciones publicadas por ahora.");
  });

  it("says plainly when no course is published", () => {
    const prompt = build(PRICES, content({ courses: [] }));
    expect(prompt).toContain("Todavía no hay ningún curso publicado.");
    expect(prompt).not.toContain("## Deep Learning para NLP");
  });
});

describe("buildChatSystemPrompt — blog", () => {
  it("lists each post with its areas, topics, links and summary", () => {
    const prompt = build(PRICES, content());
    expect(prompt).toContain("- **Por qué AdamW** (2026-09-15; áreas: ia, matematicas; temas: optimizacion)");
    expect(prompt).toContain(`${SITE}/blog/de-newton-a-adamw · en inglés: ${SITE}/en/blog/de-newton-a-adamw`);
    expect(prompt).toContain("El optimizador de los modelos de lenguaje.");
  });

  it("marks an untranslated post as Spanish-only and keeps the order it was given", () => {
    const prompt = build(PRICES, content({
      posts: [
        post({ title: "Nuevo", date: "2026-10-12", urlEn: null, tags: [] }),
        post({ title: "Viejo" }),
      ],
    }));
    expect(prompt).toContain("- **Nuevo** (2026-10-12; áreas: ia, matematicas)\n");
    expect(prompt).toContain(`${SITE}/blog/de-newton-a-adamw · solo en español`);
    expect(prompt.indexOf("**Nuevo**")).toBeLessThan(prompt.indexOf("**Viejo**"));
  });

  it("says plainly when no post is published", () => {
    const prompt = build(PRICES, content({ posts: [] }));
    expect(prompt).toContain("Todavía no hay ningún artículo publicado.");
  });
});

describe("buildChatSystemPrompt — mobile app", () => {
  it("links Google Play and says the App Store is coming while no URL is set", () => {
    const prompt = build(PRICES, content());
    expect(prompt).toContain("https://play.google.com/store/apps/details?id=dev.gustavoai.mobile");
    expect(prompt).toContain("**iPhone (iOS):** todavía no está disponible; llegará próximamente a App Store.");
  });

  it("links the App Store once NEXT_PUBLIC_APP_STORE_URL is set", () => {
    const withIos = loadBuilder("https://apps.apple.com/app/id123");
    const prompt = withIos(PRICES, content());
    expect(prompt).toContain("**iPhone (iOS):** disponible en App Store: https://apps.apple.com/app/id123.");
    expect(prompt).not.toContain("próximamente a App Store");
  });
});
