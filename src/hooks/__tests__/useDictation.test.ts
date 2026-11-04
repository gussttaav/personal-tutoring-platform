/**
 * @jest-environment jsdom
 */
// CHAT-AGENT-P2-01: the dictation hook's state machine against a fake SpeechRecognition
// (no browser in Jest has a real one): start → interim → final → end, the errors the user
// can act on, cancel / unmount dropping what was heard, and "unsupported" when start() throws.
import { act, renderHook } from "@testing-library/react";
import {
  useDictation,
  dictationLang,
  readTranscript,
  type SpeechRecognitionLike,
  type SpeechRecognitionEventLike,
} from "@/hooks/useDictation";

class FakeRecognition implements SpeechRecognitionLike {
  static instances: FakeRecognition[] = [];
  static throwOnStart = false;

  lang = "";
  interimResults = false;
  continuous = true;
  maxAlternatives = 0;
  onresult: SpeechRecognitionLike["onresult"] = null;
  onerror:  SpeechRecognitionLike["onerror"]  = null;
  onend:    SpeechRecognitionLike["onend"]    = null;
  started = false;
  stopped = false;
  aborted = false;

  constructor() { FakeRecognition.instances.push(this); }

  start() {
    if (FakeRecognition.throwOnStart) throw new Error("not available");
    this.started = true;
  }
  stop()  { this.stopped = true; }
  abort() { this.aborted = true; }

  // Test drivers
  emit(results: Array<[string, boolean]>) {
    const list = results.map(([transcript, isFinal]) =>
      Object.assign([{ transcript }], { isFinal }),
    );
    this.onresult?.({ results: list } as unknown as SpeechRecognitionEventLike);
  }
  fail(error: string) { this.onerror?.({ error }); }
  end() { this.onend?.(); }
}

type SpeechWindow = { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };

function last(): FakeRecognition {
  return FakeRecognition.instances[FakeRecognition.instances.length - 1];
}

beforeEach(() => {
  FakeRecognition.instances = [];
  FakeRecognition.throwOnStart = false;
  (window as SpeechWindow).webkitSpeechRecognition = FakeRecognition;
  delete (window as SpeechWindow).SpeechRecognition;
});

afterAll(() => {
  delete (window as SpeechWindow).webkitSpeechRecognition;
});

function setup(locale = "es") {
  const onFinal = jest.fn();
  const hook = renderHook(() => useDictation({ locale, onFinal }));
  return { onFinal, hook };
}

describe("pure helpers", () => {
  it("listens in British English on /en and Spanish otherwise", () => {
    expect(dictationLang("en")).toBe("en-GB");
    expect(dictationLang("es")).toBe("es-ES");
  });

  it("splits final and interim text", () => {
    const results = [
      Object.assign([{ transcript: "¿tienes hueco " }], { isFinal: true }),
      Object.assign([{ transcript: "el martes" }], { isFinal: false }),
    ];
    expect(readTranscript(results as never)).toEqual({ final: "¿tienes hueco", interim: "el martes" });
  });
});

describe("useDictation", () => {
  it("is unsupported when the browser has no SpeechRecognition (Firefox)", () => {
    delete (window as SpeechWindow).webkitSpeechRecognition;
    const { hook } = setup();
    expect(hook.result.current.supported).toBe(false);
    act(() => hook.result.current.start());
    expect(FakeRecognition.instances).toHaveLength(0);
  });

  it("uses the unprefixed constructor when there is one", () => {
    delete (window as SpeechWindow).webkitSpeechRecognition;
    (window as SpeechWindow).SpeechRecognition = FakeRecognition;
    const { hook } = setup();
    expect(hook.result.current.supported).toBe(true);
  });

  it("start → interim → final → end hands the transcript over once", () => {
    const { hook, onFinal } = setup("en");
    expect(hook.result.current.supported).toBe(true);

    act(() => hook.result.current.start());
    const rec = last();
    expect(rec.started).toBe(true);
    expect(rec.lang).toBe("en-GB");
    expect(rec.interimResults).toBe(true);
    expect(rec.continuous).toBe(false);
    expect(hook.result.current.listening).toBe(true);

    act(() => rec.emit([["any free slot", false]]));
    expect(hook.result.current.interim).toBe("any free slot");
    expect(onFinal).not.toHaveBeenCalled();

    act(() => rec.emit([["any free slot on Tuesday afternoon", true]]));
    expect(hook.result.current.interim).toBe("");
    expect(onFinal).not.toHaveBeenCalled();

    act(() => rec.end());
    expect(onFinal).toHaveBeenCalledTimes(1);
    expect(onFinal).toHaveBeenCalledWith("any free slot on Tuesday afternoon");
    expect(hook.result.current.listening).toBe(false);
    expect(hook.result.current.error).toBeNull();
  });

  it("ignores a second start while listening", () => {
    const { hook } = setup();
    act(() => hook.result.current.start());
    act(() => hook.result.current.start());
    expect(FakeRecognition.instances).toHaveLength(1);
  });

  it("stop() asks the engine to finish, keeping what was heard", () => {
    const { hook, onFinal } = setup();
    act(() => hook.result.current.start());
    const rec = last();
    act(() => hook.result.current.stop());
    expect(rec.stopped).toBe(true);
    act(() => rec.emit([["¿tienes hueco el martes por la tarde?", true]]));
    act(() => rec.end());
    expect(onFinal).toHaveBeenCalledWith("¿tienes hueco el martes por la tarde?");
  });

  it("cancel() drops what was heard and can start again afterwards", () => {
    const { hook, onFinal } = setup();
    act(() => hook.result.current.start());
    const rec = last();
    act(() => rec.emit([["hola", true]]));
    act(() => hook.result.current.cancel());
    expect(rec.aborted).toBe(true);
    act(() => rec.end());
    expect(onFinal).not.toHaveBeenCalled();
    expect(hook.result.current.listening).toBe(false);

    act(() => hook.result.current.start());
    expect(FakeRecognition.instances).toHaveLength(2);
  });

  it("an end with nothing heard calls nothing", () => {
    const { hook, onFinal } = setup();
    act(() => hook.result.current.start());
    act(() => last().end());
    expect(onFinal).not.toHaveBeenCalled();
  });

  it("reports a denied microphone", () => {
    const { hook } = setup();
    act(() => hook.result.current.start());
    act(() => { last().fail("not-allowed"); last().end(); });
    expect(hook.result.current.error).toBe("not-allowed");
    expect(hook.result.current.listening).toBe(false);
    expect(hook.result.current.supported).toBe(true);

    act(() => hook.result.current.clearError());
    expect(hook.result.current.error).toBeNull();
  });

  it("reports no speech, and a new start clears it", () => {
    const { hook } = setup();
    act(() => hook.result.current.start());
    act(() => { last().fail("no-speech"); last().end(); });
    expect(hook.result.current.error).toBe("no-speech");
    act(() => hook.result.current.start());
    expect(hook.result.current.error).toBeNull();
  });

  it("resets silently on any other error", () => {
    const { hook, onFinal } = setup();
    act(() => hook.result.current.start());
    act(() => { last().fail("network"); last().end(); });
    expect(hook.result.current.error).toBeNull();
    expect(hook.result.current.listening).toBe(false);
    expect(onFinal).not.toHaveBeenCalled();
  });

  it("turns unsupported when start() throws (iOS with dictation off)", () => {
    FakeRecognition.throwOnStart = true;
    const { hook } = setup();
    act(() => hook.result.current.start());
    expect(hook.result.current.supported).toBe(false);
    expect(hook.result.current.listening).toBe(false);
    expect(hook.result.current.error).toBe("unsupported");
  });

  it("turns unsupported when the engine answers service-not-allowed", () => {
    const { hook } = setup();
    act(() => hook.result.current.start());
    act(() => { last().fail("service-not-allowed"); last().end(); });
    expect(hook.result.current.supported).toBe(false);
    expect(hook.result.current.error).toBe("unsupported");
  });

  it("aborts on unmount without calling back", () => {
    const { hook, onFinal } = setup();
    act(() => hook.result.current.start());
    const rec = last();
    act(() => rec.emit([["hola", true]]));
    hook.unmount();
    expect(rec.aborted).toBe(true);
    expect(rec.onend).toBeNull();
    expect(onFinal).not.toHaveBeenCalled();
  });

  it("calls the latest onFinal, not the one from the first render", () => {
    const first = jest.fn();
    const second = jest.fn();
    const hook = renderHook(({ cb }) => useDictation({ locale: "es", onFinal: cb }), {
      initialProps: { cb: first },
    });
    act(() => hook.result.current.start());
    hook.rerender({ cb: second });
    act(() => { last().emit([["hola", true]]); last().end(); });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("hola");
  });
});
