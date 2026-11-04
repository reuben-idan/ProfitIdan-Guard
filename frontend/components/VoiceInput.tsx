"use client";

import { useEffect, useRef, useState } from "react";

interface SpeechRecognitionLike {
  lang: string;
  interimResults: boolean;
  onresult: ((event: { results: { transcript: string }[][] }) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function getRecognizer(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition as new () => SpeechRecognitionLike)
    ?? (w.webkitSpeechRecognition as new () => SpeechRecognitionLike)
    ?? null;
}

export default function VoiceInput({ onText }: { onText: (text: string) => void }) {
  // Detect support in an effect so server and client render identically
  // (reading window during render causes hydration error #418).
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => {
    setSupported(getRecognizer() !== null);
    return () => recRef.current?.stop();
  }, []);

  if (!supported) return null;

  function toggle() {
    const Ctor = getRecognizer();
    if (!Ctor) return;
    if (listening) {
      recRef.current?.stop();
      setListening(false);
      return;
    }
    const rec = new Ctor();
    rec.lang = "en-GH";
    rec.interimResults = false;
    rec.onresult = (event) => {
      const text = event.results[0]?.[0]?.transcript;
      if (text) onText(text);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);
    recRef.current = rec;
    rec.start();
    setListening(true);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={listening}
      className={`inline-flex min-h-[44px] items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition active:scale-[0.98] ${
        listening
          ? "border-clay/40 bg-red-50 text-clay"
          : "border-ink/15 bg-white text-pine-900 hover:border-pine-700"
      }`}
    >
      <svg viewBox="0 0 16 16" className="h-4 w-4" aria-hidden="true">
        <path
          d="M8 1a2.5 2.5 0 0 1 2.5 2.5v4a2.5 2.5 0 0 1-5 0v-4A2.5 2.5 0 0 1 8 1ZM3.5 7a4.5 4.5 0 0 0 9 0H11a3 3 0 0 1-6 0H3.5ZM7 11.6V14H5.5a1 1 0 0 0 0 2h5a1 1 0 0 0 0-2H9v-2.4a5.5 5.5 0 0 0 1-3.2V9a3 3 0 0 1-1 .6v2Z"
          fill="currentColor"
        />
      </svg>
      {listening ? "Stop listening…" : "Ask by voice"}
    </button>
  );
}
