import { marked } from "marked"

export async function POST(req: Request) {
  try {
    const { message, history } = await req.json()

    if (!message?.trim()) {
      return Response.json({ reply: "" }, { status: 400 })
    }

    const messages = [
      ...(history || []),
      { role: "user", content: message }
    ]

    const response = await fetch("http://127.0.0.1:18789/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer 7e127df48f77b05aaaa6411d6bdac73cf918cc8b5253aa56",
        "Content-Type": "application/json",
        "x-openclaw-agent-id": "main"
      },
      body: JSON.stringify({
        model: "openclaw",
        messages,
        stream: true   // streaming enabled
      })
    })

    if (!response.ok || !response.body) {
      throw new Error("OpenClaw API error")
    }

    // ── Read the full SSE stream and accumulate the text ──
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullText = ""

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value, { stream: true })
      const lines = chunk.split("\n")

      for (const line of lines) {
        // SSE lines look like: data: {...}
        if (!line.startsWith("data:")) continue

        const raw = line.replace(/^data:\s*/, "").trim()

        // Stream ends with this sentinel
        if (raw === "[DONE]") break

        try {
          const parsed = JSON.parse(raw)
          const delta = parsed?.choices?.[0]?.delta?.content
          if (delta) fullText += delta
        } catch {
          // ignore malformed chunks
        }
      }
    }

    if (!fullText) {
      return Response.json({ reply: "No response received." })
    }

    const htmlReply = await marked.parse(fullText)
    return Response.json({ reply: htmlReply })

  } catch (error) {
    console.error("Error:", error)
    return Response.json({ reply: "Something went wrong." }, { status: 500 })
  }
}