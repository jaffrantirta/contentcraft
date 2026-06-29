"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { VIBES, COLOR_PALETTES, ASPECT_RATIOS } from "@/lib/tokenrouter"
import { Sparkles, Loader2, User, UserX } from "lucide-react"
import { cn } from "@/lib/utils"
import { GeneratingAnimation } from "@/components/app/generating-animation"

type AspectRatioId = typeof ASPECT_RATIOS[number]["id"]
type VibeId = typeof VIBES[number]["id"]
type PaletteId = typeof COLOR_PALETTES[number]["id"]

interface FormState {
  brief: string
  aspectRatio: AspectRatioId
  language: "id" | "en"
  slideCount: number
  withSubject: boolean
  vibe: VibeId
  colorPalette: PaletteId
}

export default function CreatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>({
    brief: "",
    aspectRatio: "1:1",
    language: "id",
    slideCount: 3,
    withSubject: false,
    vibe: "professional",
    colorPalette: "ocean",
  })

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleGenerate() {
    if (!form.brief.trim()) {
      toast.error("please write a brief first")
      return
    }
    setLoading(true)
    try {
      const selectedPalette = COLOR_PALETTES.find(p => p.id === form.colorPalette)
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          colorPalette: selectedPalette?.colors || [],
        }),
      })

      if (res.status === 403) {
        toast.error("free limit reached — upgrade to pro or add your api key")
        router.push("/billing")
        return
      }

      if (!res.ok) throw new Error("generation failed")

      const data = await res.json()
      toast.success("content generated!")
      router.push(`/posts/${data.postId}`)
    } catch {
      toast.error("something went wrong. please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
    {loading && <GeneratingAnimation slideCount={form.slideCount} />}
    <div className="max-w-2xl space-y-6 md:space-y-8 pb-24">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">create new post</h1>
        <p className="text-sm text-muted-foreground mt-1">fill in the details and let ai do the work</p>
      </div>

      {/* brief */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">brief *</Label>
        <Textarea
          placeholder="what is this content about? describe your message, product, or topic..."
          className="min-h-28 text-sm resize-none"
          value={form.brief}
          onChange={e => set("brief", e.target.value)}
          maxLength={500}
        />
        <p className="text-[10px] text-muted-foreground text-right">{form.brief.length}/500</p>
      </div>

      <Separator />

      {/* aspect ratio */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">post ratio</Label>
        <div className="grid grid-cols-2 gap-2">
          {ASPECT_RATIOS.map(r => (
            <button
              key={r.id}
              onClick={() => set("aspectRatio", r.id)}
              className={cn(
                "p-3 rounded-lg border text-left transition-colors",
                form.aspectRatio === r.id
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border bg-card"
              )}
            >
              <p className="text-xs font-medium">{r.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{r.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* language + slides in a row on mobile */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-3">
          <Label className="text-xs font-medium">language</Label>
          <div className="flex flex-col gap-2">
            {(["id", "en"] as const).map(lang => (
              <button
                key={lang}
                onClick={() => set("language", lang)}
                className={cn(
                  "px-3 py-2 rounded-lg border text-xs transition-colors text-left",
                  form.language === lang
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border/60 hover:border-border bg-card text-muted-foreground"
                )}
              >
                {lang === "id" ? "🇮🇩 indonesian" : "🇺🇸 english"}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <Label className="text-xs font-medium">slides</Label>
          <div className="grid grid-cols-3 gap-1.5">
            {[1, 2, 3, 4, 5].map(n => (
              <button
                key={n}
                onClick={() => set("slideCount", n)}
                className={cn(
                  "h-9 rounded-lg border text-xs font-medium transition-colors",
                  form.slideCount === n
                    ? "border-primary bg-primary/5"
                    : "border-border/60 hover:border-border bg-card text-muted-foreground"
                )}
              >
                {n}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">max 5 on free</p>
        </div>
      </div>

      {/* subject */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">subject (person in design)</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => set("withSubject", false)}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs transition-colors",
              !form.withSubject
                ? "border-primary bg-primary/5 font-medium"
                : "border-border/60 hover:border-border bg-card text-muted-foreground"
            )}
          >
            <UserX className="h-3.5 w-3.5" />
            no subject
          </button>
          <button
            onClick={() => set("withSubject", true)}
            className={cn(
              "flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-xs transition-colors",
              form.withSubject
                ? "border-primary bg-primary/5 font-medium"
                : "border-border/60 hover:border-border bg-card text-muted-foreground"
            )}
          >
            <User className="h-3.5 w-3.5" />
            with subject
          </button>
        </div>
      </div>

      <Separator />

      {/* vibe */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">vibe</Label>
        <div className="grid grid-cols-2 gap-2">
          {VIBES.map(v => (
            <button
              key={v.id}
              onClick={() => set("vibe", v.id)}
              className={cn(
                "p-3 rounded-lg border text-left transition-colors",
                form.vibe === v.id
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border bg-card"
              )}
            >
              <span className="text-base">{v.emoji}</span>
              <p className="text-xs font-medium mt-1">{v.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{v.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* color palette */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">color palette</Label>
        <div className="grid grid-cols-2 gap-2">
          {COLOR_PALETTES.map(p => (
            <button
              key={p.id}
              onClick={() => set("colorPalette", p.id)}
              className={cn(
                "p-3 rounded-lg border transition-colors",
                form.colorPalette === p.id
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border bg-card"
              )}
            >
              <div className="flex gap-1 mb-2">
                {p.colors.map(c => (
                  <div key={c} className="flex-1 h-4 rounded-sm" style={{ backgroundColor: c }} />
                ))}
              </div>
              <p className="text-[10px] text-left font-medium">{p.name}</p>
            </button>
          ))}
        </div>
      </div>

      {/* generate — sticky on mobile, inline on desktop */}
      <div className="hidden md:flex items-center justify-between pb-8">
        <p className="text-xs text-muted-foreground">
          {form.slideCount} slide{form.slideCount > 1 ? "s" : ""} · {form.language === "id" ? "indonesian" : "english"} · {form.vibe}
        </p>
        <Button onClick={handleGenerate} disabled={loading || !form.brief.trim()} size="lg" className="text-sm min-w-36">
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />generating...</> : <><Sparkles className="h-4 w-4 mr-2" />generate</>}
        </Button>
      </div>

      {/* mobile sticky bottom bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border/60 p-4">
        <div className="flex items-center gap-3">
          <p className="text-[10px] text-muted-foreground flex-1">
            {form.slideCount} slides · {form.language} · {form.vibe}
          </p>
          <Button onClick={handleGenerate} disabled={loading || !form.brief.trim()} className="text-sm h-10 px-6">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />generating...</> : <><Sparkles className="h-4 w-4 mr-2" />generate</>}
          </Button>
        </div>
      </div>
    </div>
    </>
  )
}
