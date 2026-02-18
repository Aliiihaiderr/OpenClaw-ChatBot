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
          <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm">
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
          {content}
        </div>

        {isUser && (
          <div className="w-8 h-8 rounded-full bg-gray-400 text-white flex items-center justify-center text-sm">
            👤
          </div>
        )}
      </div>
    </div>
  );
}
