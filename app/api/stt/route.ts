import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  try {
    console.log("PROJECT_ID:", process.env.DEEPGRAM_PROJECT_ID);
    console.log("API_KEY:", process.env.DEEPGRAM_API_KEY?.slice(0, 6) + "..."); // partial for safety

    const response = await fetch(
      `https://api.deepgram.com/v1/projects/${process.env.DEEPGRAM_PROJECT_ID}/keys`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          comment: "Temporary STT key",
          scopes: ["usage:write"],
          time_to_live_in_seconds: 30,
        }),
      }
    );

    const data = await response.json();
    console.log("Deepgram response:", JSON.stringify(data)); // 👈 see exact response

    if (!response.ok) {
      return NextResponse.json({ error: "Failed to get STT token" }, { status: 500 });
    }

    return NextResponse.json({ token: data.key });

  } catch (err) {
    console.error("STT route error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}