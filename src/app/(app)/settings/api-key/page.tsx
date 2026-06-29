"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { Loader2, Key, Info, MessageSquare, ImageIcon } from "lucide-react"

interface SettingsForm {
  byokApiKey: string
  byokBaseUrl: string
  byokModel: string
  byokChatModel: string
}

export default function ApiKeyPage() {
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)
  const [currentPlan, setCurrentPlan] = useState("free")
  const [form, setForm] = useState<SettingsForm>({
    byokApiKey: "",
    byokBaseUrl: "",
    byokModel: "",
    byokChatModel: "",
  })

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(data => {
      setCurrentPlan(data.plan || "free")
      setForm({
        byokApiKey: "",
        byokBaseUrl: data.byokBaseUrl || "",
        byokModel: data.byokModel || "",
        byokChatModel: data.byokChatModel || "",
      })
    }).finally(() => setFetching(false))
  }, [])

  function set(key: keyof SettingsForm, value: string) {
    setForm(prev => ({ ...prev, [key]: value }))
  }

  async function handleSave() {
    setLoading(true)
    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error()
      setCurrentPlan(data.plan)
      toast.success(form.byokApiKey ? "api key saved — plan switched to byok" : "settings saved")
    } catch {
      toast.error("failed to save")
    } finally {
      setLoading(false)
    }
  }

  async function handleRemove() {
    setLoading(true)
    try {
      await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ byokApiKey: "", byokBaseUrl: "", byokModel: "", byokChatModel: "" }),
      })
      setCurrentPlan("free")
      setForm({ byokApiKey: "", byokBaseUrl: "", byokModel: "", byokChatModel: "" })
      toast.success("api key removed")
    } catch {
      toast.error("failed to remove")
    } finally {
      setLoading(false)
    }
  }

  if (fetching) return <div className="h-48 rounded-xl bg-muted animate-pulse max-w-lg" />

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">api key</h1>
        <p className="text-sm text-muted-foreground mt-1">use your own api key for unlimited generation</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">current plan:</span>
        <Badge variant={currentPlan === "pro" ? "default" : "secondary"} className="text-[10px]">{currentPlan}</Badge>
      </div>

      <Card className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <Key className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">credentials</span>
        </div>

        <div className="rounded-lg bg-muted/50 p-3 flex gap-2">
          <Info className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
          <p className="text-xs text-muted-foreground leading-relaxed">
            compatible with tokenrouter.com, openai, or any openai-compatible endpoint. adding your key switches your plan to <strong>byok</strong> with unlimited generations.
          </p>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">api key</Label>
          <Input
            type="password"
            placeholder="sk-..."
            value={form.byokApiKey}
            onChange={e => set("byokApiKey", e.target.value)}
            className="h-9 font-mono"
          />
          {currentPlan === "byok" && !form.byokApiKey && (
            <p className="text-[10px] text-muted-foreground">key saved (hidden for security). enter a new one to replace.</p>
          )}
        </div>

        <div className="space-y-2">
          <Label className="text-xs">base url <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            placeholder="https://api.tokenrouter.com/v1"
            value={form.byokBaseUrl}
            onChange={e => set("byokBaseUrl", e.target.value)}
            className="h-9 font-mono"
          />
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">model for captions</span>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">chat model <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            placeholder="MiniMax-M3"
            value={form.byokChatModel}
            onChange={e => set("byokChatModel", e.target.value)}
            className="h-9 font-mono"
          />
          <p className="text-[10px] text-muted-foreground">used to write captions and hashtags. leave blank to use the app default.</p>
        </div>

        <Separator />

        <div className="flex items-center gap-2">
          <ImageIcon className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">model for images</span>
        </div>

        <div className="space-y-2">
          <Label className="text-xs">image model <span className="text-muted-foreground">(optional)</span></Label>
          <Input
            placeholder="openai/gpt-5.4-image-2"
            value={form.byokModel}
            onChange={e => set("byokModel", e.target.value)}
            className="h-9 font-mono"
          />
          <p className="text-[10px] text-muted-foreground">used to generate slide images. leave blank to use the app default.</p>
        </div>
      </Card>

      <div className="flex gap-3">
        <Button onClick={handleSave} disabled={loading} className="text-xs h-9">
          {loading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" />saving...</> : "save settings"}
        </Button>
        {currentPlan === "byok" && (
          <Button variant="outline" onClick={handleRemove} disabled={loading} className="text-xs h-9">
            remove key
          </Button>
        )}
      </div>
    </div>
  )
}
