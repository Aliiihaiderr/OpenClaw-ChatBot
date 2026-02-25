"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import Image from "next/image";
import { useVoice } from "@/hooks/Usevoice";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

type Role = "user" | "assistant";

interface Message {
  role: Role;
  content: string;
  isStreaming?: boolean;
}

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
  const speechQueueRef = useRef<{ text: string; wordCount: number }[]>([]);
  const speakingRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const msPerWordRef = useRef<number>(500);

  const stopAudio = () => {
    try { currentSourceRef.current?.stop(); } catch {}
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
  const { isListening, startListening, stopListening, sttSupported } = useVoice({
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

      cancelCurrentGeneration();

      const currentGeneration = generationRef.current;
      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      // Snapshot committed history BEFORE this exchange
      const baseHistory = committedHistoryRef.current;
      const userMsg: Message = { role: "user", content: text };

      // Layout: [...baseHistory, userMsg, botPlaceholder]
      const botPlaceholderIdx = baseHistory.length + 1;

      setMessages([
        ...baseHistory,
        userMsg,
        { role: "assistant", content: "", isStreaming: true },
      ]);

      setInput("");
      setLoading(true);
      speakingMsgIdxRef.current = botPlaceholderIdx;
      setSpeakingMsgIdx(botPlaceholderIdx);

      // Only updates the bot placeholder slot
      const updateBotSlot = (content: string, isStreaming: boolean) => {
        setMessages((prev) => {
          const updated = [...prev];
          updated[botPlaceholderIdx] = { role: "assistant", content, isStreaming };
          return updated;
        });
      };

      // TTS sentence buffering
      let ttsBuffer = "";

      const flushTTSBuffer = () => {
        if (!ttsBuffer.trim()) return;
        speechQueueRef.current.push({
          text: ttsBuffer.trim(),
          wordCount: ttsBuffer.trim().split(/\s+/).length,
        });
        processSpeechQueue();
      };

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: text, history: baseHistory }),
          signal: abortController.signal,
        });

        if (!res.ok || !res.body) throw new Error("Stream failed");
        if (generationRef.current !== currentGeneration) return;

        setLoading(false);

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let rawMarkdown = "";
        let streamDone = false;

        // Read until [DONE] or stream exhausted
        while (!streamDone) {
          const { done, value } = await reader.read();
          if (done) break;

          if (generationRef.current !== currentGeneration) {
            reader.cancel();
            return;
          }

          const chunk = decoder.decode(value, { stream: true });

          for (const line of chunk.split("\n")) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();

            if (data === "[DONE]") {
              streamDone = true;
              break;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.error) throw new Error(parsed.error);

              if (parsed.token) {
                rawMarkdown += parsed.token;

                const streamingHtml = await marked.parse(rawMarkdown);
                if (generationRef.current !== currentGeneration) return;
                updateBotSlot(streamingHtml, true);

                // ✅ --- PARALLEL TTS LOGIC ---
                const plainChunk = parsed.token
                  // remove bold/italic markers
                  .replace(/[*_~`]+/g, "")
                  // remove markdown links [text](url)
                  .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
                  // remove headers ###
                  .replace(/^#+\s/gm, "")
                  // remove list markers
                  .replace(/^\s*[-*+]\s+/gm, "")
                  // remove extra newlines
                  .replace(/\n+/g, " ");
                ttsBuffer += plainChunk;

                // Intelligent boundary detection
                const boundaryRegex = /(.+?[.!?]+[\s"')\]]*|.+?:\s|.+?\n)/g;

                let match;
                let lastIndex = 0;

                while ((match = boundaryRegex.exec(ttsBuffer)) !== null) {
                  const chunk = match[0].trim();

                  if (chunk.length > 0) {
                    speechQueueRef.current.push({
                      text: chunk,
                      wordCount: chunk.split(/\s+/).length,
                    });
                  }

                  lastIndex = boundaryRegex.lastIndex;
                }

                // Remove processed part
                if (lastIndex > 0) {
                  ttsBuffer = ttsBuffer.slice(lastIndex);
                  processSpeechQueue();
                }

                if (lastIndex === 0) {
                  const words = ttsBuffer.trim().split(/\s+/);

                  if (words.length > 12) {
                    const chunk = words.slice(0, 12).join(" ");

                    speechQueueRef.current.push({
                      text: chunk,
                      wordCount: 12,
                    });

                    ttsBuffer = words.slice(12).join(" ");
                    processSpeechQueue();
                  }
                }

                // if (sentences) {
                //   for (const sentence of sentences) {
                //     speechQueueRef.current.push({
                //       text: sentence.trim(),
                //       wordCount: sentence.trim().split(/\s+/).length,
                //     });
                //   }

                //   processSpeechQueue();

                //   // Remove spoken sentences from buffer
                //   const lastIndex = ttsBuffer.lastIndexOf(sentences[sentences.length - 1]);
                //   ttsBuffer = ttsBuffer.slice(
                //     lastIndex + sentences[sentences.length - 1].length
                //   );
                // }
              }
            } catch {
              // skip malformed SSE lines
            }
          }
        }

        if (generationRef.current !== currentGeneration) return;

        // Finalize: flush TTS, render final HTML, commit history
        flushTTSBuffer();
        const finalHtml = await marked.parse(rawMarkdown);
        updateBotSlot(finalHtml, false);

        // ✅ Commit completed exchange — correct variables, no newHistory
        committedHistoryRef.current = [
          ...baseHistory,
          userMsg,
          { role: "assistant", content: finalHtml },
        ];

      } catch (err: any) {
        if (err?.name === "AbortError") return;
        console.error(err);
        if (generationRef.current !== currentGeneration) return;
        updateBotSlot("⚠️ Failed to get a response.", false);
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
            <ChatMessage role="user" content={liveSpeechBubble} isLive={true} />
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