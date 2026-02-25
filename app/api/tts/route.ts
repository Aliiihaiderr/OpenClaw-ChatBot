import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text?.trim()) {
      return NextResponse.json({ error: "Missing text" }, { status: 400 });
    }

    const response = await fetch(
      "https://api.deepgram.com/v1/speak?model=aura-luna-en",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error("Deepgram TTS error:", err);
      return NextResponse.json({ error: "TTS failed" }, { status: 500 });
    }

    // ✅ Stream audio directly back to frontend
    return new Response(response.body, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Transfer-Encoding": "chunked",
      },
    });

  } catch (err) {
    console.error("TTS route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}