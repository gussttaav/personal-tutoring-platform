"use client";

/*
 * CHAT-AGENT-P2-02 — Read a chat reply aloud through the browser's own speech engine
 * (`speechSynthesis`). No server, no audio stored.
 *
 * The voice follows the page language (`es-ES` / `en-GB`, as dictation listens): an exact
 * language match first, then any voice of that language, a LOCAL one preferred in each case
 * (network voices stall or fail offline). Chrome lists no voices until `voiceschanged`, so the
 * list is re-read on that event; with none matched the utterance still carries `lang` and the
 * engine picks.
 *
 * `speak()` cancels whatever is being read before it starts. `prime()` speaks an empty
 * utterance: iOS only lets a page speak after a user gesture, and a reply arrives seconds after
 * the tap, so the caller primes from inside the send handler. `cancel()` stops; the hook
 * cancels by itself on unmount.
 */

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { dictationLang } from "@/hooks/useDictation";

export interface VoiceLike {
  lang: string;
  localService: boolean;
  name: string;
}

function hasSpeechSynthesis(): boolean {
  return typeof window !== "undefined"
    && "speechSynthesis" in window
    && typeof window.SpeechSynthesisUtterance === "function";
}

const norm = (lang: string) => lang.replace(/_/g, "-").toLowerCase();

/** The best voice for `lang` (BCP 47), or null to let the engine choose. */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], lang: string): V | null {
  const want   = norm(lang);
  const prefix = want.split("-")[0];
  const exact  = voices.filter((v) => norm(v.lang) === want);
  const family = voices.filter((v) => norm(v.lang).split("-")[0] === prefix);
  return exact.find((v) => v.localService) ?? exact[0]
    ?? family.find((v) => v.localService) ?? family[0]
    ?? null;
}

const emptySubscribe = () => () => {};

export interface ReadAloud {
  supported: boolean;
  speak(text: string): void;
  prime(): void;
  cancel(): void;
}

export function useReadAloud(locale: string): ReadAloud {
  const supported = useSyncExternalStore(emptySubscribe, hasSpeechSynthesis, () => false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const lang = dictationLang(locale);

  useEffect(() => {
    if (!hasSpeechSynthesis()) return;
    const synth = window.speechSynthesis;
    const load = () => { voicesRef.current = synth.getVoices(); };
    load();
    synth.addEventListener?.("voiceschanged", load);
    return () => {
      synth.removeEventListener?.("voiceschanged", load);
      synth.cancel();
    };
  }, []);

  const cancel = useCallback(() => {
    if (hasSpeechSynthesis()) window.speechSynthesis.cancel();
  }, []);

  const speak = useCallback((text: string) => {
    if (!hasSpeechSynthesis() || !text.trim()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    const voice = pickVoice(voicesRef.current, lang);
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
  }, [lang]);

  const prime = useCallback(() => {
    if (!hasSpeechSynthesis()) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance("");
    utterance.lang = lang;
    synth.speak(utterance);
  }, [lang]);

  return { supported, speak, prime, cancel };
}
