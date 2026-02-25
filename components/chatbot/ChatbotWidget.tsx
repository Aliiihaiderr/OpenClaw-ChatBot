"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import Image from "next/image";
import { useVoice } from "@/hooks/Usevoice";

type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
  isStreaming?: boolean;
}

// const SPEECH_RATE = 1.12;
// const AVERAGE_WORDS_PER_MINUTE = 150 * SPEECH_RATE;
// const WORD_DELAY_MS = 500;

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm the Builderz assistant.\n" +
        "Ask me anything about our blockchain development services, projects, or\n  " +
        "how we can help bring your Web3 ideas to life!",
    },
  ]);

  // ✅ Tracks only FULLY COMPLETED exchanges (no streaming, no partial)
  const committedHistoryRef = useRef<Message[]>([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm the Builderz assistant.\n" +
        "Ask me anything about our blockchain development services, projects, or\n  " +
        "how we can help bring your Web3 ideas to life!",
    },
  ]);

  const [input, setInput] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [interimTranscript, setInterimTranscript] = useState<string>("");
  const [liveSpeechBubble, setLiveSpeechBubble] = useState<string>("");
  const [speakingMsgIdx, setSpeakingMsgIdx] = useState<number>(-1);

  const speakingMsgIdxRef = useRef<number>(-1);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const abortControllerRef = useRef<AbortController | null>(null);
  const generationRef = useRef<number>(0);

  // ───────────── TTS Queue System ─────────────
  // ───────────── TTS Queue System ─────────────
  // ───────────── TTS Queue System ─────────────
  const speechQueueRef = useRef<{ text: string; wordCount: number }[]>([]);
  const speakingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // ✅ Tracks ms-per-word based on actual audio duration
  const msPerWordRef = useRef<number>(500);

  const stopAudio = () => {
    try {
      currentSourceRef.current?.stop();
    } catch {}
    currentSourceRef.current = null;
    speakingRef.current = false;
  };

  const processSpeechQueue = useCallback(async () => {
    if (speakingRef.current) return;
    if (speechQueueRef.current.length === 0) {
      speakingMsgIdxRef.current = -1;
      setSpeakingMsgIdx(-1);
      return;
    }

    speakingRef.current = true;
    const { text, wordCount } = speechQueueRef.current.shift()!;

    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!res.ok) throw new Error("TTS fetch failed");

      const arrayBuffer = await res.arrayBuffer();

      if (!audioCtxRef.current) {
        audioCtxRef.current = new AudioContext();
      }
      const audioCtx = audioCtxRef.current;

      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

      // ✅ Calculate actual ms-per-word from real audio duration
      const audioDurationMs = audioBuffer.duration * 1000;
      msPerWordRef.current = Math.round(audioDurationMs / wordCount);

      const source = audioCtx.createBufferSource();
      currentSourceRef.current = source;
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);

      source.onended = () => {
        currentSourceRef.current = null;
        speakingRef.current = false;
        processSpeechQueue();
      };

      source.start();
    } catch (err) {
      console.error("TTS playback error:", err);
      speakingRef.current = false;
      processSpeechQueue();
    }
  }, []);

  const resetSpeechSystem = () => {
    stopAudio();
    speechQueueRef.current = [];
    speakingMsgIdxRef.current = -1;
    setSpeakingMsgIdx(-1);
  };

  const cancelCurrentGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    generationRef.current += 1;
    resetSpeechSystem();
  };

  // ───────────── Voice Hook ─────────────
  const {
    isListening,
    startListening,
    stopListening,
    sttSupported,
  } = useVoice({
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        setLiveSpeechBubble("");
        setInterimTranscript("");
        sendMessage(text);
      } else {
        setLiveSpeechBubble(text);
        setInterimTranscript(text);
      }
    },
  });

  const handleMicToggle = () => {
    if (isListening) {
      stopListening();
      setLiveSpeechBubble("");
      setInterimTranscript("");
    } else {
      resetSpeechSystem();
      startListening();
    }
  };

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, liveSpeechBubble]);

  // ───────────── SEND MESSAGE ─────────────
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim()) return;

      // ✅ Cancel previous generation
      cancelCurrentGeneration();

      const currentGeneration = generationRef.current;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // ✅ Always read from committedHistoryRef — never from React state
      // This is always clean: only fully completed exchanges
      const baseHistory = committedHistoryRef.current;

      const userMsg: Message = { role: "user", content: text };
      const newHistory: Message[] = [...baseHistory, userMsg];
      const botPlaceholderIdx = newHistory.length;

      // ✅ Set UI with committed history + new user msg + empty bot placeholder
      setMessages([
        ...newHistory,
        { role: "assistant", content: "", isStreaming: true },
      ]);

      setInput("");
      setLoading(true);
      speakingMsgIdxRef.current = botPlaceholderIdx;
      setSpeakingMsgIdx(botPlaceholderIdx);

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          // ✅ Send only committed history to OpenClaw (no partial responses)
          body: JSON.stringify({ message: text, history: baseHistory }),
          signal: abortController.signal,
        });

        if (generationRef.current !== currentGeneration) return;

        const { reply }: { reply: string } = await res.json();
        setLoading(false);

        const plainText = reply
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        const words = plainText.split(" ").filter(Boolean);

        const streamWords = async () => {
          let displayed = "";
          for (let i = 0; i < words.length; i++) {
            if (generationRef.current !== currentGeneration) return;

            displayed += (i === 0 ? "" : " ") + words[i];
            setMessages((prev) => {
              const updated = [...prev];
              updated[botPlaceholderIdx] = {
                role: "assistant",
                content: displayed,
                isStreaming: true,
              };
              return updated;
            });

            // ✅ Use dynamic ms-per-word synced to actual audio speed
            await new Promise((r) => setTimeout(r, msPerWordRef.current));
          }

          if (generationRef.current !== currentGeneration) return;

          setMessages((prev) => {
            const updated = [...prev];
            updated[botPlaceholderIdx] = {
              role: "assistant",
              content: reply,
              isStreaming: false,
            };
            return updated;
          });

          committedHistoryRef.current = [
            ...newHistory,
            { role: "assistant", content: reply, isStreaming: false },
          ];
        };

        const queueTTS = () => {
          if (generationRef.current !== currentGeneration) return;

          const MIN_WORDS_BEFORE_SPEAK = 12;
          let sentenceBuffer = "";
          let bufferWordCount = 0;

          for (let i = 0; i < words.length; i++) {
            const word = words[i];
            sentenceBuffer += (sentenceBuffer ? " " : "") + word;
            bufferWordCount++;

            const sentenceEnded = /[.!?,—:]$/.test(word);

            if (
              (bufferWordCount >= MIN_WORDS_BEFORE_SPEAK && sentenceEnded) ||
              i === words.length - 1
            ) {
              // ✅ Pass wordCount so TTS can calculate ms-per-word
              speechQueueRef.current.push({
                text: sentenceBuffer.trim(),
                wordCount: bufferWordCount,
              });
              sentenceBuffer = "";
              bufferWordCount = 0;
              processSpeechQueue();
            }
          }
        };

        queueTTS();
        await streamWords();

      } catch (err: any) {
        if (err?.name === "AbortError") return;

        console.error(err);
        if (generationRef.current !== currentGeneration) return;

        setMessages((prev) => {
          const updated = [...prev];
          updated[botPlaceholderIdx] = {
            role: "assistant",
            content: "⚠️ Failed to get a response.",
            isStreaming: false,
          };
          return updated;
        });
        resetSpeechSystem();
      } finally {
        if (generationRef.current === currentGeneration) {
          setLoading(false);
        }
      }
    },
    [processSpeechQueue]
  );

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-5 right-5 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 rounded-full bg-gray-500 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 transition-all"
        >
          <Image src="/bot.png" alt="Chat" width={54} height={54} />
        </button>
      </div>

      {/* Chat Window */}
      <div
        className={`fixed bottom-24 right-5 w-100 max-w-[95%] h-130 bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ${
          isOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-5 pointer-events-none"
        }`}
      >
        <div className="bg-blue-600 text-white p-4 rounded-t-2xl font-semibold">
          AI Assistant
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.map((m, i) => (
            <ChatMessage
              key={i}
              role={m.role}
              content={m.content}
              isSpeaking={i === speakingMsgIdx}
              isStreaming={m.isStreaming}
            />
          ))}

          {liveSpeechBubble && (
            <ChatMessage
              role="user"
              content={liveSpeechBubble}
              isLive={true}
            />
          )}

          <div ref={messagesEndRef} />
        </div>

        <ChatInput
          onSend={sendMessage}
          disabled={loading}
          voiceInput={input}
          setVoiceInput={setInput}
          interimTranscript={interimTranscript}
          isListening={isListening}
          onMicToggle={handleMicToggle}
          sttSupported={sttSupported}
        />
      </div>
    </>
  );
}