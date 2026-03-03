import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <div>
        <h1 className="text-4xl font-bold mb-4">Welcome to the AI Chatbot Demo!</h1>
        <p className="text-lg text-gray-600 mb-6">
          Click the chat icon at the bottom right to start chatting with our AI assistant.
        </p>
        <Link href="/3d-viewer">
          <button className="border border-black px-4 py-2 rounded-md bg-green-600 text-white font-semibold">
            Go to 3D View
          </button>
        </Link>
        {/* <Image
          src="/chatbot-demo.png"
          alt="Chatbot Demo"
          width={600}
          height={400}
          className="rounded-lg shadow-lg"
        />   */}
      </div>
      </main>
  );
}
