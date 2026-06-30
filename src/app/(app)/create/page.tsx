"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { VIBES, COLOR_PALETTES, ASPECT_RATIOS, DESIGN_STYLES } from "@/lib/tokenrouter"
import { Sparkles, Loader2, User, UserX, FileText, Lightbulb } from "lucide-react"
import { cn } from "@/lib/utils"
import { GeneratingAnimation } from "@/components/app/generating-animation"

type AspectRatioId = typeof ASPECT_RATIOS[number]["id"]
type VibeId = typeof VIBES[number]["id"]
type PaletteId = typeof COLOR_PALETTES[number]["id"]
type StyleId = typeof DESIGN_STYLES[number]["id"]

interface FormState {
  brief: string
  slideBriefs: string[]
  inputMode: "text_ready" | "raw_brief"
  aspectRatio: AspectRatioId
  language: "id" | "en"
  slideCount: number
  withSubject: boolean
  showFooter: boolean
  vibe: VibeId
  designStyle: StyleId
  colorPalette: PaletteId
}

export default function CreatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState<FormState>({
    brief: "",
    slideBriefs: ["", "", ""],
    inputMode: "raw_brief",
    aspectRatio: "1:1",
    language: "id",
    slideCount: 3,
    withSubject: false,
    showFooter: true,
    vibe: "professional",
    designStyle: "realistic",
    colorPalette: "ocean",
  })

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  function setSlideCount(n: number) {
    setForm(prev => {
      const current = prev.slideBriefs
      const next = Array.from({ length: n }, (_, i) => current[i] ?? "")
      return { ...prev, slideCount: n, slideBriefs: next }
    })
  }

  function setSlideBrief(index: number, value: string) {
    setForm(prev => {
      const next = [...prev.slideBriefs]
      next[index] = value
      return { ...prev, slideBriefs: next }
    })
  }

  async function handleGenerate() {
    if (!form.brief.trim()) {
      toast.error("please write a general brief first")
      return
    }
    if (form.inputMode === "text_ready") {
      const missing = form.slideBriefs.slice(0, form.slideCount).some(b => !b.trim())
      if (missing) {
        toast.error("fill in the text for every slide")
        return
      }
    }
    setLoading(true)
    try {
      const selectedPalette = COLOR_PALETTES.find(p => p.id === form.colorPalette)
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brief: form.brief,
          slideBriefs: form.slideBriefs,
          captionMode: form.inputMode,
          aspectRatio: form.aspectRatio,
          language: form.language,
          slideCount: form.slideCount,
          withSubject: form.withSubject,
          showFooter: form.showFooter,
          vibe: form.vibe,
          designStyle: form.designStyle,
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

  const isTextReady = form.inputMode === "text_ready"

  return (
    <>
    {loading && <GeneratingAnimation slideCount={form.slideCount} />}
    <div className="max-w-2xl space-y-6 md:space-y-8 pb-24">
      <div>
        <h1 className="text-xl md:text-2xl font-bold tracking-tight">create new post</h1>
        <p className="text-sm text-muted-foreground mt-1">fill in the details and let ai do the work</p>
      </div>

      {/* input mode — first choice */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">content mode</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => set("inputMode", "raw_brief")}
            className={cn(
              "p-4 rounded-lg border text-left transition-colors",
              !isTextReady
                ? "border-primary bg-primary/5"
                : "border-border/60 hover:border-border bg-card"
            )}
          >
            <Lightbulb className="h-4 w-4 mb-2 text-muted-foreground" />
            <p className="text-xs font-semibold">raw brief</p>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              describe what each slide is about — ai writes the text and burns it into the design
            </p>
          </button>
          <button
            onClick={() => set("inputMode", "text_ready")}
            className={cn(
              "p-4 rounded-lg border text-left transition-colors",
              isTextReady
                ? "border-primary bg-primary/5"
                : "border-border/60 hover:border-border bg-card"
            )}
          >
            <FileText className="h-4 w-4 mb-2 text-muted-foreground" />
            <p className="text-xs font-semibold">text ready</p>
            <p className="text-[10px] text-muted-foreground mt-1 leading-relaxed">
              write the exact text for each slide — ai only designs the visual around your words
            </p>
          </button>
        </div>
      </div>

      <Separator />

      {/* general brief */}
      <div className="space-y-2">
        <Label className="text-xs font-medium">general brief *</Label>
        <p className="text-[10px] text-muted-foreground">
          {isTextReady
            ? "overall topic, brand, and design direction (ai uses this for visual style)"
            : "overall topic, brand, and design direction"}
        </p>
        <Textarea
          placeholder="what is this content about? describe your message, product, or topic..."
          className="min-h-24 text-sm resize-none"
          value={form.brief}
          onChange={e => set("brief", e.target.value)}
          maxLength={1500}
        />
        <p className="text-[10px] text-muted-foreground text-right">{form.brief.length}/1500</p>
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

      {/* language + slides */}
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
                onClick={() => setSlideCount(n)}
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

      {/* per-slide content */}
      <div className="space-y-3">
        <div>
          <Label className="text-xs font-medium">
            {isTextReady ? "slide text (exact)" : "slide briefs"}
          </Label>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {isTextReady
              ? "write the exact text that will appear on each slide"
              : "describe what each slide should be about — ai writes the text"}
          </p>
        </div>
        <div className="space-y-3">
          {form.slideBriefs.slice(0, form.slideCount).map((brief, i) => (
            <div key={i} className="space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">
                slide {i + 1}{isTextReady ? " *" : ""}
              </p>
              <Textarea
                placeholder={
                  isTextReady
                    ? `exact text for slide ${i + 1}...`
                    : `what should slide ${i + 1} be about?`
                }
                className="min-h-16 text-sm resize-none"
                value={brief}
                onChange={e => setSlideBrief(i, e.target.value)}
                maxLength={500}
              />
            </div>
          ))}
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

      {/* design style */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">design style</Label>
        <div className="grid grid-cols-2 gap-2">
          {DESIGN_STYLES.map(s => (
            <button
              key={s.id}
              onClick={() => set("designStyle", s.id)}
              className={cn(
                "p-3 rounded-lg border text-left transition-colors",
                form.designStyle === s.id
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border bg-card"
              )}
            >
              <span className="text-base">{s.emoji}</span>
              <p className="text-xs font-medium mt-1">{s.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>
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

      {/* footer toggle */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">footer</Label>
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => set("showFooter", true)}
            className={cn(
              "p-3 rounded-lg border text-left transition-colors",
              form.showFooter
                ? "border-primary bg-primary/5"
                : "border-border/60 hover:border-border bg-card"
            )}
          >
            <p className="text-xs font-medium">show footer</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">footer text on every slide</p>
          </button>
          <button
            onClick={() => set("showFooter", false)}
            className={cn(
              "p-3 rounded-lg border text-left transition-colors",
              !form.showFooter
                ? "border-primary bg-primary/5"
                : "border-border/60 hover:border-border bg-card"
            )}
          >
            <p className="text-xs font-medium">no footer</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">clean image, no footer bar</p>
          </button>
        </div>
      </div>

      {/* generate — sticky on mobile, inline on desktop */}
      <div className="hidden md:flex items-center justify-between pb-8">
        <p className="text-xs text-muted-foreground">
          {form.slideCount} slide{form.slideCount > 1 ? "s" : ""} · {form.language === "id" ? "indonesian" : "english"} · {form.inputMode === "text_ready" ? "text ready" : "raw brief"}
        </p>
        <Button onClick={handleGenerate} disabled={loading || !form.brief.trim()} size="lg" className="text-sm min-w-36">
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />generating...</> : <><Sparkles className="h-4 w-4 mr-2" />generate</>}
        </Button>
      </div>

      {/* mobile sticky bottom bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border/60 p-4">
        <div className="flex items-center gap-3">
          <p className="text-[10px] text-muted-foreground flex-1">
            {form.slideCount} slides · {form.language} · {form.inputMode === "text_ready" ? "text ready" : "raw brief"}
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
