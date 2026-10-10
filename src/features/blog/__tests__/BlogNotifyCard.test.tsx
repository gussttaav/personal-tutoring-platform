/**
 * @jest-environment jsdom
 */
// BLOG-15 — a subscriber's area toggles are a draft. Changing them swaps «No recibir
// notificaciones» for «Actualizar suscripción» (+ «Descartar cambios»); only that button
// saves, and toggling back to the saved selection brings the unsubscribe button back.
// Copy is rendered as its message key (`blog.notify.update`), so the assertions name keys.
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

jest.mock("next-auth/react", () => ({
  useSession: () => ({
    data:   { user: { email: "ana@example.com", name: "Ana" } },
    status: "authenticated",
    update: jest.fn(),
  }),
  signIn: jest.fn(),
}));

jest.mock("next-intl", () => ({
  useTranslations: (namespace: string) => (key: string) => `${namespace}.${key}`,
}));

jest.mock("@/lib/auth-popup", () => ({ signInWithPopup: jest.fn() }));

import BlogNotifyCard from "../BlogNotifyCard";

type Call = { method: string; body: unknown };

/** jsdom has no `Response`; the hook only reads `ok`, `status` and `json()`. */
const reply = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

/** Fakes /api/subscribe: the status read returns `saved`; PATCH answers `patchStatus`. */
function mockApi(saved: string[] | null, patchStatus = 200) {
  const calls: Call[] = [];
  global.fetch = jest.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
    const method = init?.method ?? "GET";
    calls.push({ method, body: init?.body ? JSON.parse(String(init.body)) : null });
    if (method === "GET")   return reply(200, { subscribed: true, areas: saved });
    if (method === "PATCH") return reply(patchStatus, patchStatus === 200 ? { ok: true } : { error: "X" });
    return reply(200, { ok: true });
  }) as typeof fetch;
  return calls;
}

const area   = (id: string) => screen.getByRole("button", { name: `blog.areas.${id}` });
const button = (key: string) => screen.queryByRole("button", { name: `blog.notify.${key}` });
const pressed = (id: string) => area(id).getAttribute("aria-pressed");

async function renderSubscribed() {
  render(<BlogNotifyCard />);
  await waitFor(() => expect(button("unsubscribe")).not.toBeNull());
}

describe("BlogNotifyCard — a subscriber changing areas", () => {
  it("offers update + discard only while the selection differs from the saved one", async () => {
    const calls = mockApi(["ia", "matematicas"]);
    await renderSubscribed();

    fireEvent.click(area("bases-de-datos"));

    expect(pressed("bases-de-datos")).toBe("true");
    expect(button("unsubscribe")).toBeNull();
    expect(button("update")).not.toBeNull();
    expect(button("discard")).not.toBeNull();
    expect(screen.getByText("blog.notify.pendingChanges")).toBeTruthy();
    // A toggle alone saves nothing.
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);

    // Back to the saved selection: nothing to update any more.
    fireEvent.click(area("bases-de-datos"));

    expect(button("update")).toBeNull();
    expect(button("unsubscribe")).not.toBeNull();
  });

  it("saves the edited selection with «Actualizar suscripción»", async () => {
    const calls = mockApi(["ia", "matematicas"]);
    await renderSubscribed();

    fireEvent.click(area("matematicas"));
    fireEvent.click(area("programacion"));
    await act(async () => { fireEvent.click(button("update")!); });

    expect(calls.filter((c) => c.method === "PATCH")).toEqual([
      { method: "PATCH", body: { type: "blog", areas: ["ia", "programacion"] } },
    ]);
    await waitFor(() => expect(button("unsubscribe")).not.toBeNull());
    expect(screen.getByText("blog.notify.saved")).toBeTruthy();
    expect(pressed("programacion")).toBe("true");
    expect(pressed("matematicas")).toBe("false");
  });

  it("keeps the edits and says so when the save fails", async () => {
    mockApi(["ia"], 500);
    await renderSubscribed();

    fireEvent.click(area("matematicas"));
    await act(async () => { fireEvent.click(button("update")!); });

    expect(screen.getByText("blog.notify.saveError")).toBeTruthy();
    expect(button("update")).not.toBeNull();
    expect(pressed("matematicas")).toBe("true");
  });

  it("puts the saved selection back with «Descartar cambios»", async () => {
    const calls = mockApi(["ia"]);
    await renderSubscribed();

    fireEvent.click(area("matematicas"));
    fireEvent.click(button("discard")!);

    expect(pressed("matematicas")).toBe("false");
    expect(button("unsubscribe")).not.toBeNull();
    expect(calls.filter((c) => c.method === "PATCH")).toHaveLength(0);
  });

  it("never leaves a subscriber with no area", async () => {
    const calls = mockApi(["ia"]);
    await renderSubscribed();

    fireEvent.click(area("ia"));

    expect(pressed("ia")).toBe("true");
    expect(screen.getByText("blog.notify.lastAreaHint")).toBeTruthy();
    expect(calls.filter((c) => c.method !== "GET")).toHaveLength(0);
  });
});
