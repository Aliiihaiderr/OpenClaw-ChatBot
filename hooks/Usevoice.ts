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

  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [sttSupported, setSttSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);

  // ── Deepgram STT refs ─────────────────────────────────────────────────────
  const socketRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // ── Streaming TTS state ───────────────────────────────────────────────────
  const sentenceQueueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);
  const streamBufferRef = useRef("");
  const streamActiveRef = useRef(false);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);

  // Detect browser support (client-side only)
  useEffect(() => {
    if (typeof window === "undefined") return;
    setSttSupported(true); // always true with Deepgram
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
    doc.querySelectorAll("h1,h2,h3").forEach((el) => {
      el.textContent = el.textContent?.trim() + ". ";
    });
    doc.querySelectorAll("p,li").forEach((el) => {
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
  // 🎙 STT — Deepgram via WebSocket
  // ─────────────────────────────────────────────
  const startListening = useCallback(async () => {
    if (typeof window === "undefined") return;

    try {
      // 1️⃣ Get short-lived token from backend
      const res = await fetch("/api/stt");
      const { token } = await res.json();

      if (!token) {
        console.error("No STT token received");
        return;
      }

      // 2️⃣ Open Deepgram WebSocket with token
      const socket = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-2&language=en&interim_results=true&punctuate=true&endpointing=300`,
        ["token", token]
      );

      socketRef.current = socket;

      socket.onopen = async () => {
        try {
          // 3️⃣ Request mic access
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: true,
          });
          streamRef.current = micStream;

          // 4️⃣ Start MediaRecorder — send 250ms chunks
          const recorder = new MediaRecorder(micStream, {
            mimeType: "audio/webm",
          });
          recorderRef.current = recorder;

          recorder.ondataavailable = (e) => {
            if (e.data.size > 0 && socket.readyState === WebSocket.OPEN) {
              socket.send(e.data);
            }
          };

          recorder.start(250);
          setIsListening(true);
        } catch (micErr) {
          console.error("Mic access error:", micErr);
          socket.close();
        }
      };

      // 5️⃣ Receive transcripts from Deepgram
      socket.onmessage = (msg) => {
        try {
          const data = JSON.parse(msg.data);
          const transcript =
            data?.channel?.alternatives?.[0]?.transcript ?? "";
          const isFinal = data?.is_final ?? false;

          if (transcript.trim()) {
            onTranscript?.(transcript, isFinal);
          }
        } catch (parseErr) {
          console.error("Deepgram parse error:", parseErr);
        }
      };

      socket.onerror = (e) => {
        console.error("Deepgram WebSocket error:", e);
        stopListening();
      };

      socket.onclose = () => {
        setIsListening(false);
      };
    } catch (err) {
      console.error("STT start error:", err);
      setIsListening(false);
    }
  }, [onTranscript]);

  const stopListening = useCallback(() => {
    // Stop MediaRecorder
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    // Stop mic tracks
    streamRef.current?.getTracks().forEach((t) => t.stop());
    // Send CloseStream then close WebSocket
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type: "CloseStream" }));
      socketRef.current.close();
    }

    recorderRef.current = null;
    streamRef.current = null;
    socketRef.current = null;
    setIsListening(false);
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