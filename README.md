OpenClaw-ChatBot
A lightweight Next.js (App Router) chatbot demo that exposes a simple chat API and a React widget UI.

This README documents the current workflow for development, local running, and key files in the repository.

Project structure (high level)
app/ — Next.js App Router pages and API routes

app/api/chat/route.ts — serverless chat API endpoint

page.tsx, layout.tsx — app entry points

components/chatbot/ — React components for the widget

ChatbotWidget.tsx — main widget wrapper

ChatInput.tsx — input/submit UI

ChatMessage.tsx — message rendering

lib/
apiClient.ts — client helper for API requests cuurently we are not using this ..

public/ — static assets

Requirements

Node.js 18+ recommended
npm (or yarn/pnpm)

API & Client
The chat server route is implemented in app/api/chat/route.ts.
Client helpers are provided in lib/apiClient.ts. Update this file if you need custom headers, auth, or retry logic.
Typical client flow:

UI component (ChatInput) POSTs a payload to /api/chat
Server route forwards to model/provider and returns streaming or JSON response
UI (ChatMessage) renders messages and updates state
