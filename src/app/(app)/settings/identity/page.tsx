"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Loader2, Building2, ImageIcon } from "lucide-react"
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
      {/* slide content placeholder */}
      <div className="absolute inset-0 flex flex-col gap-1.5 p-3 pt-10">
        <div className="h-2 w-3/4 rounded bg-muted-foreground/20" />
        <div className="h-2 w-1/2 rounded bg-muted-foreground/20" />
        <div className="h-2 w-2/3 rounded bg-muted-foreground/20" />
      </div>

      {/* top logo */}
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

      {/* footer logo */}
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
    companyName: "",
    logoUrl: "",
    logoPosition: "none",
    footerText: "",
    website: "",
    tagline: "",
  })

  useEffect(() => {
    fetch("/api/identity").then(r => r.json()).then(data => {
      if (data) setForm({
        companyName: data.companyName || "",
        logoUrl: data.logoUrl || "",
        logoPosition: (data.logoPosition as LogoPosition) || "none",
        footerText: data.footerText || "",
        website: data.website || "",
        tagline: data.tagline || "",
      })
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

      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">brand details</span>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">company / brand name</Label>
          <Input
            placeholder="acme studio"
            value={form.companyName}
            onChange={e => set("companyName", e.target.value)}
            className="text-sm h-9"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">tagline</Label>
          <Input
            placeholder="make it happen"
            value={form.tagline}
            onChange={e => set("tagline", e.target.value)}
            className="text-sm h-9"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">website</Label>
          <Input
            placeholder="https://yourwebsite.com"
            value={form.website}
            onChange={e => set("website", e.target.value)}
            className="text-sm h-9"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs">footer text</Label>
          <Textarea
            placeholder="follow us @yourbrand · link in bio"
            value={form.footerText}
            onChange={e => set("footerText", e.target.value)}
            className="text-sm resize-none min-h-20"
          />
        </div>
      </Card>

      {/* Logo + position */}
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
              {/* none */}
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

              {/* top row */}
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

              {/* footer row */}
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

            {/* live preview */}
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
