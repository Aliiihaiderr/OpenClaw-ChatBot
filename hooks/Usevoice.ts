// hooks/useVoice.ts

import { useRef, useState, useCallback, useEffect } from "react";

interface UseVoiceOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  lang?: string;
}

interface UseVoiceReturn {
  isListening: boolean;
  startListening: () => void;
  stopListening: () => void;
  isSpeaking: boolean;
  speak: (text: string) => void;
  speakStreaming: (text: string) => void;
  flushSpeech: () => void;
  stopSpeaking: () => void;
  sttSupported: boolean;
  ttsSupported: boolean;
}

export function useVoice({
  onTranscript,
  lang = "en-US",
}: UseVoiceOptions = {}): UseVoiceReturn {
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  // ── Streaming TTS state ──────────────────────────────────────────────────
  const sentenceQueueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);
  const streamBufferRef = useRef("");
  const streamActiveRef = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Detect browser support (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSttSupported(
      "SpeechRecognition" in window || "webkitSpeechRecognition" in window
    );
    setTtsSupported("speechSynthesis" in window);
  }, []);

  // Pre-load voices once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener?.("voiceschanged", load);
    return () =>
      window.speechSynthesis.removeEventListener?.("voiceschanged", load);
  }, []);

  // ─────────────────────────────────────────────
  // ✅ Convert HTML → plain text for speech
  // ─────────────────────────────────────────────
  const htmlToSpeechText = (html: string): string => {
    if (typeof window === "undefined") return html;
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    doc
      .querySelectorAll("h1,h2,h3")
      .forEach((el) => {
        el.textContent = el.textContent?.trim() + ". ";
      });
    doc
      .querySelectorAll("p,li")
      .forEach((el) => {
        el.textContent = el.textContent?.trim() + ". ";
      });
    return doc.body.textContent?.replace(/\s+/g, " ").trim() || "";
  };

  // ─────────────────────────────────────────────
  // 🔊 Internal: speak one utterance from queue
  // ─────────────────────────────────────────────
  const drainQueue = useCallback(() => {
    if (speakingRef.current || sentenceQueueRef.current.length === 0) return;

    const sentence = sentenceQueueRef.current.shift()!;
    if (!sentence.trim()) {
      drainQueue();
      return;
    }

    speakingRef.current = true;
    setIsSpeaking(true);

    const voices = voicesRef.current;
    const preferred =
      voices.find(
        (v) =>
          v.lang.startsWith("en") && v.name.toLowerCase().includes("google")
      ) || voices.find((v) => v.lang.startsWith("en"));

    const utterance = new SpeechSynthesisUtterance(sentence);
    utterance.lang = lang;
    utterance.rate = 1.05;
    utterance.pitch = 1;
    if (preferred) utterance.voice = preferred;

    utterance.onend = () => {
      speakingRef.current = false;
      if (sentenceQueueRef.current.length > 0) {
        drainQueue();
      } else if (!streamActiveRef.current) {
        setIsSpeaking(false);
      }
    };

    utterance.onerror = () => {
      speakingRef.current = false;
      drainQueue();
    };

    window.speechSynthesis.speak(utterance);
  }, [lang]);

  // ─────────────────────────────────────────────
  // 🔊 speakStreaming — call with each new chunk
  // ─────────────────────────────────────────────
  const speakStreaming = useCallback(
    (chunk: string) => {
      if (!ttsSupported || typeof window === "undefined") return;

      streamActiveRef.current = true;
      streamBufferRef.current += chunk;

      const sentenceEnd = /([.!?][\s"')\]]*)/g;
      const parts = streamBufferRef.current.split(sentenceEnd);

      const sentences: string[] = [];
      let i = 0;
      while (i < parts.length - 1) {
        const text = parts[i];
        const delim = parts[i + 1] ?? "";
        const sentence = (text + delim).trim();
        if (sentence) sentences.push(sentence);
        i += 2;
      }
      streamBufferRef.current = parts[parts.length - 1] ?? "";

      if (sentences.length > 0) {
        sentenceQueueRef.current.push(...sentences);
        drainQueue();
      }
    },
    [ttsSupported, drainQueue]
  );

  // ─────────────────────────────────────────────
  // 🔊 flushSpeech — call when stream ends
  // ─────────────────────────────────────────────
  const flushSpeech = useCallback(() => {
    streamActiveRef.current = false;
    const tail = streamBufferRef.current.trim();
    streamBufferRef.current = "";

    if (tail) {
      sentenceQueueRef.current.push(tail);
      drainQueue();
    } else if (
      !speakingRef.current &&
      sentenceQueueRef.current.length === 0
    ) {
      setIsSpeaking(false);
    }
  }, [drainQueue]);

  // ─────────────────────────────────────────────
  // 🔊 speak — classic one-shot (for non-streaming use)
  // ─────────────────────────────────────────────
  const speak = useCallback(
    async (text: string) => {
      if (!ttsSupported || !text?.trim() || typeof window === "undefined")
        return;

      stopSpeakingInternal();

      const cleanText = htmlToSpeechText(text);

      const sentences =
        cleanText.match(/[^.!?]+[.!?]+[\s"')\]]*|[^.!?]+$/g) || [cleanText];
      streamActiveRef.current = false;
      sentenceQueueRef.current = sentences.map((s) => s.trim()).filter(Boolean);
      drainQueue();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [ttsSupported, drainQueue]
  );

  // ─────────────────────────────────────────────
  // Internal stop (no state dep)
  // ─────────────────────────────────────────────
  const stopSpeakingInternal = () => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    sentenceQueueRef.current = [];
    streamBufferRef.current = "";
    streamActiveRef.current = false;
    speakingRef.current = false;
  };

  const stopSpeaking = useCallback(() => {
    stopSpeakingInternal();
    setIsSpeaking(false);
  }, []);

  // ─────────────────────────────────────────────
  // 🎙 Speech-to-Text (STT)
  // ─────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!sttSupported || typeof window === "undefined") return;

    const SpeechRecognition =
      window.SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = lang;
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = "";
      let finalText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalText += t;
        else interimText += t;
      }
      if (finalText) onTranscript?.(finalText, true);
      else if (interimText) onTranscript?.(interimText, false);
    };

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };
    recognition.onerror = (e: SpeechRecognitionErrorEvent) => {
      console.error("STT error:", e.error);
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [sttSupported, lang, onTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
  }, []);

  return {
    isListening,
    startListening,
    stopListening,
    isSpeaking,
    speak,
    speakStreaming,
    flushSpeech,
    stopSpeaking,
    sttSupported,
    ttsSupported,
  };
}