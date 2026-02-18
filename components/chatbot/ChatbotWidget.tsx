"use client";

import { useState } from "react";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";
import Image from "next/image";

type Role = 'user' | 'assistant'

interface Message {
  role: Role
  content: string
}

export default function ChatbotWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState<Message[]>([
      { 
        role: "assistant", 
        content:
        "👋 Hi! I'm the Builderz assistant.\n" +
        "Ask me anything about our blockchain development services, projects, or\n" +
        "how we can help bring your Web3 ideas to life!"
      },
    ]);
    const [input, setInput] = useState<string>('')
    const [loading, setLoading] = useState<boolean>(false)

    const sendMessage = async (text: string): Promise<void> => {
        if (!text.trim()) return

        const userMsg: Message = { role: 'user', content: text }
        const newHistory: Message[] = [...messages, userMsg]
        setMessages(newHistory)
        setInput('')
        setLoading(true)

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text, history: messages }),
            })

            if (!res.ok) {
                throw new Error(`HTTP error: ${res.status}`)
            }

            const { reply }: { reply: string } = await res.json()
            setMessages([...newHistory, { role: 'assistant', content: reply }])

        } catch (err) {
            console.error('Chat error:', err)
            setMessages([...newHistory, {
                role: 'assistant',
                content: '⚠️ Failed to get a response. Please try again.'
            }])
        } finally {
            setLoading(false)
        }
    }

  return (
    <>
      {/* Floating Button */}
      <div className="fixed bottom-5 right-5 z-50">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-14 h-14 cursor-pointer rounded-full bg-gray-500 text-white shadow-lg flex items-center justify-center hover:bg-blue-700 transition-all"
        >
          <Image src="/bot.png" alt="Chat" width={54} height={54} />
        </button>
      </div>

      {/* Chat Window */}
      <div
        className={`fixed bottom-24 right-5 w-100 max-w-[95%] h-130 bg-white rounded-2xl shadow-2xl flex flex-col transition-all duration-300 ${
          isOpen ? "opacity-100 translate-y-0" : "opacity-0 translate-y-5 pointer-events-none"
        }`}
      >
        {/* Header */}
        <div className="bg-blue-600 text-white p-4 rounded-t-2xl font-semibold">
          AI Assistant
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {messages.map((m, i) => (
                <ChatMessage key={i} role={m.role} content={m.content} />
            ))}

            {/* ✅ Loading indicator */}
            {loading && (
                <div className="flex justify-start">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm">
                            🤖
                        </div>
                        <div className="px-4 py-2 rounded-2xl rounded-bl-none bg-white border text-sm text-gray-400 flex gap-1 items-center">
                            <span className="animate-bounce [animation-delay:0ms]">•</span>
                            <span className="animate-bounce [animation-delay:150ms]">•</span>
                            <span className="animate-bounce [animation-delay:300ms]">•</span>
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Input — disabled while loading */}
        <ChatInput onSend={sendMessage} disabled={loading} />
      </div>
    </>
  );
}