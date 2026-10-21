/**
 * @jest-environment jsdom
 */
// CHAT-GLOBAL-01: one chat for the whole app. The provider owns the open state every entry point
// reads (Navbar icon, Footer link), still answers the landing CTAs' `open-chat` event, and
// mounts the chat only where `isChatRoute` offers it.
import { act, fireEvent, render, screen } from "@testing-library/react";

let mockPathname = "/";
jest.mock("@/i18n/navigation", () => ({ usePathname: () => mockPathname }));

// The real `Chat` is a lazy chunk (react-markdown, next-intl); a marker is enough here.
jest.mock("next/dynamic", () => ({
  __esModule: true,
  default: () =>
    function MockChat() {
      return require("react").createElement("div", { "data-testid": "chat" });
    },
}));

import ChatProvider from "@/components/ChatProvider";
import { useChat, OPEN_CHAT_EVENT } from "@/hooks/useChat";

function Probe() {
  const { available, isOpen, toggle, close } = useChat();
  return (
    <>
      <p data-testid="state">{`available:${available} open:${isOpen}`}</p>
      <button onClick={toggle}>toggle</button>
      <button onClick={close}>close</button>
    </>
  );
}

function renderApp() {
  return render(
    <ChatProvider>
      <Probe />
    </ChatProvider>,
  );
}

const state = () => screen.getByTestId("state").textContent;

beforeEach(() => {
  mockPathname = "/";
});

describe("ChatProvider", () => {
  it("mounts the chat closed on a page that offers it", () => {
    mockPathname = "/cursos/dl-nlp/intro";
    renderApp();
    expect(screen.getByTestId("chat")).toBeTruthy();
    expect(state()).toBe("available:true open:false");
  });

  it("opens on the landing CTAs' open-chat event", () => {
    renderApp();
    act(() => { window.dispatchEvent(new Event(OPEN_CHAT_EVENT)); });
    expect(state()).toBe("available:true open:true");
  });

  it("toggles and closes from any entry point", () => {
    renderApp();
    fireEvent.click(screen.getByText("toggle"));
    expect(state()).toBe("available:true open:true");
    fireEvent.click(screen.getByText("toggle"));
    expect(state()).toBe("available:true open:false");
    fireEvent.click(screen.getByText("toggle"));
    fireEvent.click(screen.getByText("close"));
    expect(state()).toBe("available:true open:false");
  });

  it("leaves the classroom without a chat, and reports it unavailable", () => {
    mockPathname = "/sesion/abc123";
    renderApp();
    expect(screen.queryByTestId("chat")).toBeNull();
    act(() => { window.dispatchEvent(new Event(OPEN_CHAT_EVENT)); });
    expect(state()).toBe("available:false open:false");
  });

  it("answers 'not available' with no-ops outside the provider", () => {
    render(<Probe />);
    fireEvent.click(screen.getByText("toggle"));
    expect(state()).toBe("available:false open:false");
  });
});
