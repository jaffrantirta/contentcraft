"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"

const messages = [
  "reading your brief...",
  "picking the right vibe...",
  "composing the layout...",
  "mixing your palette...",
  "writing the captions...",
  "generating visuals...",
  "layering the details...",
  "almost ready...",
]

const floatingShapes = [
  { x: 12, y: 70, size: 10, color: "#FF6B6B", delay: 0 },
  { x: 80, y: 60, size: 8,  color: "#00B4D8", delay: 0.6 },
  { x: 25, y: 40, size: 6,  color: "#52B788", delay: 1.2 },
  { x: 70, y: 75, size: 12, color: "#C77DFF", delay: 0.3 },
  { x: 50, y: 80, size: 7,  color: "#FFD700", delay: 0.9 },
  { x: 90, y: 45, size: 9,  color: "#FF8FAB", delay: 1.5 },
  { x: 5,  y: 55, size: 6,  color: "#00FF41", delay: 0.7 },
]

const paletteColors = ["#FF6B6B", "#00B4D8", "#52B788", "#C77DFF", "#FFD700"]

export function GeneratingAnimation({ slideCount = 3 }: { slideCount?: number }) {
  const [msgIndex, setMsgIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setMsgIndex(i => (i + 1) % messages.length), 1800)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="fixed inset-0 z-50 bg-background/97 backdrop-blur-sm flex flex-col items-center justify-center overflow-hidden select-none">

      {/* floating particles */}
      {floatingShapes.map((s, i) => (
        <div
          key={i}
          className="absolute rounded-full pointer-events-none"
          style={{
            left: `${s.x}%`,
            top: `${s.y}%`,
            width: s.size,
            height: s.size,
            backgroundColor: s.color,
            animation: `cc-float 3.2s ease-in infinite`,
            animationDelay: `${s.delay}s`,
          }}
        />
      ))}

      {/* corner accents */}
      <div className="absolute top-8 left-8 text-[10px] text-muted-foreground/40 font-mono tracking-widest">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-px w-8 bg-border/40 mb-1" style={{ width: 8 + i * 6 }} />
        ))}
      </div>
      <div className="absolute top-8 right-8 opacity-20">
        {paletteColors.map((c, i) => (
          <div
            key={i}
            className="w-3 h-3 rounded-sm mb-0.5 ml-auto"
            style={{
              backgroundColor: c,
              animation: `cc-pop 0.4s ease both`,
              animationDelay: `${i * 0.12}s`,
            }}
          />
        ))}
      </div>

      {/* main artboard */}
      <div className="relative mb-8">
        <div
          className="w-52 h-72 rounded-2xl bg-card shadow-2xl relative overflow-hidden border border-border/40"
          style={{ animation: "cc-fade-up 0.5s ease both" }}
        >
          {/* SVG border draw effect */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ borderRadius: 16 }}>
            <rect
              x="1" y="1" width="206" height="286" rx="15"
              fill="none"
              stroke="hsl(var(--primary))"
              strokeWidth="1.5"
              strokeDasharray="900"
              style={{ animation: "cc-draw-border 1.8s ease forwards" }}
            />
          </svg>

          {/* header gradient block */}
          <div
            className="h-16 w-full"
            style={{
              background: "linear-gradient(135deg, #C77DFF 0%, #00B4D8 100%)",
              animation: "cc-slide-in 0.5s ease both",
              animationDelay: "0.3s",
              opacity: 0,
            }}
          />

          {/* image shimmer area */}
          <div
            className="mx-3 mt-3 h-24 rounded-lg overflow-hidden"
            style={{
              animation: "cc-fade-up 0.4s ease both",
              animationDelay: "0.6s",
              opacity: 0,
            }}
          >
            <div
              className="w-full h-full"
              style={{
                background: "linear-gradient(90deg, hsl(var(--muted)) 25%, hsl(var(--border)) 50%, hsl(var(--muted)) 75%)",
                backgroundSize: "300% 100%",
                animation: "cc-shimmer 1.8s linear infinite",
              }}
            />
          </div>

          {/* text lines */}
          {[{ w: "80%", delay: "0.9s" }, { w: "60%", delay: "1.1s" }, { w: "70%", delay: "1.3s" }].map((line, i) => (
            <div
              key={i}
              className="mx-3 mt-2.5 h-2.5 rounded-full bg-muted-foreground/20"
              style={{
                width: line.w,
                animation: "cc-slide-in 0.35s ease both",
                animationDelay: line.delay,
                opacity: 0,
              }}
            />
          ))}

          {/* cta pill */}
          <div
            className="mx-3 mt-4 h-7 rounded-full flex items-center justify-center gap-1"
            style={{
              background: "linear-gradient(135deg, #FF6B6B, #FFD700)",
              animation: "cc-pop 0.4s ease both",
              animationDelay: "1.6s",
              opacity: 0,
            }}
          >
            <div className="w-2 h-2 rounded-full bg-white/60" />
            <div className="w-12 h-1.5 rounded-full bg-white/50" />
          </div>

          {/* slide count badge */}
          <div
            className="absolute top-3 right-3 bg-background/80 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-[9px] font-mono text-muted-foreground"
            style={{ animation: "cc-pop 0.3s ease both", animationDelay: "2s", opacity: 0 }}
          >
            {slideCount} slides
          </div>
        </div>

        {/* orbiting palette dots */}
        <div className="absolute -right-5 top-1/2 -translate-y-1/2 flex flex-col gap-1.5">
          {paletteColors.map((c, i) => (
            <div
              key={i}
              className="w-3 h-3 rounded-full border border-background shadow-sm"
              style={{
                backgroundColor: c,
                animation: `cc-pop 0.3s ease both`,
                animationDelay: `${1.4 + i * 0.1}s`,
                opacity: 0,
              }}
            />
          ))}
        </div>
      </div>

      {/* label */}
      <div
        className="flex items-center gap-1.5 mb-3"
        style={{ animation: "cc-fade-up 0.4s ease both", animationDelay: "0.2s" }}
      >
        <Sparkles className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-mono text-muted-foreground tracking-widest uppercase">design studio</span>
        <Sparkles className="h-3 w-3 text-muted-foreground" />
      </div>

      {/* cycling message */}
      <p
        key={msgIndex}
        className="text-sm font-medium text-foreground/80 mb-4"
        style={{ animation: "cc-fade-up 0.3s ease both" }}
      >
        {messages[msgIndex]}
      </p>

      {/* animated bars */}
      <div className="flex items-end gap-1 h-5">
        {[0, 1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="w-1 rounded-full bg-primary/60"
            style={{
              animation: "cc-blink 0.9s ease-in-out infinite",
              animationDelay: `${i * 0.15}s`,
              height: 6 + (i % 3) * 6,
            }}
          />
        ))}
      </div>
    </div>
  )
}
