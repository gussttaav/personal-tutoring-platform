// COURSE-ANNOUNCE-01 — registryCourseAnnouncementCatalog: the facts the announcement template
// needs, and the canonical-locale fallback the announce route used to do inline. The registry
// read (`catalog-view`) is mocked; this pins only what the adapter does with it.

const mockGetCatalogEntry                = jest.fn();
const mockGetEnglishTranslationCoverage = jest.fn();
jest.mock("../catalog-view", () => ({
  getCatalogEntry:               (...a: unknown[]) => mockGetCatalogEntry(...a),
  getEnglishTranslationCoverage: (...a: unknown[]) => mockGetEnglishTranslationCoverage(...a),
}));

import { registryCourseAnnouncementCatalog as catalog } from "../announcement-catalog";

const entry = (title: string, lessons: string[]) => ({
  course:  { slug: "dl-nlp", title },
  lessons: lessons.map((slug) => ({ slug })),
});

beforeEach(() => {
  jest.clearAllMocks();
  mockGetCatalogEntry.mockImplementation((slug: string, locale: string) => {
    if (slug !== "dl-nlp") return null;
    return locale === "es" ? entry("Curso", ["intro", "dos"]) : null;
  });
});

describe("canonical", () => {
  it("reads the title, lesson count and first lesson from the canonical locale", () => {
    expect(catalog.canonical("dl-nlp")).toEqual({
      courseSlug: "dl-nlp", courseTitle: "Curso", lessonCount: 2, firstLessonSlug: "intro",
    });
    expect(mockGetCatalogEntry).toHaveBeenCalledWith("dl-nlp", "es");
  });

  it("is null for a course the registry does not know", () => {
    expect(catalog.canonical("nope")).toBeNull();
  });
});

describe("forLocale", () => {
  it("uses the requested locale's manifest when there is one", () => {
    mockGetCatalogEntry.mockImplementation((_slug: string, locale: string) =>
      locale === "en" ? entry("Course", ["intro"]) : entry("Curso", ["intro", "dos"]));

    expect(catalog.forLocale("dl-nlp", "en")).toMatchObject({ courseTitle: "Course", lessonCount: 1 });
  });

  it("falls back to the canonical locale when the course has nothing in the requested one", () => {
    expect(catalog.forLocale("dl-nlp", "en")).toMatchObject({ courseTitle: "Curso", lessonCount: 2 });
  });

  it("is null when neither locale has the course", () => {
    expect(catalog.forLocale("nope", "en")).toBeNull();
  });
});

describe("englishCoverage", () => {
  it("is the same split the landing FAQ quotes", () => {
    const coverage = { translated: 1, total: 2, fullyTranslated: false };
    mockGetEnglishTranslationCoverage.mockReturnValue(coverage);

    expect(catalog.englishCoverage("dl-nlp")).toBe(coverage);
    expect(mockGetEnglishTranslationCoverage).toHaveBeenCalledWith("dl-nlp");
  });
});
