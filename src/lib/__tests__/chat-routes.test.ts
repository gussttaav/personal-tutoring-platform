// CHAT-GLOBAL-01: the assistant is on every page except the classroom, admin and auth popups.
import { isChatRoute } from "@/lib/chat-routes";

describe("isChatRoute", () => {
  it.each([
    "/",
    "/mentoria",
    "/cursos",
    "/cursos/dl-nlp/intro",
    "/blog",
    "/blog/de-c-a-rust",
    "/area-personal",
    "/sesion-confirmada",
    "/pago-exitoso",
    "/cancelar",
    "/terminos",
  ])("offers the chat on %s", (pathname) => {
    expect(isChatRoute(pathname)).toBe(true);
  });

  it.each([
    "/sesion/abc123",
    "/sesion",
    "/admin",
    "/admin/pricing",
    "/auth/signin-popup",
    "/auth/popup-callback",
  ])("leaves the chat out of %s", (pathname) => {
    expect(isChatRoute(pathname)).toBe(false);
  });
});
