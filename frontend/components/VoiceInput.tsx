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
  const [supported] = useState(() => getRecognizer() !== null);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SpeechRecognitionLike | null>(null);

  useEffect(() => () => recRef.current?.stop(), []);

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
      className={`min-h-[44px] rounded-md border px-3 py-2 text-sm font-medium ${
        listening
          ? "border-red-300 bg-red-50 text-red-900"
          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-100"
      }`}
    >
      {listening ? "Stop listening…" : "Ask by voice"}
    </button>
  );
}
