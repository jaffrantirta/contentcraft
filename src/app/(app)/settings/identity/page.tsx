"use client"

import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import {
  Loader2, Building2, ImageIcon, Sparkles, Trash2, Check,
  Upload, Layout, X,
} from "lucide-react"
import { cn } from "@/lib/utils"

type LogoPosition = "none" | "top-left" | "top-center" | "top-right" | "footer-left" | "footer-center" | "footer-right"

interface IdentityForm {
  companyName: string
  logoPosition: LogoPosition
  website: string
  tagline: string
}

interface FooterVariantMeta {
  id: string
  brief: string
  createdAt: string
  imageUrl: string | null
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

function LogoPreview({ position, logoUrl }: { position: LogoPosition; logoUrl: string | null }) {
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
  const [plan, setPlan] = useState<string>("free")
  const [footerLimit, setFooterLimit] = useState(1)
  const [form, setForm] = useState<IdentityForm>({
    companyName: "", logoPosition: "none", website: "", tagline: "",
  })
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const logoInputRef = useRef<HTMLInputElement>(null)

  // footer image state
  const [footerBrief, setFooterBrief] = useState("")
  const [generating, setGenerating] = useState(false)
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null)
  const [savingPreview, setSavingPreview] = useState(false)
  const [variants, setVariants] = useState<FooterVariantMeta[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [settingActiveId, setSettingActiveId] = useState<string | null>(null)
  const [uploadingFooter, setUploadingFooter] = useState(false)
  const footerInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([
      fetch("/api/identity").then(r => r.json()),
      fetch("/api/footer/variants").then(r => r.json()),
      fetch("/api/settings").then(r => r.ok ? r.json() : null),
    ]).then(([identityData, variantsData, settingsData]) => {
      if (identityData) {
        setForm({
          companyName: identityData.companyName || "",
          logoPosition: (identityData.logoPosition as LogoPosition) || "none",
          website: identityData.website || "",
          tagline: identityData.tagline || "",
        })
        setLogoUrl(identityData.logoUrl || null)
      }
      if (variantsData?.variants) setVariants(variantsData.variants)
      if (variantsData?.activeId !== undefined) setActiveId(variantsData.activeId)
      if (variantsData?.limit) setFooterLimit(variantsData.limit)
      if (settingsData?.plan) setPlan(settingsData.plan)
    }).finally(() => setFetching(false))
  }, [])

  function setField<K extends keyof IdentityForm>(key: K, value: IdentityForm[K]) {
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

  // --- logo upload ---
  async function handleLogoFile(file: File) {
    if (file.size > 5 * 1024 * 1024) { toast.error("file too large (max 5MB)"); return }
    setUploadingLogo(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/logo", { method: "POST", body: fd })
      const data = await res.json()
      if (data.url) {
        setLogoUrl(data.url)
        toast.success("logo uploaded")
      } else {
        toast.error(data.error || "upload failed")
      }
    } catch {
      toast.error("upload failed")
    } finally {
      setUploadingLogo(false)
    }
  }

  async function handleRemoveLogo() {
    setUploadingLogo(true)
    try {
      await fetch("/api/upload/logo", { method: "DELETE" })
      setLogoUrl(null)
      setField("logoPosition", "none")
      toast.success("logo removed")
    } catch {
      toast.error("failed to remove logo")
    } finally {
      setUploadingLogo(false)
    }
  }

  // --- footer generate preview ---
  async function handleGeneratePreview() {
    if (!footerBrief.trim()) return
    setGenerating(true)
    setPreviewDataUrl(null)
    try {
      const res = await fetch("/api/footer/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: footerBrief, save: false }),
      })
      const data = await res.json()
      if (data.imageDataUrl) {
        setPreviewDataUrl(data.imageDataUrl)
      } else {
        toast.error(data.error || "generation failed")
      }
    } catch {
      toast.error("something went wrong")
    } finally {
      setGenerating(false)
    }
  }

  // --- footer save generated ---
  async function handleSaveGenerated() {
    if (!previewDataUrl) return
    if (variants.length >= footerLimit) {
      toast.error(`limit reached (${footerLimit} for ${plan} plan) — delete one first`)
      return
    }
    setSavingPreview(true)
    try {
      const res = await fetch("/api/footer/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brief: footerBrief, save: true }),
      })
      const data = await res.json()
      if (data.variant) {
        setVariants(data.variants)
        setActiveId(data.activeId)
        setPreviewDataUrl(null)
        setFooterBrief("")
        toast.success("footer saved")
      } else if (data.error === "limit_reached") {
        toast.error(`limit reached (${data.limit} for ${data.plan} plan) — delete one first`)
      } else {
        toast.error(data.error || "failed to save")
      }
    } catch {
      toast.error("failed to save")
    } finally {
      setSavingPreview(false)
    }
  }

  // --- footer file upload ---
  async function handleFooterFile(file: File) {
    if (variants.length >= footerLimit) {
      toast.error(`limit reached (${footerLimit} for ${plan} plan) — delete one first`)
      return
    }
    if (file.size > 5 * 1024 * 1024) { toast.error("file too large (max 5MB)"); return }
    setUploadingFooter(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("brief", "uploaded image")
      const res = await fetch("/api/upload/footer", { method: "POST", body: fd })
      const data = await res.json()
      if (data.variant) {
        setVariants(data.variants)
        setActiveId(data.activeId)
        toast.success("footer image saved")
      } else if (data.error === "limit_reached") {
        toast.error(`limit reached (${data.limit} for ${data.plan} plan) — delete one first`)
      } else {
        toast.error(data.error || "upload failed")
      }
    } catch {
      toast.error("upload failed")
    } finally {
      setUploadingFooter(false)
    }
  }

  async function handleSetActive(id: string | null) {
    setSettingActiveId(id ?? "__none__")
    try {
      const res = await fetch("/api/footer/variants", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (data.activeId !== undefined) {
        setActiveId(data.activeId)
        toast.success(id ? "footer activated" : "footer deactivated")
      }
    } catch {
      toast.error("failed to update")
    } finally {
      setSettingActiveId(null)
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
      if (data.variants !== undefined) {
        setVariants(data.variants)
        setActiveId(data.activeId)
      }
    } catch {
      toast.error("failed to delete")
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
        <p className="text-sm text-muted-foreground mt-1">brand info embedded into your generated content</p>
      </div>

      {/* brand details */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">brand details</span>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">company / brand name</Label>
          <Input placeholder="acme studio" value={form.companyName} onChange={e => setField("companyName", e.target.value)} className="text-sm h-9" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">tagline</Label>
          <Input placeholder="make it happen" value={form.tagline} onChange={e => setField("tagline", e.target.value)} className="text-sm h-9" />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">website</Label>
          <Input placeholder="https://yourwebsite.com" value={form.website} onChange={e => setField("website", e.target.value)} className="text-sm h-9" />
        </div>
      </Card>

      {/* logo */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">logo</span>
        </div>

        <div className="space-y-3">
          {logoUrl ? (
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg border border-border/60 bg-muted overflow-hidden flex items-center justify-center shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={logoUrl} alt="logo" className="max-w-full max-h-full object-contain p-1" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-muted-foreground truncate">{logoUrl.split("/").pop()}</p>
                <div className="flex gap-2 mt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs h-7 px-2.5 gap-1.5"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={uploadingLogo}
                  >
                    <Upload className="h-3 w-3" /> replace
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 px-2.5 gap-1.5 text-destructive hover:text-destructive"
                    onClick={handleRemoveLogo}
                    disabled={uploadingLogo}
                  >
                    <X className="h-3 w-3" /> remove
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => logoInputRef.current?.click()}
              disabled={uploadingLogo}
              className="w-full border-2 border-dashed border-border/60 rounded-lg p-6 flex flex-col items-center gap-2 hover:border-border transition-colors"
            >
              {uploadingLogo
                ? <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
                : <Upload className="h-6 w-6 text-muted-foreground" />
              }
              <span className="text-xs text-muted-foreground">
                {uploadingLogo ? "uploading..." : "click to upload logo"}
              </span>
              <span className="text-[10px] text-muted-foreground">PNG, JPG, WebP, SVG · max 5MB</span>
            </button>
          )}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleLogoFile(e.target.files[0])}
          />
        </div>

        {logoUrl && (
          <>
            <Separator />
            <div className="space-y-3">
              <Label className="text-xs">position on slide</Label>
              <div className="grid grid-cols-[1fr_auto] gap-4 items-start">
                <div className="space-y-3">
                  <button
                    onClick={() => setField("logoPosition", "none")}
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
                        <button key={p.id} onClick={() => setField("logoPosition", p.id)}
                          className={cn("px-2 py-2 rounded-lg border text-xs transition-colors",
                            form.logoPosition === p.id ? "border-primary bg-primary/5 font-medium" : "border-border/60 hover:border-border bg-card text-muted-foreground"
                          )}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">footer</p>
                    <div className="grid grid-cols-3 gap-1.5">
                      {footerPositions.map(p => (
                        <button key={p.id} onClick={() => setField("logoPosition", p.id)}
                          className={cn("px-2 py-2 rounded-lg border text-xs transition-colors",
                            form.logoPosition === p.id ? "border-primary bg-primary/5 font-medium" : "border-border/60 hover:border-border bg-card text-muted-foreground"
                          )}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="w-28">
                  <p className="text-[10px] text-muted-foreground mb-2 text-center">preview</p>
                  <LogoPreview position={form.logoPosition} logoUrl={logoUrl} />
                </div>
              </div>
            </div>
          </>
        )}
      </Card>

      {/* footer image */}
      <Card className="p-6 space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layout className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs font-medium text-muted-foreground">footer image</span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {variants.length}/{footerLimit} · {plan}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground -mt-2">
          composited at the bottom of every slide. upload your own or generate with AI.
        </p>

        {/* upload footer */}
        <div className="space-y-2">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">upload image</p>
          <button
            onClick={() => footerInputRef.current?.click()}
            disabled={uploadingFooter || variants.length >= footerLimit}
            className={cn(
              "w-full border-2 border-dashed rounded-lg p-4 flex flex-col items-center gap-1.5 transition-colors",
              variants.length >= footerLimit
                ? "border-border/30 opacity-50 cursor-not-allowed"
                : "border-border/60 hover:border-border"
            )}
          >
            {uploadingFooter
              ? <Loader2 className="h-5 w-5 text-muted-foreground animate-spin" />
              : <Upload className="h-5 w-5 text-muted-foreground" />
            }
            <span className="text-xs text-muted-foreground">
              {uploadingFooter ? "uploading..." : variants.length >= footerLimit ? `limit reached (${footerLimit})` : "click to upload footer"}
            </span>
            <span className="text-[10px] text-muted-foreground">PNG, JPG, WebP · max 5MB · ideal size: 1536 × 276 px (wide banner)</span>
          </button>
          <input
            ref={footerInputRef}
            type="file"
            accept="image/png,image/jpeg,image/jpg,image/webp"
            className="hidden"
            onChange={e => e.target.files?.[0] && handleFooterFile(e.target.files[0])}
          />
        </div>

        <Separator />

        {/* AI generator */}
        <div className="rounded-lg border border-border/60 bg-muted/30 p-4 space-y-3">
          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">generate with AI</p>
          <div className="flex gap-2">
            <Input
              placeholder="dark minimal, brand colors, website + @handle..."
              value={footerBrief}
              onChange={e => setFooterBrief(e.target.value)}
              className="text-xs h-8 flex-1"
              onKeyDown={e => e.key === "Enter" && !generating && handleGeneratePreview()}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleGeneratePreview}
              disabled={generating || !footerBrief.trim()}
              className="h-8 px-3 text-xs shrink-0"
            >
              {generating
                ? <Loader2 className="h-3 w-3 animate-spin" />
                : <><Sparkles className="h-3 w-3 mr-1" />preview</>
              }
            </Button>
          </div>

          {generating && (
            <div className="w-full aspect-[3/1] rounded-lg bg-muted animate-pulse flex items-center justify-center">
              <Loader2 className="h-6 w-6 text-muted-foreground animate-spin" />
            </div>
          )}

          {previewDataUrl && !generating && (
            <div className="space-y-2">
              <div className="w-full aspect-[3/1] rounded-lg overflow-hidden border border-border/60">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={previewDataUrl} alt="preview" className="w-full h-full object-cover" />
              </div>
              <p className="text-[10px] text-muted-foreground text-center">preview only — save to use it</p>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={handleGeneratePreview} disabled={generating}
                  className="h-7 px-3 text-[11px] flex-1">
                  <Sparkles className="h-3 w-3 mr-1" /> regenerate
                </Button>
                <Button size="sm" onClick={handleSaveGenerated}
                  disabled={savingPreview || variants.length >= footerLimit}
                  className="h-7 px-3 text-[11px] flex-1">
                  {savingPreview ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                  {variants.length >= footerLimit ? "limit reached" : "save"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* saved variants */}
        {variants.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-medium text-muted-foreground">saved ({variants.length}/{footerLimit})</p>
              {activeId && (
                <button onClick={() => handleSetActive(null)} disabled={settingActiveId !== null}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  deactivate all
                </button>
              )}
            </div>
            {variants.map(v => {
              const isActive = v.id === activeId
              return (
                <div key={v.id} className={cn(
                  "rounded-lg border overflow-hidden transition-colors",
                  isActive ? "border-primary/50 ring-1 ring-primary/20" : "border-border/60"
                )}>
                  <div className="w-full aspect-[3/1] bg-muted">
                    {v.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={v.imageUrl} alt={v.brief || "footer"} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 p-2.5">
                    <p className="text-[11px] text-muted-foreground flex-1 truncate">{v.brief || "footer image"}</p>
                    {isActive && (
                      <span className="text-[10px] font-medium text-primary bg-primary/10 border border-primary/20 px-1.5 py-0.5 rounded-full shrink-0">
                        active
                      </span>
                    )}
                    <div className="flex gap-1.5 shrink-0">
                      {!isActive && (
                        <button
                          onClick={() => handleSetActive(v.id)}
                          disabled={settingActiveId !== null}
                          className="h-6 px-2 rounded text-[10px] font-medium border border-border hover:border-primary/40 text-muted-foreground hover:text-primary transition-colors"
                        >
                          {settingActiveId === v.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <><Check className="h-3 w-3 inline mr-0.5" />use</>
                          }
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteVariant(v.id)}
                        disabled={deletingId === v.id}
                        className="h-6 w-6 rounded flex items-center justify-center border border-border/60 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors"
                      >
                        {deletingId === v.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {variants.length === 0 && !previewDataUrl && (
          <p className="text-[11px] text-muted-foreground text-center py-2">
            no footer images saved — upload or generate one
          </p>
        )}
      </Card>

      <Button onClick={handleSave} disabled={loading} className="text-xs h-9">
        {loading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> saving...</> : "save identity"}
      </Button>
    </div>
  )
}
