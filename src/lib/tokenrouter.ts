import OpenAI from "openai"

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

export const DEFAULT_IMAGE_MODEL = process.env.TOKENROUTER_IMAGE_MODEL || "dall-e-3"
export const DEFAULT_CHAT_MODEL = process.env.TOKENROUTER_CHAT_MODEL || "gpt-4o-mini"

export const VIBES = [
  { id: "fun", label: "fun", emoji: "🎉", description: "playful, energetic, colorful" },
  { id: "chill", label: "chill", emoji: "😌", description: "relaxed, soft, minimal" },
  { id: "shock", label: "shock", emoji: "⚡", description: "bold, high contrast, dramatic" },
  { id: "professional", label: "professional", emoji: "💼", description: "clean, corporate, trustworthy" },
  { id: "aesthetic", label: "aesthetic", emoji: "✨", description: "artsy, soft tones, trendy" },
  { id: "dark", label: "dark", emoji: "🖤", description: "moody, deep colors, mysterious" },
  { id: "warm", label: "warm", emoji: "🧡", description: "cozy, earthy, welcoming" },
  { id: "minimal", label: "minimal", emoji: "◻️", description: "white space, simple, elegant" },
] as const

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

export const ASPECT_RATIOS = [
  { id: "1:1", label: "square", description: "1:1 — instagram post", width: 1024, height: 1024 },
  { id: "4:5", label: "portrait", description: "4:5 — instagram portrait", width: 896, height: 1120 },
  { id: "9:16", label: "story", description: "9:16 — reels / story", width: 576, height: 1024 },
  { id: "16:9", label: "landscape", description: "16:9 — youtube / linkedin", width: 1024, height: 576 },
] as const
