import OpenAI from "openai"
import {
  PartyPopper, Coffee, Zap, Briefcase, Sparkles, Moon, Flame, Square,
  Camera, Pencil, Box, Shapes, Drama, Paintbrush, Waves, Minus,
  AlignLeft, AlignCenter, AlignRight,
  Bold, Type, CaseSensitive, PenLine, Star,
  type LucideIcon,
} from "lucide-react"

interface TokenRouterConfig {
  apiKey?: string
  baseURL?: string
  model?: string
}

export function getTokenRouterClient(config?: TokenRouterConfig) {
  return new OpenAI({
    apiKey: config?.apiKey || process.env.TOKENROUTER_API_KEY!,
    baseURL: config?.baseURL || process.env.TOKENROUTER_BASE_URL || "https://tokenrouter.com/v1",
  })
}

export const DEFAULT_IMAGE_MODEL = process.env.TOKENROUTER_IMAGE_MODEL || "openai/gpt-5.4-image-2"
export const DEFAULT_CHAT_MODEL = process.env.TOKENROUTER_CHAT_MODEL || "MiniMax-M3"

export const VIBES: { id: string; label: string; icon: LucideIcon; description: string }[] = [
  { id: "fun", label: "fun", icon: PartyPopper, description: "playful, energetic, colorful" },
  { id: "chill", label: "chill", icon: Coffee, description: "relaxed, soft, minimal" },
  { id: "shock", label: "shock", icon: Zap, description: "bold, high contrast, dramatic" },
  { id: "professional", label: "professional", icon: Briefcase, description: "clean, corporate, trustworthy" },
  { id: "aesthetic", label: "aesthetic", icon: Sparkles, description: "artsy, soft tones, trendy" },
  { id: "dark", label: "dark", icon: Moon, description: "moody, deep colors, mysterious" },
  { id: "warm", label: "warm", icon: Flame, description: "cozy, earthy, welcoming" },
  { id: "minimal", label: "minimal", icon: Square, description: "white space, simple, elegant" },
]

export const COLOR_PALETTES = [
  { id: "sunset", name: "sunset", colors: ["#FF6B6B", "#FFA07A", "#FFD700"] },
  { id: "ocean", name: "ocean", colors: ["#0077B6", "#00B4D8", "#90E0EF"] },
  { id: "forest", name: "forest", colors: ["#2D6A4F", "#52B788", "#B7E4C7"] },
  { id: "lavender", name: "lavender", colors: ["#7B2FBE", "#C77DFF", "#E0AAFF"] },
  { id: "midnight", name: "midnight", colors: ["#1A1A2E", "#16213E", "#0F3460"] },
  { id: "peach", name: "peach", colors: ["#FF8FAB", "#FFB3C1", "#FFCCD5"] },
  { id: "earth", name: "earth", colors: ["#6B4226", "#A0522D", "#DEB887"] },
  { id: "mono", name: "mono", colors: ["#1A1A1A", "#555555", "#CCCCCC"] },
  { id: "neon", name: "neon", colors: ["#00FF41", "#FF00FF", "#00FFFF"] },
  { id: "pastel", name: "pastel", colors: ["#FFD6E0", "#C1E1C1", "#BDE0FE"] },
] as const

export const DESIGN_STYLES: { id: string; label: string; icon: LucideIcon; description: string }[] = [
  { id: "realistic",    label: "realistic",    icon: Camera,     description: "photorealistic, real-world photography" },
  { id: "illustration", label: "illustration", icon: Pencil,     description: "hand-drawn, illustrated artwork" },
  { id: "3d",           label: "3d render",    icon: Box,        description: "3D CGI, glossy materials, depth" },
  { id: "flat",         label: "flat design",  icon: Shapes,     description: "clean geometric shapes, bold colors" },
  { id: "anime",        label: "anime",        icon: Drama,      description: "japanese anime / manga style" },
  { id: "watercolor",   label: "watercolor",   icon: Paintbrush, description: "soft watercolor painting, organic edges" },
  { id: "abstract",     label: "abstract",     icon: Waves,      description: "abstract art, shapes and textures" },
  { id: "minimal",      label: "minimal",      icon: Minus,      description: "ultra-minimal, line art, lots of white space" },
]

export const TEXT_POSITIONS: { id: string; label: string; icon: LucideIcon; description: string }[] = [
  { id: "auto",   label: "auto",   icon: Sparkles,    description: "AI picks the best placement" },
  { id: "left",   label: "left",   icon: AlignLeft,   description: "text anchored to the left side" },
  { id: "center", label: "center", icon: AlignCenter, description: "text centered horizontally" },
  { id: "right",  label: "right",  icon: AlignRight,  description: "text anchored to the right side" },
]

export const TYPOGRAPHY_STYLES: { id: string; label: string; icon: LucideIcon; description: string }[] = [
  { id: "auto",        label: "auto",        icon: Sparkles,      description: "AI picks the best typography" },
  { id: "bold",        label: "bold",        icon: Bold,          description: "ultra-bold display, high impact" },
  { id: "serif",       label: "serif",       icon: Type,          description: "classic elegant serif fonts" },
  { id: "sans",        label: "sans-serif",  icon: CaseSensitive, description: "clean modern sans-serif" },
  { id: "handwritten", label: "handwritten", icon: PenLine,       description: "casual script, hand-lettered" },
  { id: "decorative",  label: "decorative",  icon: Star,          description: "ornate decorative display fonts" },
]

export const ASPECT_RATIOS = [
  { id: "1:1", label: "square", description: "1:1 — instagram post", width: 1080, height: 1080 },
  { id: "4:5", label: "portrait", description: "4:5 — instagram portrait", width: 1080, height: 1350 },
  { id: "4:3", label: "banner", description: "4:3 — landscape banner", width: 1440, height: 1080 },
  { id: "9:16", label: "story", description: "9:16 — reels / story", width: 1080, height: 1920 },
  { id: "16:9", label: "landscape", description: "16:9 — youtube / linkedin", width: 1920, height: 1080 },
] as const

export const CUSTOM_SIZE_MIN = 256
export const CUSTOM_SIZE_MAX = 2048

// Validates a user-supplied custom size; returns null when out of range or not a number.
export function normalizeCustomSize(width: unknown, height: unknown): { width: number; height: number } | null {
  const w = Math.round(Number(width))
  const h = Math.round(Number(height))
  if (!Number.isFinite(w) || !Number.isFinite(h)) return null
  if (w < CUSTOM_SIZE_MIN || w > CUSTOM_SIZE_MAX || h < CUSTOM_SIZE_MIN || h > CUSTOM_SIZE_MAX) return null
  return { width: w, height: h }
}

// Resolves the exact output dimensions for a post (preset ratio or custom size).
export function resolveTargetSize(aspectRatio: string, imageWidth?: number | null, imageHeight?: number | null): { width: number; height: number } {
  if (aspectRatio === "custom" && imageWidth && imageHeight) {
    return { width: imageWidth, height: imageHeight }
  }
  const preset = ASPECT_RATIOS.find(r => r.id === aspectRatio)
  return preset ? { width: preset.width, height: preset.height } : { width: 1080, height: 1080 }
}
