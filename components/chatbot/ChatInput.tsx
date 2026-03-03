"use client";

import { useState } from "react";

interface Props {
  onSend: (message: string) => void;
  disabled?: boolean;
  // voice props (passed from ChatbotWidget)
  interimTranscript?: string;
  isListening?: boolean;
  onMicToggle?: () => void;
  sttSupported?: boolean;
  // controlled input (typed text only — voice auto-sends now)
  voiceInput?: string;
  setVoiceInput?: (val: string) => void;
}

export default function ChatInput({
  onSend,
  disabled = false,
  interimTranscript = "",
  isListening = false,
  onMicToggle,
  sttSupported = false,
  voiceInput = "",
  setVoiceInput,
}: Props) {
  const [localText, setLocalText] = useState("");

  // If parent controls input via voice, use that; otherwise use local state
  const isControlled = !!setVoiceInput;
  const text = isControlled ? voiceInput : localText;
  const setText = isControlled ? setVoiceInput! : setLocalText;

  const handleSend = () => {
    if (!text.trim() || disabled) return;
    onSend(text);
    setText("");
  };

  return (
    <div className="p-3 border-t bg-white rounded-b-2xl">

      {isListening && !interimTranscript && (
        <p className="text-xs text-gray-400 italic px-1 mb-1 flex items-center gap-1">
          <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse" />
          Listening… speak now
        </p>
      )}

      <div className="flex items-center gap-2">
        {/* Text input — for typed messages; disabled/styled while listening */}
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            isListening
              ? "Speak now — your words appear above ↑"
              : disabled
              ? "Waiting for response..."
              : "Type a message..."
          }
          disabled={disabled || isListening} // disable typing while mic is active to avoid confusion
          onKeyDown={(e) => e.key === "Enter" && handleSend()}
          className={`flex-1 px-3 py-2 border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100 disabled:text-gray-400 transition-colors ${
            isListening ? "border-red-300 bg-red-50 cursor-not-allowed" : ""
          }`}
        />

        {/* Mic button — only rendered if browser supports Web Speech API */}
        {sttSupported && onMicToggle && (
          <button
            onClick={onMicToggle}
            disabled={disabled}
            title={isListening ? "Stop listening" : "Speak your message"}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-40 ${
              isListening
                ? "bg-red-500 text-white animate-pulse shadow-md shadow-red-200"
                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
            }`}
          >
            {isListening ? (
              // Stop square icon
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-3.5 h-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="5" y="5" width="14" height="14" rx="2" />
              </svg>
            ) : (
              // Mic icon
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm6.364 9.636a1 1 0 0 1 1 1A7.364 7.364 0 0 1 13 18.931V21h2a1 1 0 1 1 0 2H9a1 1 0 1 1 0-2h2v-2.069A7.364 7.364 0 0 1 4.636 11.636a1 1 0 0 1 2 0A5.364 5.364 0 0 0 12 17a5.364 5.364 0 0 0 5.364-5.364 1 1 0 0 1 1-1z" />
              </svg>
            )}
          </button>
        )}

        {/* Send button — hidden while listening since voice auto-sends */}
        {!isListening && (
          <button
            onClick={handleSend}
            disabled={disabled || !text.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-full hover:bg-blue-700 transition disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ➤
          </button>
        )}
      </div>
    </div>
  );
}