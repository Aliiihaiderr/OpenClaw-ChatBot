import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

type Role = 'user' | 'assistant'
interface Message { role: Role; content: string }

export async function POST(req: Request) {
  try {
    const { message }: { message: string; history: Message[] } = await req.json()

    if (!message?.trim()) {
      return Response.json({ reply: '' }, { status: 400 })
    }

    const escaped = message
      .replace(/\\/g, '\\\\')
      .replace(/"/g, '\\"')

    const { stdout, stderr } = await execAsync(
      `openclaw agent --agent main --message "${escaped}"`,
      {
        timeout: 60_000,
        windowsHide: true,
      }
    )

    console.log('raw stdout:', JSON.stringify(stdout))
    if (stderr) console.log('stderr:', stderr)
    const spinnerChars = new Set(['|', '/', '-', '\\', 'o', '◒', '◐', '◓', '◑', '●', '○'])

    const lines = stdout
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)

    // Filter out single-character spinner lines
    const replyLines = lines.filter(l => {
      if (l.length <= 2 && spinnerChars.has(l)) return false
      // Also filter out the openclaw banner lines
      if (l.startsWith('🦞')) return false
      if (l.includes('DeprecationWarning')) return false
      return true
    })
    const reply = replyLines.join('\n').trim() || 'No response received.'
    return Response.json({ reply })

  } catch (error: unknown) {
    console.error('API route error:', error)
    const err = error as { stdout?: string; stderr?: string; message?: string }
    if (err?.stdout) {
      const lines = err.stdout.split('\n').map((l: string) => l.trim()).filter((l: string) => l && l.length > 2)
      const reply = lines[lines.length - 1]
      if (reply) return Response.json({ reply })
    }
    const detail = err?.stderr || err?.message || 'Unknown error'
    return Response.json(
      { reply: `⚠️ Agent error: ${detail.slice(0, 300)}` },
      { status: 200 }
    )
  }
}