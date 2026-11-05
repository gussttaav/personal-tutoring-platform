/**
 * @jest-environment jsdom
 */
// CHAT-AGENT-P2-02: read-aloud against a fake speechSynthesis (jsdom has none): the voice
// pick (exact language, then the family, local first), voices arriving on `voiceschanged`,
// cancel-before-speak, the iOS prime and the cancel on unmount.
import { act, renderHook } from "@testing-library/react";
import { pickVoice, useReadAloud, type VoiceLike } from "@/hooks/useReadAloud";

const v = (lang: string, localService: boolean, name = `${lang}-${localService}`): VoiceLike => ({ lang, localService, name });

class FakeUtterance {
  lang = "";
  voice: VoiceLike | null = null;
  constructor(public text: string) {}
}

function installSynth(voices: VoiceLike[] = []) {
  const listeners: Array<() => void> = [];
  const synth = {
    voices,
    spoken: [] as FakeUtterance[],
    cancel: jest.fn(),
    speak: jest.fn((u: FakeUtterance) => { synth.spoken.push(u); }),
    getVoices: () => synth.voices,
    addEventListener: (_: string, fn: () => void) => { listeners.push(fn); },
    removeEventListener: jest.fn(),
    fireVoicesChanged: () => listeners.forEach((fn) => fn()),
  };
  Object.defineProperty(window, "speechSynthesis", { value: synth, configurable: true });
  Object.defineProperty(window, "SpeechSynthesisUtterance", { value: FakeUtterance, configurable: true, writable: true });
  (globalThis as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = FakeUtterance;
  return synth;
}

afterEach(() => {
  delete (window as { speechSynthesis?: unknown }).speechSynthesis;
  delete (window as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance;
});

describe("pickVoice", () => {
  it("prefers a local voice of the exact language", () => {
    const voices = [v("es-ES", false, "Google"), v("es-MX", true), v("es-ES", true, "Mónica")];
    expect(pickVoice(voices, "es-ES")?.name).toBe("Mónica");
  });

  it("takes a network voice of the exact language over a local one of another region", () => {
    expect(pickVoice([v("en-US", true), v("en-GB", false, "Google UK")], "en-GB")?.name).toBe("Google UK");
  });

  it("falls back to the language family, local first, and accepts es_ES spelling", () => {
    expect(pickVoice([v("es-MX", false), v("es_US", true, "local US")], "es-ES")?.name).toBe("local US");
    expect(pickVoice([v("es_ES", false, "underscore")], "es-ES")?.name).toBe("underscore");
  });

  it("answers null when no voice speaks the language", () => {
    expect(pickVoice([v("fr-FR", true)], "es-ES")).toBeNull();
    expect(pickVoice([], "en-GB")).toBeNull();
  });
});

describe("useReadAloud", () => {
  it("is unsupported without speechSynthesis, and speak is a no-op", () => {
    const { result } = renderHook(() => useReadAloud("es"));
    expect(result.current.supported).toBe(false);
    expect(() => result.current.speak("hola")).not.toThrow();
  });

  it("speaks in the page language with the voice that arrived on voiceschanged", () => {
    const synth = installSynth([]);
    const { result } = renderHook(() => useReadAloud("en"));
    expect(result.current.supported).toBe(true);

    synth.voices = [v("en-GB", true, "Daniel")];
    act(() => synth.fireVoicesChanged());
    act(() => result.current.speak("Hello there."));

    expect(synth.cancel).toHaveBeenCalled();
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0]).toMatchObject({ text: "Hello there.", lang: "en-GB" });
    expect(synth.spoken[0].voice?.name).toBe("Daniel");
  });

  it("cancels what is being read before each new speak", () => {
    const synth = installSynth([v("es-ES", true)]);
    const { result } = renderHook(() => useReadAloud("es"));
    act(() => result.current.speak("uno"));
    const cancelsAfterFirst = synth.cancel.mock.calls.length;
    act(() => result.current.speak("dos"));
    expect(synth.cancel.mock.calls.length).toBe(cancelsAfterFirst + 1);
    expect(synth.spoken.map((u) => u.text)).toEqual(["uno", "dos"]);
  });

  it("speaks nothing for empty text, and prime speaks an empty utterance", () => {
    const synth = installSynth([v("es-ES", true)]);
    const { result } = renderHook(() => useReadAloud("es"));
    act(() => result.current.speak("   "));
    expect(synth.spoken).toHaveLength(0);
    act(() => result.current.prime());
    expect(synth.spoken).toHaveLength(1);
    expect(synth.spoken[0]).toMatchObject({ text: "", lang: "es-ES" });
  });

  it("cancels on unmount", () => {
    const synth = installSynth([]);
    const { unmount } = renderHook(() => useReadAloud("es"));
    synth.cancel.mockClear();
    unmount();
    expect(synth.cancel).toHaveBeenCalledTimes(1);
  });
});
