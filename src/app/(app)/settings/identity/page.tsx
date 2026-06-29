"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card } from "@/components/ui/card"
import { toast } from "sonner"
import { Loader2, Building2 } from "lucide-react"

interface IdentityForm {
  companyName: string
  logoUrl: string
  footerText: string
  website: string
  tagline: string
}

export default function IdentityPage() {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [form, setForm] = useState<IdentityForm>({
    companyName: "",
    logoUrl: "",
    footerText: "",
    website: "",
    tagline: "",
  })

  useEffect(() => {
    fetch("/api/identity").then(r => r.json()).then(data => {
      if (data) setForm({
        companyName: data.companyName || "",
        logoUrl: data.logoUrl || "",
        footerText: data.footerText || "",
        website: data.website || "",
        tagline: data.tagline || "",
      })
    }).finally(() => setFetching(false))
  }, [])

  function set(key: keyof IdentityForm, value: string) {
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
        <div className="flex items-center gap-2 mb-2">
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
          <Label className="text-xs">logo url</Label>
          <Input
            placeholder="https://yourwebsite.com/logo.png"
            value={form.logoUrl}
            onChange={e => set("logoUrl", e.target.value)}
            className="text-sm h-9"
          />
          {form.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={form.logoUrl} alt="logo preview" className="h-10 mt-2 object-contain" onError={e => { (e.target as HTMLImageElement).style.display = "none" }} />
          )}
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

      <Button onClick={handleSave} disabled={loading} className="text-xs h-9">
        {loading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> saving...</> : "save identity"}
      </Button>
    </div>
  )
}
