// CONTENT-FEEDBACK-01
import {
  CONTENT_KEY_RE,
  contentRoute,
  lessonContentKey,
  parseContentKey,
  voterKey,
} from "../content-key";

describe("content-key", () => {
  it("builds a lesson key from its two slugs", () => {
    expect(lessonContentKey("dl-nlp", "texto-como-numeros")).toBe("dl-nlp/texto-como-numeros");
  });

  it("parses a lesson key into course + lesson", () => {
    expect(parseContentKey("lesson", "dl-nlp/texto-como-numeros")).toEqual({
      type: "lesson",
      courseSlug: "dl-nlp",
      lessonSlug: "texto-como-numeros",
    });
  });

  it("parses a post key into its slug", () => {
    expect(parseContentKey("post", "por-que-empiezo-un-blog")).toEqual({
      type: "post",
      slug: "por-que-empiezo-un-blog",
    });
  });

  it("rejects a segment count that does not match the type", () => {
    expect(parseContentKey("lesson", "solo-un-segmento")).toBeNull();
    expect(parseContentKey("post", "dl-nlp/texto-como-numeros")).toBeNull();
  });

  it("rejects keys outside the slug shape", () => {
    for (const bad of ["Dl-nlp/x", "a//b", "/a", "a/", "a b", "a/b/c", "-a", "a-", "a_b", ""]) {
      expect(CONTENT_KEY_RE.test(bad)).toBe(false);
      expect(parseContentKey("lesson", bad)).toBeNull();
      expect(parseContentKey("post", bad)).toBeNull();
    }
  });

  it("rejects a key longer than the DB column allows", () => {
    expect(parseContentKey("post", "a".repeat(201))).toBeNull();
    expect(parseContentKey("post", "a".repeat(200))).not.toBeNull();
  });

  it("maps a key to its locale-less route", () => {
    expect(contentRoute("lesson", "dl-nlp/texto-como-numeros")).toBe("/cursos/dl-nlp/texto-como-numeros");
    expect(contentRoute("post", "por-que-empiezo-un-blog")).toBe("/blog/por-que-empiezo-un-blog");
    expect(contentRoute("post", "a/b")).toBeNull();
  });

  it("namespaces the voter key by identity", () => {
    expect(voterKey("u-1", "c-1")).toBe("user:u-1");
    expect(voterKey(null, "c-1")).toBe("anon:c-1");
  });
});
