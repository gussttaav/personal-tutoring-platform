// CHAT-AGENT-P2-02: a markdown reply as the speech engine reads it.
import { toSpeakableText, SPEAKABLE_MAX_CHARS } from "../chat-speech";

describe("toSpeakableText", () => {
  it("leaves plain prose alone", () => {
    expect(toSpeakableText("Te propongo el martes a las diez. Confírmalo en la tarjeta."))
      .toBe("Te propongo el martes a las diez. Confírmalo en la tarjeta.");
  });

  it("drops heading markers and ends the heading as a sentence", () => {
    expect(toSpeakableText("## Precios\nLa clase de una hora cuesta 16 euros."))
      .toBe("Precios. La clase de una hora cuesta 16 euros.");
  });

  it("keeps the text of bold, italic, strike and inline code", () => {
    expect(toSpeakableText("Es **gratis**, dura *15 minutos* y ~~no~~ se usa `Zoom`."))
      .toBe("Es gratis, dura 15 minutos y no se usa Zoom.");
  });

  it("doesn't touch underscores inside words", () => {
    expect(toSpeakableText("La variable max_tokens y _otra_ cosa"))
      .toBe("La variable max_tokens y otra cosa.");
  });

  it("reads a link as its text and drops the URL", () => {
    expect(toSpeakableText("Resérvala en [la página de Mentoría](https://gustavoai.dev/mentoria)."))
      .toBe("Resérvala en la página de Mentoría.");
  });

  it("drops a link whose text is itself a URL or a path, and bare URLs", () => {
    expect(toSpeakableText("Puedes reservarla en [/mentoria](/mentoria)."))
      .toBe("Puedes reservarla en.");
    expect(toSpeakableText("Más en https://gustavoai.dev/blog y en www.example.com/x hoy"))
      .toBe("Más en y en hoy.");
    expect(toSpeakableText("Mira: [gustavoai.dev/mentoria](https://gustavoai.dev/mentoria)"))
      .toBe("Mira.");
  });

  it("turns list items into sentences", () => {
    expect(toSpeakableText("Opciones:\n- Clase de 1 hora\n- Clase de 2 horas\n1. Pack de 5\n2) Pack de 10!"))
      .toBe("Opciones. Clase de 1 hora. Clase de 2 horas. Pack de 5. Pack de 10!");
  });

  it("drops fenced code blocks, images, HTML, quotes' markers and rules", () => {
    const md = [
      "Así se hace:",
      "```python",
      "print('hola')",
      "```",
      "![diagrama](/blog/x.png)",
      "> Una cita<br>importante",
      "---",
      "Fin",
    ].join("\n");
    expect(toSpeakableText(md)).toBe("Así se hace. Una cita importante. Fin.");
  });

  it("reads table rows as lists and skips the separator row", () => {
    expect(toSpeakableText("| Producto | Precio |\n|---|:---:|\n| 1 hora | 16 € |"))
      .toBe("Producto, Precio. 1 hora, 16 €.");
  });

  it("skips lines with nothing to say", () => {
    expect(toSpeakableText("Hola\n\n***\n- \n![](/a.png)\nAdiós")).toBe("Hola. Adiós.");
    expect(toSpeakableText("")).toBe("");
  });

  it("caps a long reply at the last sentence that fits", () => {
    const sentence = "Esta es una frase de relleno bastante larga para la prueba. ";
    const out = toSpeakableText(sentence.repeat(30));
    expect(out.length).toBeLessThanOrEqual(SPEAKABLE_MAX_CHARS);
    expect(out.endsWith("prueba.")).toBe(true);
  });

  it("cuts at a word with an ellipsis when no sentence end fits", () => {
    const out = toSpeakableText("palabra ".repeat(200), 50);
    expect(out.length).toBeLessThanOrEqual(51);
    expect(out).toMatch(/^palabra( palabra)*…$/);
  });
});
