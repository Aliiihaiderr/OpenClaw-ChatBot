interface Props {
  role: "user" | "bot" | "assistant";
  content: string;
}

export default function ChatMessage({ role, content }: Props) {
  const isUser = role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div className={`flex items-start gap-2 max-w-[90%]`}>
        {!isUser && (
          <div className="w-8 min-w-8 h-8 min-h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm">
            🤖
          </div>
        )}

        <div
          className={`px-4 py-2 rounded-2xl text-sm ${
            isUser
              ? "bg-blue-600 text-white rounded-br-none"
              : "bg-white border rounded-bl-none"
          }`}
        >
          {isUser ? (
            content
          ) : (
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

        {isUser && (
          <div className="w-8 min-w-8 h-8 min-h-8 rounded-full bg-gray-400 text-white flex items-center justify-center text-sm">
            👤
          </div>
        )}
      </div>
    </div>
  );
}
