"use client"

import { useEffect, useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { PRO_PRICE_IDR } from "@/lib/midtrans"
import { Loader2, CreditCard, Zap, CheckCircle2, Key } from "lucide-react"
import Link from "next/link"

declare global {
  interface Window {
    snap?: {
      pay: (token: string, options: {
        onSuccess: (result: unknown) => void
        onPending: (result: unknown) => void
        onError: (result: unknown) => void
        onClose: () => void
      }) => void
    }
  }
}

interface Settings {
  plan: string
  freeGenerationsUsed: number
}

export default function BillingPage() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [loading, setLoading] = useState(false)
  const [fetching, setFetching] = useState(true)

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(setSettings).finally(() => setFetching(false))

    // load midtrans snap
    const clientKey = process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY
    if (clientKey) {
      const script = document.createElement("script")
      script.src = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === "true"
        ? "https://app.midtrans.com/snap/snap.js"
        : "https://app.sandbox.midtrans.com/snap/snap.js"
      script.setAttribute("data-client-key", clientKey)
      document.head.appendChild(script)
    }
  }, [])

  async function handleSubscribe() {
    setLoading(true)
    try {
      const res = await fetch("/api/billing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planName: "pro" }),
      })
      const data = await res.json()

      if (window.snap && data.token) {
        window.snap.pay(data.token, {
          onSuccess: () => {
            toast.success("payment successful! welcome to pro 🎉")
            setSettings(prev => prev ? { ...prev, plan: "pro" } : null)
          },
          onPending: () => toast.info("payment pending — we'll update your plan when confirmed"),
          onError: () => toast.error("payment failed"),
          onClose: () => setLoading(false),
        })
      } else {
        window.open(data.redirect_url, "_blank")
      }
    } catch {
      toast.error("failed to initiate payment")
    } finally {
      setLoading(false)
    }
  }

  const priceFormatted = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(PRO_PRICE_IDR)

  if (fetching) return <div className="h-64 rounded-xl bg-muted animate-pulse max-w-2xl" />

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">billing</h1>
        <p className="text-sm text-muted-foreground mt-1">manage your plan and subscription</p>
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">current plan:</span>
        <Badge variant={settings?.plan === "pro" ? "default" : "secondary"} className="text-[10px]">{settings?.plan || "free"}</Badge>
      </div>

      {settings?.plan === "pro" ? (
        <Card className="p-6 space-y-3">
          <div className="flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-sm font-medium">you&apos;re on pro</p>
              <p className="text-xs text-muted-foreground">unlimited generations with no api key needed</p>
            </div>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* free card */}
          <Card className="p-5 space-y-4">
            <div>
              <Badge variant="secondary" className="text-[10px] mb-3">current plan</Badge>
              <p className="text-lg font-bold">free</p>
              <p className="text-xs text-muted-foreground">rp 0</p>
            </div>
            <Separator />
            <ul className="space-y-2">
              {["1 content generation", "max 5 slides", "all vibes & palettes"].map(f => (
                <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Zap className="h-3 w-3" />{f}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground">
              {settings?.freeGenerationsUsed || 0}/1 used
            </p>
          </Card>

          {/* pro card */}
          <Card className="p-5 space-y-4 border-primary bg-primary/5">
            <div>
              <Badge className="text-[10px] mb-3">recommended</Badge>
              <p className="text-lg font-bold">pro</p>
              <p className="text-xs text-muted-foreground">{priceFormatted} / month</p>
            </div>
            <Separator />
            <ul className="space-y-2">
              {["unlimited generations", "app-managed api", "max 10 slides", "priority support"].map(f => (
                <li key={f} className="flex items-center gap-2 text-xs">
                  <Zap className="h-3 w-3 text-primary" />{f}
                </li>
              ))}
            </ul>
            <Button onClick={handleSubscribe} disabled={loading} className="w-full text-xs h-9">
              {loading ? <><Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> processing...</> : (
                <><CreditCard className="h-3.5 w-3.5 mr-2" /> subscribe — {priceFormatted}/mo</>
              )}
            </Button>
          </Card>
        </div>
      )}

      {/* byok alternative */}
      {settings?.plan !== "byok" && settings?.plan !== "pro" && (
        <div className="rounded-xl border border-border/60 p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Key className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-medium">have your own api key?</p>
          </div>
          <p className="text-xs text-muted-foreground">
            add your tokenrouter.com or openai-compatible key for unlimited generations — completely free.
          </p>
          <Link href="/settings/api-key">
            <Button variant="outline" size="sm" className="text-xs h-8">set up byok</Button>
          </Link>
        </div>
      )}
    </div>
  )
}
