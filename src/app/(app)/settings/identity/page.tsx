"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Loader2, Building2, ImageIcon, Sparkles, Check, Trash2, BookmarkPlus } from "lucide-react"
import { cn } from "@/lib/utils"

type LogoPosition = "none" | "top-left" | "top-center" | "top-right" | "footer-left" | "footer-center" | "footer-right"

interface IdentityForm {
  companyName: string
  logoUrl: string
  logoPosition: LogoPosition
  footerText: string
  website: string
  tagline: string
}

interface FooterVariant {
  id: string
  text: string
  createdAt: string
}

const topPositions: { id: LogoPosition; label: string }[] = [
  { id: "top-left", label: "left" },
  { id: "top-center", label: "center" },
  { id: "top-right", label: "right" },
]

const footerPositions: { id: LogoPosition; label: string }[] = [
  { id: "footer-left", label: "left" },
  { id: "footer-center", label: "center" },
  { id: "footer-right", label: "right" },
]

function LogoPreview({ position, logoUrl }: { position: LogoPosition; logoUrl: string }) {
  const isTop = position.startsWith("top")
  const isFooter = position.startsWith("footer")
  const align = position.split("-")[1] as "left" | "center" | "right" | undefined

  const logoEl = logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={logoUrl} alt="" className="h-4 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
  ) : (
    <div className="h-4 w-10 bg-white/30 rounded-sm flex items-center justify-center">
      <span className="text-[8px] text-white/70">logo</span>
    </div>
  )

  return (
    <div className="w-full aspect-[4/5] rounded-lg bg-muted/60 border border-border/60 relative overflow-hidden">
      <div className="absolute inset-0 flex flex-col gap-1.5 p-3 pt-10">
        <div className="h-2 w-3/4 rounded bg-muted-foreground/20" />
        <div className="h-2 w-1/2 rounded bg-muted-foreground/20" />
        <div className="h-2 w-2/3 rounded bg-muted-foreground/20" />
      </div>
      {isTop && align && (
        <div className={cn(
          "absolute top-0 p-1.5 flex",
          align === "left" && "left-0 justify-start",
          align === "center" && "left-0 right-0 justify-center",
          align === "right" && "right-0 justify-end",
        )}>
          {logoEl}
        </div>
      )}
      {isFooter && align && (
        <div className={cn(
          "absolute bottom-0 p-1.5 flex bg-black/20 left-0 right-0",
          align === "left" && "justify-start",
          align === "center" && "justify-center",
          align === "right" && "justify-end",
        )}>
          {logoEl}
        </div>
      )}
    </div>
  )
}

export default function IdentityPage() {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [form, setForm] = useState<IdentityForm>({
    companyName: "", logoUrl: "", logoPosition: "none",
    footerText: "", website: "", tagline: "",
  })

  // footer generator state
  const [footerBrief, setFooterBrief] = useState("")
  const [generating, setGenerating] = useState(false)
  const [options, setOptions] = useState<string[]>([])
  const [variants, setVariants] = useState<FooterVariant[]>([])
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const MAX_VARIANTS = 3

  useEffect(() => {
    Promise.all([
      fetch("/api/identity").then(r => r.json()),
      fetch("/api/footer/variants").then(r => r.json()),
    ]).then(([identityData, variantsData]) => {
      if (identityData) setForm({
        companyName: identityData.companyName || "",
        logoUrl: identityData.logoUrl || "",
        logoPosition: (identityData.logoPosition as LogoPosition) || "none",
        footerText: identityData.footerText || "",
        website: identityData.website || "",
        tagline: identityData.tagline || "",
      })
      if (variantsData?.variants) setVariants(variantsData.variants)
    }).finally(() => setFetching(false))
  }, [])

  function set<K extends keyof IdentityForm>(key: K, value: IdentityForm[K]) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch("/api/identity", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error()
      toast.success("identity saved")
    } catch {
      toast.error("failed to save")
    } finally {
      setLoading(false)
    }
  }

  async function handleGenerateFooter() {
    if (!footerBrief.trim()) return
    setGenerating(true)
    setOptions([])
    try {
      const res = await fetch("/api/footer/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: footerBrief }),
      })
      const data = await res.json()
      if (data.options) setOptions(data.options)
      else toast.error("generation failed")
    } catch {
      toast.error("something went wrong")
    } finally {
      setGenerating(false)
    }
  }

  async function handleUseOption(text: string) {
    setForm(prev => ({ ...prev, footerText: text }))
    toast.success("footer text applied — save identity to use it")
  }

  async function handleSaveVariant(text: string) {
    if (variants.length >= MAX_VARIANTS) {
      toast.error(`max ${MAX_VARIANTS} variants reached — delete one first`)
      return
    }
    setSavingId(text)
    try {
      const res = await fetch("/api/footer/variants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      })
      const data = await res.json()
      if (data.variants) {
        setVariants(data.variants)
        toast.success("variant saved to your library")
      } else if (data.error === "max_variants_reached") {
        toast.error(`max ${MAX_VARIANTS} variants — delete one first`)
      }
    } catch {
      toast.error("failed to save variant")
    } finally {
      setSavingId(null)
    }
  }

  async function handleDeleteVariant(id: string) {
    setDeletingId(id)
    try {
      const res = await fetch("/api/footer/variants", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.variants) setVariants(data.variants)
    } catch {
      toast.error("failed to delete variant")
    } finally {
      setDeletingId(null)
    }
  }

  if (fetching) return (
    <div className="space-y-4 max-w-lg">
      {[1, 2, 3].map(i => <div key={i} className="h-16 rounded-lg bg-muted animate-pulse" />)}
    </div>
  )

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">my identity</h1>
        <p className="text-sm text-muted-foreground mt-1">this info gets embedded into your generated content</p>
      </div>

      {/* brand details */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">brand details</span>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">company / brand name</Label>
          <Input placeholder="acme studio" value={form.companyName} onChange={e => set("companyName", e.target.value)} className="text-sm h-9" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">tagline</Label>
          <Input placeholder="make it happen" value={form.tagline} onChange={e => set("tagline", e.target.value)} className="text-sm h-9" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">website</Label>
          <Input placeholder="https://yourwebsite.com" value={form.website} onChange={e => set("website", e.target.value)} className="text-sm h-9" />
        </div>

        <Separator />

        {/* footer text + generator */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs">footer text</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">appears at the bottom of every slide</p>
          </div>
          <Textarea
            placeholder="follow us @yourbrand · link in bio"
            value={form.footerText}
            onChange={e => set("footerText", e.target.value)}
            className="text-sm resize-none min-h-16"
          />

          {/* AI footer generator */}
          <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">ai footer generator</p>
            <div className="flex gap-2">
              <Input
                placeholder="e.g. show my website, instagram handle @myaccount and a CTA..."
                value={footerBrief}
                onChange={e => setFooterBrief(e.target.value)}
                className="text-xs h-8 flex-1"
                onKeyDown={e => e.key === "Enter" && handleGenerateFooter()}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={handleGenerateFooter}
                disabled={generating || !footerBrief.trim()}
                className="h-8 px-3 text-xs shrink-0"
              >
                {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Sparkles className="h-3 w-3 mr-1" />generate</>}
              </Button>
            </div>

            {/* generated options */}
            {options.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] text-muted-foreground">pick one to use or save to library</p>
                {options.map((opt, i) => {
                  const alreadySaved = variants.some(v => v.text === opt)
                  return (
                    <div key={i} className="flex items-start gap-2 rounded-md border border-border/60 bg-background p-2.5">
                      <p className="text-xs flex-1 leading-relaxed">{opt}</p>
                      <div className="flex gap-1.5 shrink-0 mt-0.5">
                        <button
                          onClick={() => handleUseOption(opt)}
                          className="h-6 px-2 rounded text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                        >
                          use
                        </button>
                        <button
                          onClick={() => handleSaveVariant(opt)}
                          disabled={alreadySaved || savingId === opt || variants.length >= MAX_VARIANTS}
                          className={cn(
                            "h-6 px-2 rounded text-[10px] font-medium border transition-colors",
                            alreadySaved
                              ? "border-green-500/30 text-green-500 cursor-default"
                              : "border-border hover:border-border/80 text-muted-foreground hover:text-foreground"
                          )}
                        >
                          {alreadySaved ? <Check className="h-3 w-3" /> : savingId === opt ? <Loader2 className="h-3 w-3 animate-spin" /> : <BookmarkPlus className="h-3 w-3" />}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* saved variants */}
          {variants.length > 0 && (
            <div className="space-y-2">
              <p className="text-[10px] font-medium text-muted-foreground">
                saved variants ({variants.length}/{MAX_VARIANTS})
              </p>
              {variants.map(v => (
                <div key={v.id} className="flex items-start gap-2 rounded-md border border-border/40 bg-card p-2.5">
                  <p className="text-xs flex-1 leading-relaxed">{v.text}</p>
                  <div className="flex gap-1.5 shrink-0 mt-0.5">
                    <button
                      onClick={() => handleUseOption(v.text)}
                      className="h-6 px-2 rounded text-[10px] font-medium bg-primary/10 text-primary hover:bg-primary/20 border border-primary/20 transition-colors"
                    >
                      use
                    </button>
                    <button
                      onClick={() => handleDeleteVariant(v.id)}
                      disabled={deletingId === v.id}
                      className="h-6 w-6 rounded flex items-center justify-center border border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                    >
                      {deletingId === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Card>

      {/* logo + position */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">logo placement</span>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">logo url</Label>
          <Input
            placeholder="https://yourwebsite.com/logo.png"
            value={form.logoUrl}
            onChange={e => set("logoUrl", e.target.value)}
            className="text-sm h-9"
          />
          <p className="text-[10px] text-muted-foreground">link to your logo image (PNG or SVG with transparent background works best)</p>
        </div>

        <Separator />

        <div className="space-y-3">
          <Label className="text-xs">position on slide</Label>
          <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
            <div className="space-y-3">
              <button
                onClick={() => set("logoPosition", "none")}
                className={cn(
                  "w-full px-3 py-2 rounded-lg border text-xs transition-colors text-left",
                  form.logoPosition === "none"
                    ? "border-primary bg-primary/5 font-medium"
                    : "border-border/60 hover:border-border bg-card text-muted-foreground"
                )}
              >
                no logo
              </button>
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">top</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {topPositions.map(p => (
                    <button
                      key={p.id}
                      onClick={() => set("logoPosition", p.id)}
                      className={cn(
                        "px-2 py-2 rounded-lg border text-xs transition-colors",
                        form.logoPosition === p.id
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border/60 hover:border-border bg-card text-muted-foreground"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">footer</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {footerPositions.map(p => (
                    <button
                      key={p.id}
                      onClick={() => set("logoPosition", p.id)}
                      className={cn(
                        "px-2 py-2 rounded-lg border text-xs transition-colors",
                        form.logoPosition === p.id
                          ? "border-primary bg-primary/5 font-medium"
                          : "border-border/60 hover:border-border bg-card text-muted-foreground"
                      )}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="w-28">
              <p className="text-[10px] text-muted-foreground mb-2 text-center">preview</p>
              <LogoPreview position={form.logoPosition} logoUrl={form.logoUrl} />
            </div>
          </div>
        </div>
      </Card>

      <Button onClick={handleSave} disabled={loading} className="text-xs h-9">
        {loading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> saving...</> : "save identity"}
      </Button>
    </div>
  )
}
