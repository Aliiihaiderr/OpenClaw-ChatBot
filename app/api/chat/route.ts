// src/app/api/chat/route.ts
import { exec } from "child_process";
import { marked } from "marked";

marked.setOptions({ breaks: true, gfm: true });

const delay = (ms: number) => new Promise((res) => setTimeout(res, ms));

function stripAnsi(str: string): string {
  return str
    .replace(/\x1B\[[0-9;]*[A-Za-z]/g, "")
    .replace(/\x1B\][^\x07]*\x07/g, "")
    .replace(/[\x00-\x09\x0B\x0C\x0E-\x1F\x7F]/g, "");
}

const JUNK_RE = /DeprecationWarning|ExperimentalWarning|^\s*🦞|^\s*[|\/\-\\o◒◐◓◑●○┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌]\s*$|^◇\s*$|^│\s*$/;

function isJunk(line: string): boolean {
  const t = line.trim();
  if (!t) return true;
  if (JUNK_RE.test(t)) return true;
  return false;
}

export async function POST(req: Request) {
  const { message } = await req.json();

  if (!message?.trim()) {
    return new Response("Bad request", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (token: string) => {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ token })}\n\n`)
        );
      };

      // ✅ Escape the message for shell — replace " with \" 
      const escaped = message.replace(/"/g, '\\"');
      const cmd = `openclaw agent --agent main --message "${escaped}"`;

      const result = await new Promise<{ stdout: string; stderr: string }>(
        (resolve) => {
          exec(cmd, { timeout: 120_000, windowsHide: true }, (err, stdout, stderr) => {
            resolve({ stdout: stdout || "", stderr: stderr || "" });
          });
        }
      );

      if (req.signal?.aborted) {
        controller.close();
        return;
      }

      console.log("=== STDOUT ===\n", JSON.stringify(result.stdout));
      console.log("=== STDERR ===\n", JSON.stringify(result.stderr));

      // Clean the output — strip ANSI, remove junk lines
      const fullText = stripAnsi(result.stdout)
        .split("\n")
        .filter((l) => !isJunk(l))
        .map((l) => l.trim())
        .filter(Boolean)
        .join("\n")
        .trim();

      console.log("=== FINAL TEXT ===\n", JSON.stringify(fullText));

      if (!fullText) {
        send("⚠️ No response received from agent.\n");
        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
        controller.close();
        return;
      }

      // Stream word by word
      const WORD_DELAY_MS = 40;
      for (const token of fullText.split(/(\s+)/)) {
        if (req.signal?.aborted) break;
        if (token) {
          send(token);
          await delay(WORD_DELAY_MS);
        }
      }

      controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}