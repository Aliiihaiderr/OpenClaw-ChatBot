"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

const Avatar = dynamic(() => import("@/components/AvatarCanvas"), { ssr: false });

export default function Home() {
  const [isTalking, setIsTalking] = useState<boolean>(false);
  const [autoRotate, setAutoRotate] = useState<boolean>(false);

  return (
    // Root — establishes stacking context
    <div className="relative w-full h-screen bg-[#0a0a0a] overflow-hidden font-mono" style={{ isolation: 'isolate' }}>

      {/* ── Background glows — z-0 ── */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-[#00d4ff]/5 blur-[120px]" />
        <div className="absolute bottom-0 left-1/4 w-[300px] h-[300px] rounded-full bg-[#ff6b35]/5 blur-[100px]" />
        <div className="absolute top-0 right-1/4 w-[200px] h-[200px] rounded-full bg-[#00d4ff]/4 blur-[80px]" />
      </div>

      {/* ── Scanline — z-0 ── */}
      <div
        className="absolute inset-0 z-0 pointer-events-none opacity-[0.03]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, #ffffff 0px, #ffffff 1px, transparent 1px, transparent 4px)' }}
      />

      {/* ── Canvas — z-10 ── */}
      <div className="absolute inset-0 z-10">
        <Avatar isTalking={isTalking} autoRotate={autoRotate} />
      </div>

      {/* ── ALL UI in one overlay div — z-50 forces above canvas ── */}
      <div className="absolute inset-0 z-50 pointer-events-none">

        {/* Header */}
        <div className="absolute top-6 left-6 flex items-center gap-4">
          <span className="text-xl font-bold tracking-[0.25em] text-white">
            AVATAR<span className="text-[#00d4ff]">.VRM</span>
          </span>
          <span className="text-[10px] text-[#4488aa] tracking-[0.2em] uppercase border border-[#1a3a4a] px-2.5 py-1 rounded-sm">
            VRoid Studio
          </span>
        </div>

        {/* Status badge */}
        <div className="absolute top-6 right-6 flex items-center gap-2 bg-[#0a0a0a]/80 border border-[#1a2a3a] rounded backdrop-blur-sm px-4 py-2">
          <div className={`w-1.5 h-1.5 rounded-full transition-colors duration-300 ${isTalking ? 'bg-[#00d4ff] animate-pulse' : 'bg-[#2a4a5a]'}`} />
          <span className="text-[10px] text-[#4488aa] tracking-widest uppercase">
            {isTalking ? 'Speaking' : 'Idle'}
          </span>
        </div>

        {/* Bottom control panel — pointer-events-auto makes buttons clickable */}
        <div
          className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#0a0a0a]/85 border border-[#1a2a3a] rounded-md backdrop-blur-md px-7 py-5 flex flex-row flex-wrap items-center justify-center gap-6 pointer-events-auto"
        >
          <span className="text-[10px] text-[#4488aa] tracking-[0.3em] uppercase">Controls</span>

          <button
            onClick={() => setIsTalking(true)}
            disabled={isTalking}
            className={`text-[10px] font-bold tracking-widest uppercase border rounded px-4 py-1.5 transition-all duration-200 font-mono
              ${isTalking
                ? 'bg-[#00d4ff] text-[#0a0a0a] border-[#00d4ff] opacity-50 cursor-not-allowed'
                : 'bg-transparent text-[#00d4ff] border-[#00d4ff] hover:bg-[#00d4ff] hover:text-[#0a0a0a] cursor-pointer'
              }`}
          >
            ▶ Talk
          </button>

          <button
            onClick={() => setIsTalking(false)}
            disabled={!isTalking}
            className={`text-[10px] font-bold tracking-widest uppercase border rounded px-4 py-1.5 transition-all duration-200 font-mono
              ${!isTalking
                ? 'bg-transparent text-[#2a4a5a] border-[#2a4a5a] opacity-40 cursor-not-allowed'
                : 'bg-transparent text-[#ff6b35] border-[#ff6b35] hover:bg-[#ff6b35] hover:text-[#0a0a0a] cursor-pointer'
              }`}
          >
            ■ Stop
          </button>

          <div className="w-px h-4 bg-[#1a2a3a]" />

          <div className="flex items-center gap-2.5">
            <span className="text-[10px] text-[#4488aa] tracking-widest uppercase">Rotate</span>
            <button
              onClick={() => setAutoRotate((v) => !v)}
              className={`text-[10px] font-bold tracking-widest border border-[#00d4ff] rounded px-3 py-1 transition-all duration-200 cursor-pointer font-mono
                ${autoRotate ? 'bg-[#00d4ff] text-[#0a0a0a]' : 'bg-[#1a2a3a] text-[#00d4ff]'}`}
            >
              {autoRotate ? 'ON' : 'OFF'}
            </button>
          </div>

          <div className="w-px h-4 bg-[#1a2a3a]" />

          <span className="text-[10px] text-[#2a4a5a] tracking-wide">
            🖱 Drag · Scroll to zoom
          </span>
        </div>

        {/* Corner decorations */}
        <div className="absolute top-4 left-4 w-4 h-4 border-t border-l border-[#00d4ff]/30" />
        <div className="absolute top-4 right-4 w-4 h-4 border-t border-r border-[#00d4ff]/30" />
        <div className="absolute bottom-4 left-4 w-4 h-4 border-b border-l border-[#00d4ff]/30" />
        <div className="absolute bottom-4 right-4 w-4 h-4 border-b border-r border-[#00d4ff]/30" />

      </div>
    </div>
  );
}