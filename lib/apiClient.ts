export async function sendMessage(userMessage: string): Promise<string> {
const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: userMessage }),
  })
  const { reply } = await res.json()
  return reply
}
