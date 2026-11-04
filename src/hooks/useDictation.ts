"use client";

/*
 * CHAT-AGENT-P2-01 — Dictation into the chat input through the browser's own speech engine
 * (Web Speech `SpeechRecognition`, `webkitSpeechRecognition` in Chrome and Safari).
 *
 * One utterance per press (`continuous = false`: the engine stops on silence). Interim text is
 * exposed as `interim` while the user speaks; the final transcript is handed to `onFinal` once,
 * when the engine ends, so the caller appends it to the input and the user can edit it before
 * sending. Nothing is sent or stored here: the audio goes to the browser's speech service
 * (Google in Chrome, Apple in Safari), which the privacy policy states.
 *
 * `supported` is false on the server, where the API is missing (Firefox), and from the moment
 * `start()` throws or the engine answers `service-not-allowed` (iOS Safari with Siri/dictation
 * off exposes the constructor but can't use it): the caller hides the button then.
 *
 * Errors the user can act on are surfaced as codes (`not-allowed`, `no-speech`, `unsupported`);
 * anything else (`aborted`, `network`, `audio-capture`…) just resets the button. `cancel()`
 * aborts and drops whatever was heard (panel closed, «Nueva conversación», a sent message);
 * the hook aborts by itself on unmount. No state is set synchronously by `cancel()`: the
 * engine's `end` event does it, so it is safe to call from an effect.
 */

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";

// ─── Minimal Web Speech types (not in TypeScript's DOM lib) ───────────────────

interface SpeechRecognitionAlternativeLike { transcript: string }
interface SpeechRecognitionResultLike {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternativeLike;
}
interface SpeechRecognitionResultListLike {
  readonly length: number;
  [index: number]: SpeechRecognitionResultLike;
}
export interface SpeechRecognitionEventLike { results: SpeechRecognitionResultListLike }
export interface SpeechRecognitionErrorEventLike { error: string }

export interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror:  ((e: SpeechRecognitionErrorEventLike) => void) | null;
  onend:    (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

export type DictationError = "not-allowed" | "no-speech" | "unsupported";

/** The browser's recognition constructor, or null (SSR, Firefox). */
export function getSpeechRecognition(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** BCP 47 tag the engine listens for: British English on `/en`, Spanish otherwise. */
export function dictationLang(locale: string): string {
  return locale === "en" ? "en-GB" : "es-ES";
}

/** Splits a result list into its final and interim text (rebuilt whole on every event). */
export function readTranscript(results: SpeechRecognitionResultListLike): { final: string; interim: string } {
  let final = "";
  let interim = "";
  for (let i = 0; i < results.length; i++) {
    const text = results[i][0]?.transcript ?? "";
    if (results[i].isFinal) final += text;
    else interim += text;
  }
  return { final: final.trim(), interim: interim.trim() };
}

const emptySubscribe = () => () => {};

export interface UseDictationOptions {
  /** The page locale (`es` / `en`). */
  locale: string;
  /** Called once per utterance with the final transcript (never empty). */
  onFinal: (text: string) => void;
}

export interface Dictation {
  supported: boolean;
  listening: boolean;
  /** What the engine has heard so far and may still revise. Empty when not listening. */
  interim: string;
  error: DictationError | null;
  start(): void;
  /** Stop listening and keep what was heard (it arrives through `onFinal`). */
  stop(): void;
  /** Stop listening and drop what was heard. */
  cancel(): void;
  clearError(): void;
}

export function useDictation({ locale, onFinal }: UseDictationOptions): Dictation {
  const hasApi = useSyncExternalStore(emptySubscribe, () => getSpeechRecognition() !== null, () => false);
  const [broken,    setBroken]    = useState(false);
  const [listening, setListening] = useState(false);
  const [interim,   setInterim]   = useState("");
  const [error,     setError]     = useState<DictationError | null>(null);

  // The utterance in progress: `discard` is set by `cancel()` and read by its `end` handler.
  const sessionRef     = useRef<{ recognition: SpeechRecognitionLike; discard: boolean } | null>(null);
  const onFinalRef     = useRef(onFinal);
  useEffect(() => { onFinalRef.current = onFinal; }, [onFinal]);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognition();
    if (!Ctor || sessionRef.current) return;

    const recognition = new Ctor();
    recognition.lang            = dictationLang(locale);
    recognition.interimResults  = true;
    recognition.continuous      = false;
    recognition.maxAlternatives = 1;

    const session = { recognition, discard: false };
    let heard = "";

    recognition.onresult = (e) => {
      const { final, interim: pending } = readTranscript(e.results);
      heard = final;
      setInterim(pending);
    };
    recognition.onerror = (e) => {
      if (e.error === "not-allowed") setError("not-allowed");
      else if (e.error === "no-speech") setError("no-speech");
      else if (e.error === "service-not-allowed") { setError("unsupported"); setBroken(true); }
    };
    recognition.onend = () => {
      if (sessionRef.current === session) sessionRef.current = null;
      setListening(false);
      setInterim("");
      if (!session.discard && heard) onFinalRef.current(heard);
    };

    try {
      recognition.start();
    } catch {
      setError("unsupported");
      setBroken(true);
      return;
    }
    sessionRef.current = session;
    setError(null);
    setInterim("");
    setListening(true);
  }, [locale]);

  const stop = useCallback(() => {
    sessionRef.current?.recognition.stop();
  }, []);

  const cancel = useCallback(() => {
    const session = sessionRef.current;
    if (!session) return;
    session.discard = true;
    session.recognition.abort();
  }, []);

  const clearError = useCallback(() => setError(null), []);

  useEffect(() => () => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    session.recognition.onresult = null;
    session.recognition.onerror  = null;
    session.recognition.onend    = null;
    session.recognition.abort();
  }, []);

  return {
    supported: hasApi && !broken,
    listening,
    interim: listening ? interim : "",
    error,
    start,
    stop,
    cancel,
    clearError,
  };
}
