/*
 * REDESIGN-P2-02 — Testimonials shown on /mentoria's «Valoraciones» band.
 *
 * Content, not copy: a testimonial is something a student wrote, so it is never translated
 * (see `docs/redesign/design/NOTES.md` «Locked decisions»). `pickTestimonials(locale)` orders
 * the list so the visitor's own language comes first, then takes the top three — on `/` that's
 * the three Spanish quotes, on `/en` it's Jeremy's first, then the next two in list order
 * (Sergi, Alberto). The sort is stable, so within each language group the order below is kept.
 */

export interface Testimonial {
  name: string;
  initials: string;
  lang: "es" | "en";
  context?: string;
  quote: string;
  /** Path under `public/`, e.g. `/testimonials/pablo.webp`. Falls back to the initials avatar when absent. */
  image?: string;
}

export const TESTIMONIALS: readonly Testimonial[] = [
  {
    name: "Sergi Pérez",
    initials: "SP",
    lang: "es",
    image: "/testimonials/sergi-perez.webp",
    quote:
      "De los mejores profesores que puedes encontrar (he tenido muchos). Experiencia " +
      "fantástica, profesional, cercano y objetivo. Un auténtico crack. Sin duda lo volvería a " +
      "contratar.",
  },
  {
    name: "Alberto González",
    initials: "AG",
    lang: "es",
    image: "/testimonials/alberto-gonzalez.webp",
    quote:
      "Gran profesor, no dudéis en estar con él a la hora de aprender a programar, ya sea en " +
      "Java, como en mi caso con ejercicios avanzados usando interfaces gráficas, o aprender " +
      "desde cero.",
  },
  {
    name: "Pablo",
    initials: "P",
    lang: "es",
    image: "/testimonials/pablo.webp",
    quote:
      "Solo puedo decir que me parece un profesor excelente. Muy involucrado, explicaciones " +
      "claras, un conocimiento claro de la materia que imparte y amabilidad que no se puede " +
      "medir.",
  },
  {
    name: "Jeremy GL",
    initials: "JG",
    lang: "en",
    image: "/testimonials/jeremy-gl.webp",
    quote:
      "He's a really cool and friendly teacher. He will take the time to explain everything " +
      "well and concise. I almost finished my pack of classes with him, and it is a pleasure to " +
      "be his student.",
  },
] as const;

/** First three testimonials, the visitor's own language first (stable otherwise). */
export function pickTestimonials(locale: string): readonly Testimonial[] {
  const ownLanguageFirst = (t: Testimonial) => (t.lang === locale ? 0 : 1);
  return [...TESTIMONIALS].sort((a, b) => ownLanguageFirst(a) - ownLanguageFirst(b)).slice(0, 3);
}
