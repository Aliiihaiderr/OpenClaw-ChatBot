"use client";

interface Props {
  role: "user" | "bot" | "assistant";
  content: string;
  isSpeaking?: boolean;
  isLive?: boolean;
  isStreaming?: boolean;
}

export default function ChatMessage({
  role,
  content,
  isSpeaking = false,
  isLive = false,
  isStreaming = false,
}: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className="flex items-start gap-2 max-w-[90%]">

        {/* Bot avatar — pulses while speaking */} 
        {!isUser && (
          <div
            className={`relative w-8 min-w-8 h-8 min-h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm flex-shrink-0 transition-all duration-300 ${
              isSpeaking && content ? "ring-2 ring-blue-300 ring-offset-1" : ""
            }`}
          >
            🤖
            {isSpeaking && content && (
              <span className="absolute inset-0 rounded-full bg-blue-400 opacity-40 animate-ping" />
            )}
          </div>
        )}

        <div className="flex flex-col gap-1">
          {/* Message bubble */}
          <div
            className={`px-4 py-2 rounded-2xl text-sm transition-all duration-300 ${
              isUser
                ? isLive
                  ? "bg-blue-400 text-white rounded-br-none opacity-70 border-2 border-blue-300 border-dashed"
                  : "bg-blue-600 text-white rounded-br-none"
                : `bg-white border rounded-bl-none ${
                    isSpeaking ? "border-blue-300 shadow-sm shadow-blue-100" : ""
                  }`
            }`}
          >
            {isUser ? (
              <span>
                {content}
                {isLive && (
                  <span className="inline-block w-[2px] h-3.5 bg-white ml-1 rounded-sm animate-pulse align-middle" />
                )}
              </span>
            ) : isStreaming ? (
              // ── While streaming: render as plain text with a blinking cursor ──
              <span className="text-gray-800 leading-relaxed whitespace-pre-wrap inline-flex items-center gap-1">
                {content}
                {!content && ( 
                  <span className="flex gap-1 ml-1">
                    <span className="animate-bounce [animation-delay:0ms]">•</span>
                    <span className="animate-bounce [animation-delay:150ms]">•</span>
                    <span className="animate-bounce [animation-delay:300ms]">•</span>
                  </span>
                )}
              </span>
            ) : (
              // ── After streaming: render final HTML with full markdown styling ──
              <div
                dangerouslySetInnerHTML={{ __html: content }}
                className="
                  [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2
                  [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2
                  [&_h3]:text-base [&_h3]:font-bold [&_h3]:mt-2 [&_h3]:mb-1
                  [&_p]:mb-2 [&_p]:leading-relaxed
                  [&_ul]:list-disc [&_ul]:list-inside [&_ul]:mb-2 [&_ul]:space-y-1
                  [&_ol]:list-decimal [&_ol]:list-inside [&_ol]:mb-2 [&_ol]:space-y-1
                  [&_li]:ml-2
                  [&_strong]:font-bold [&_strong]:text-gray-900
                  [&_code]:bg-gray-100 [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded [&_code]:text-xs [&_code]:font-mono
                  [&_hr]:my-3 [&_hr]:border-gray-300
                "
              />
            )}
          </div>

          {/* Speaking label */}
          {isSpeaking && content && !isUser && (
            <div className="flex items-center gap-1.5 px-1">
              <div className="flex items-end gap-[2px] h-3">
                {[0, 150, 300, 150, 0].map((delay, i) => (
                  <span
                    key={i}
                    className="w-[3px] bg-blue-400 rounded-full animate-bounce"
                    style={{
                      animationDelay: `${delay}ms`,
                      height: i === 2 ? "12px" : i % 2 === 1 ? "8px" : "5px",
                    }}
                  />
                ))}
              </div>
              <span className="text-[10px] text-blue-400 font-medium tracking-wide">
                Speaking
              </span>
            </div>
          )}

          {/* Live label */}
          {isLive && isUser && (
            <div className="flex items-center justify-end gap-1.5 px-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-400 animate-pulse" />
              <span className="text-[10px] text-gray-400 font-medium tracking-wide">
                Listening…
              </span>
            </div>
          )}
        </div>

        {/* User avatar */}
        {isUser && (
          <div className="w-8 min-w-8 h-8 min-h-8 rounded-full bg-gray-400 text-white flex items-center justify-center text-sm flex-shrink-0">
            👤
          </div>
        )}
      </div>
    </div>
  );
}