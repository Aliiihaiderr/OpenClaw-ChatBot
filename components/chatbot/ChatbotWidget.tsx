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

const SPEECH_RATE = 1.20;
const AVERAGE_WORDS_PER_MINUTE = 160 * SPEECH_RATE;
const WORD_DELAY_MS = 60000 / AVERAGE_WORDS_PER_MINUTE;

export default function ChatbotWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content:
        "👋 Hi! I'm the Builderz assistant.\n" +
        "Ask me anything about our blockchain development services, projects, or\n" +
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

  // ───────────── TTS Queue System ─────────────
  const speechQueueRef = useRef<string[]>([]);
  const speakingRef = useRef(false);

  const processSpeechQueue = useCallback(() => {
    if (speakingRef.current) return;
    if (speechQueueRef.current.length === 0) {
      speakingMsgIdxRef.current = -1;
      setSpeakingMsgIdx(-1);
      return;
    }

    speakingRef.current = true;
    const text = speechQueueRef.current.shift()!;
    const utterance = new SpeechSynthesisUtterance(text);

    utterance.rate = SPEECH_RATE;
    utterance.pitch = 1;

    utterance.onend = () => {
      speakingRef.current = false;
      processSpeechQueue();
    };

    window.speechSynthesis.speak(utterance);
  }, []);

  const resetSpeechSystem = () => {
    window.speechSynthesis.cancel();
    speechQueueRef.current = [];
    speakingRef.current = false;
    speakingMsgIdxRef.current = -1;
    setSpeakingMsgIdx(-1);
  };

  // ───────────── Voice Hook ─────────────
  const {
    isListening,
    startListening,
    stopListening,
    isSpeaking,
    stopSpeaking,
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

      resetSpeechSystem();

      const userMsg: Message = { role: "user", content: text };
      const historySnapshot = [...messages];
      const newHistory: Message[] = [...messages, userMsg];
      const botPlaceholderIdx = newHistory.length;

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
          body: JSON.stringify({ message: text, history: historySnapshot }),
        });

        const { reply }: { reply: string } = await res.json();
        setLoading(false);

        const plainText = reply
          .replace(/<[^>]+>/g, " ")
          .replace(/\s+/g, " ")
          .trim();

        const words = plainText.split(" ").filter(Boolean);

        // ── Parallel: stream words visually at WORD_DELAY_MS pace ──
        const streamWords = async () => {
          let displayed = "";
          for (let i = 0; i < words.length; i++) {
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
            await new Promise((r) => setTimeout(r, WORD_DELAY_MS));
          }
          // Final: replace with HTML version
          setMessages((prev) => {
            const updated = [...prev];
            updated[botPlaceholderIdx] = {
              role: "assistant",
              content: reply,
              isStreaming: false,
            };
            return updated;
          });
        };

        // ── Parallel: queue TTS sentences immediately ──
        const queueTTS = () => {
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
              speechQueueRef.current.push(sentenceBuffer.trim());
              sentenceBuffer = "";
              bufferWordCount = 0;
              processSpeechQueue();
            }
          }
        };

        // 🔥 Run both in parallel — TTS starts immediately, stream runs on its own timer
        queueTTS();        // synchronous, queues all sentences instantly
        await streamWords(); // async, streams word-by-word at visual pace

      } catch (err) {
        console.error(err);
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
        setLoading(false);
      }
    },
    [messages, processSpeechQueue]
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