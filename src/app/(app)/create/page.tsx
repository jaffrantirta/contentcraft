"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { VIBES, COLOR_PALETTES, ASPECT_RATIOS, DESIGN_STYLES, TEXT_POSITIONS, TYPOGRAPHY_STYLES } from "@/lib/tokenrouter"
import { Sparkles, Loader2, User, UserX, FileText, Lightbulb, Upload, X, Palette, Check } from "lucide-react"
import { cn } from "@/lib/utils"

type AspectRatioId = typeof ASPECT_RATIOS[number]["id"]
type VibeId = typeof VIBES[number]["id"]
type PaletteId = typeof COLOR_PALETTES[number]["id"] | "custom"
type StyleId = typeof DESIGN_STYLES[number]["id"]
type TextPositionId = typeof TEXT_POSITIONS[number]["id"]
type TypographyId = typeof TYPOGRAPHY_STYLES[number]["id"]

interface FormState {
  brief: string
  slideBriefs: string[]
  inputMode: "text_ready" | "raw_brief"
  aspectRatio: AspectRatioId
  language: "id" | "en"
  slideCount: number
  withSubject: boolean
  vibe: VibeId
  designStyle: StyleId
  colorPalette: PaletteId
  customColors: string[]
  textPosition: TextPositionId
  typographyStyle: TypographyId
}

export default function CreatePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [subjectImageUrl, setSubjectImageUrl] = useState<string | null>(null)
  const [subjectStorageKey, setSubjectStorageKey] = useState<string | null>(null)
  const [uploadingSubject, setUploadingSubject] = useState(false)
  const subjectInputRef = useRef<HTMLInputElement>(null)

  const [form, setForm] = useState<FormState>({
    brief: "",
    slideBriefs: ["", "", ""],
    inputMode: "raw_brief",
    aspectRatio: "1:1",
    language: "id",
    slideCount: 3,
    withSubject: false,
    vibe: "professional",
    designStyle: "realistic",
    colorPalette: "ocean",
    customColors: ["#6C5CE7", "#00B4D8", "#FFD166"],
    textPosition: "auto",
    typographyStyle: "auto",
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

  async function handleSubjectFile(file: File) {
    setUploadingSubject(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/subject", { method: "POST", body: fd })
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "upload failed") }
      const { url, key } = await res.json()
      setSubjectImageUrl(url)
      setSubjectStorageKey(key)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "upload failed")
    } finally {
      setUploadingSubject(false)
      if (subjectInputRef.current) subjectInputRef.current.value = ""
    }
  }

  async function removeSubjectImage() {
    if (subjectStorageKey) {
      await fetch("/api/upload/subject", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: subjectStorageKey }),
      }).catch(() => {})
    }
    setSubjectImageUrl(null)
    setSubjectStorageKey(null)
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
      const colors = form.colorPalette === "custom"
        ? form.customColors.filter(Boolean)
        : (COLOR_PALETTES.find(p => p.id === form.colorPalette)?.colors ?? [])
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
          vibe: form.vibe,
          designStyle: form.designStyle,
          colorPalette: colors,
          textPosition: form.textPosition,
          typographyStyle: form.typographyStyle,
          subjectImageUrl: subjectImageUrl || null,
          subjectStorageKey: subjectStorageKey || null,
        }),
      })

      if (res.status === 403) {
        toast.error("free limit reached — upgrade to pro or add your api key")
        router.push("/billing")
        return
      }

      if (!res.ok) throw new Error("generation failed")

      const data = await res.json()
      // Redirect immediately — the post page shows one continuous generation animation.
      router.push(`/posts/${data.postId}`)
    } catch {
      toast.error("something went wrong. please try again.")
      setLoading(false)
    }
  }

  const isTextReady = form.inputMode === "text_ready"

  return (
    <>
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
                {lang === "id" ? "indonesian" : "english"}
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

      {/* subject image upload — shown when withSubject is true */}
      {form.withSubject && (
        <div className="space-y-2">
          <Label className="text-xs font-medium">subject photo <span className="text-muted-foreground font-normal">(optional)</span></Label>
          <p className="text-[10px] text-muted-foreground">upload a photo of the person or product — AI will blend them into the design</p>

          {subjectImageUrl ? (
            <div className="relative w-full rounded-lg overflow-hidden border border-border/60 bg-muted/30">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={subjectImageUrl} alt="subject" className="w-full max-h-40 object-cover" />
              <button
                onClick={removeSubjectImage}
                className="absolute top-2 right-2 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="px-3 py-2 text-[10px] text-muted-foreground flex items-center gap-1"><Check className="h-3 w-3 text-green-500" /> subject image uploaded</div>
            </div>
          ) : (
            <button
              onClick={() => subjectInputRef.current?.click()}
              disabled={uploadingSubject}
              className="w-full border-2 border-dashed border-border/60 hover:border-border rounded-lg p-4 flex flex-col items-center gap-1.5 transition-colors bg-card"
            >
              {uploadingSubject
                ? <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
                : <Upload className="h-5 w-5 text-muted-foreground" />
              }
              <span className="text-xs text-muted-foreground">
                {uploadingSubject ? "uploading..." : "click to upload subject photo"}
              </span>
              <span className="text-[10px] text-muted-foreground">PNG, JPG, WebP · max 5MB</span>
            </button>
          )}
          <input
            ref={subjectInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleSubjectFile(e.target.files[0])}
          />
        </div>
      )}

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
              <v.icon className={cn("h-4 w-4 text-muted-foreground", form.vibe === v.id && "text-primary")} />
              <p className="text-xs font-medium mt-1.5">{v.label}</p>
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
              <s.icon className={cn("h-4 w-4 text-muted-foreground", form.designStyle === s.id && "text-primary")} />
              <p className="text-xs font-medium mt-1.5">{s.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{s.description}</p>
            </button>
          ))}
        </div>
      </div>

      {/* text position */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">text position</Label>
        <div className="grid grid-cols-4 gap-2">
          {TEXT_POSITIONS.map(p => (
            <button
              key={p.id}
              onClick={() => set("textPosition", p.id)}
              className={cn(
                "flex flex-col items-center gap-1.5 p-3 rounded-lg border text-center transition-colors",
                form.textPosition === p.id
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border bg-card"
              )}
            >
              <p.icon className={cn("h-4 w-4 text-muted-foreground", form.textPosition === p.id && "text-primary")} />
              <p className="text-[11px] font-medium">{p.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* typography style */}
      <div className="space-y-3">
        <Label className="text-xs font-medium">typography style</Label>
        <div className="grid grid-cols-3 gap-2">
          {TYPOGRAPHY_STYLES.map(t => (
            <button
              key={t.id}
              onClick={() => set("typographyStyle", t.id)}
              className={cn(
                "p-3 rounded-lg border text-left transition-colors",
                form.typographyStyle === t.id
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border bg-card"
              )}
            >
              <t.icon className={cn("h-4 w-4 text-muted-foreground", form.typographyStyle === t.id && "text-primary")} />
              <p className="text-xs font-medium mt-1.5">{t.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{t.description}</p>
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

          {/* custom palette */}
          <button
            onClick={() => set("colorPalette", "custom")}
            className={cn(
              "p-3 rounded-lg border transition-colors",
              form.colorPalette === "custom"
                ? "border-primary bg-primary/5"
                : "border-border/60 hover:border-border bg-card"
            )}
          >
            <div className="flex gap-1 mb-2">
              {form.customColors.map((c, i) => (
                <div key={i} className="flex-1 h-4 rounded-sm border border-border/40" style={{ backgroundColor: c }} />
              ))}
            </div>
            <p className="text-[10px] text-left font-medium flex items-center gap-1">
              <Palette className="h-3 w-3" /> custom
            </p>
          </button>
        </div>

        {/* custom color pickers */}
        {form.colorPalette === "custom" && (
          <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2.5">
            <p className="text-[10px] text-muted-foreground">pick your own colors — ai will design around them</p>
            <div className="grid grid-cols-3 gap-2">
              {form.customColors.map((c, i) => (
                <div key={i} className="space-y-1.5">
                  <label className="relative block h-12 rounded-lg overflow-hidden border border-border/60 cursor-pointer">
                    <span className="absolute inset-0" style={{ backgroundColor: c }} />
                    <input
                      type="color"
                      value={c}
                      onChange={e => {
                        const next = [...form.customColors]
                        next[i] = e.target.value
                        set("customColors", next)
                      }}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                    />
                  </label>
                  <input
                    type="text"
                    value={c}
                    onChange={e => {
                      const next = [...form.customColors]
                      next[i] = e.target.value
                      set("customColors", next)
                    }}
                    className="w-full text-[10px] font-mono text-center rounded border border-border/60 bg-background py-1 uppercase"
                    maxLength={7}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>


      {/* generate — sticky on mobile, inline on desktop */}
      <div className="hidden md:flex items-center justify-between pb-8">
        <p className="text-xs text-muted-foreground">
          {form.slideCount} slide{form.slideCount > 1 ? "s" : ""} · {form.language === "id" ? "indonesian" : "english"} · {form.inputMode === "text_ready" ? "text ready" : "raw brief"}
        </p>
        <Button onClick={handleGenerate} disabled={loading || !form.brief.trim()} size="lg" className="text-sm min-w-36">
          {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />starting...</> : <><Sparkles className="h-4 w-4 mr-2" />generate</>}
        </Button>
      </div>

      {/* mobile sticky bottom bar */}
      <div className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-background/95 backdrop-blur-sm border-t border-border/60 p-4">
        <div className="flex items-center gap-3">
          <p className="text-[10px] text-muted-foreground flex-1">
            {form.slideCount} slides · {form.language} · {form.inputMode === "text_ready" ? "text ready" : "raw brief"}
          </p>
          <Button onClick={handleGenerate} disabled={loading || !form.brief.trim()} className="text-sm h-10 px-6">
            {loading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />starting...</> : <><Sparkles className="h-4 w-4 mr-2" />generate</>}
          </Button>
        </div>
      </div>
    </div>
    </>
  )
}
